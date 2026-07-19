const express = require('express');
const config = require('../config');
const { exchangeCode } = require('../twitch/auth');
const twitchApi = require('../twitch/api');
const subscriptions = require('../db/subscriptions');
const { saveTwitchAccount } = require('../db/twitchAccounts');
const { markChannelsSeen } = require('../db/followedSeen');
const { consumeState } = require('../bot/oauthState');

function createServer(bot) {
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Callback для Twitch OAuth (используется командой /addall)
    app.get('/auth/twitch/callback', async (req, res) => {
        const { code, state, error } = req.query;

        if (error) {
            return res.send('❌ Авторизация отменена. Можете закрыть эту вкладку.');
        }

        const chatId = consumeState(state);
        if (!chatId) {
            return res.status(400).send('❌ Ссылка недействительна, устарела или уже использована. Запросите новую командой /addall.');
        }

        try {
            const tokenData = await exchangeCode(code);
            if (!tokenData) throw new Error('не удалось обменять код на токен');

            const userId = await twitchApi.getSelfUserId(tokenData.access_token);
            if (!userId) throw new Error('не удалось получить Twitch user_id');

            // Сохраняем токен для фоновой синхронизации подписок
            saveTwitchAccount(chatId, userId, tokenData.access_token, tokenData.refresh_token, tokenData.expires_in);

            const channels = await twitchApi.getFollowedChannels(tokenData.access_token, userId);
            if (channels === null) throw new Error('не удалось получить список подписок');

            for (const channel of channels) {
                subscriptions.addSubscription(chatId, channel);
            }

            // Все текущие подписки — «известные»: дальше уведомляем только о новых
            markChannelsSeen(chatId, channels);

            res.send(`✅ Готово! Добавлено каналов: ${channels.length}. Можете закрыть эту вкладку и вернуться в Telegram.`);

            if (channels.length > 0) {
                await bot.telegram.sendMessage(
                    chatId,
                    `✅ Добавлено ${channels.length} канал(ов) из ваших Twitch-подписок:\n• ${channels.join('\n• ')}`
                );
            } else {
                await bot.telegram.sendMessage(chatId, 'ℹ️ У вас нет активных подписок на Twitch.');
            }
        } catch (err) {
            console.error('❌ Ошибка при обработке /addall:', err.message);
            res.status(500).send('❌ Произошла ошибка при получении списка подписок.');
            try {
                await bot.telegram.sendMessage(chatId, '❌ Не удалось получить список подписок Twitch. Попробуйте позже.');
            } catch { /* Telegram недоступен — уже залогировали основную ошибку */ }
        }
    });

    // Health-check (удобно для Docker/мониторинга)
    app.get('/health', (_req, res) => res.json({ status: 'ok' }));

    return app;
}

function startServer(bot) {
    const app = createServer(bot);
    return app.listen(config.server.port, () => {
        console.log(`🚀 Сервер запущен на порту ${config.server.port}`);
    });
}

module.exports = { startServer };
