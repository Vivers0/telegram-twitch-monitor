const config = require('../config');
const { getAppToken } = require('../twitch/auth');
const twitchApi = require('../twitch/api');
const { getAllSubscriptions } = require('../db/subscriptions');

// Последнее известное состояние стримов: channel -> boolean
const streamStatusCache = new Map();

// Кэш channel -> twitch id, чтобы не резолвить имя при каждой проверке
const channelIdCache = new Map();

let inProgress = false;

async function checkStreams(bot) {
    // Защита от наложения запусков: если предыдущая проверка ещё идёт (медленная сеть),
    // новый цикл не стартует — иначе возможны дублирующиеся уведомления
    if (inProgress) return;
    inProgress = true;

    try {
        const token = await getAppToken();
        if (!token) return;

        // Группируем подписчиков по каналу: один запрос к Twitch на канал,
        // уведомление получают все подписанные на него чаты
        const channelSubscribers = new Map();
        for (const { chat_id, channel } of getAllSubscriptions()) {
            if (!channelSubscribers.has(channel)) channelSubscribers.set(channel, []);
            channelSubscribers.get(channel).push(chat_id);
        }

        for (const [channel, chatIds] of channelSubscribers) {
            let channelId = channelIdCache.get(channel);
            if (!channelId) {
                channelId = await twitchApi.getChannelId(token, channel);
                if (!channelId) continue;
                channelIdCache.set(channel, channelId);
            }

            const streaming = await twitchApi.isStreaming(token, channelId);

            // Ошибка API — статус неизвестен, кэш не трогаем,
            // иначе после восстановления связи придёт ложное "стрим начался"
            if (streaming === null) continue;

            const wasStreaming = streamStatusCache.get(channel) || false;

            if (!wasStreaming && streaming) {
                streamStatusCache.set(channel, true);
                await notifyAll(bot, chatIds, channel);
            } else if (!streaming) {
                streamStatusCache.set(channel, false);
            }
        }
    } catch (err) {
        console.error('❌ Ошибка в цикле мониторинга стримов:', err.message);
    } finally {
        inProgress = false;
    }
}

async function notifyAll(bot, chatIds, channel) {
    const message = `🔴 <b>${channel}</b> начал стрим на Twitch!\n🔗 https://twitch.tv/${channel}`;

    for (const chatId of chatIds) {
        try {
            await bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML' });
        } catch (err) {
            console.error(`❌ Не удалось отправить уведомление chat_id=${chatId}:`, err.message);
        }
    }
}

function startStreamMonitor(bot) {
    const timer = setInterval(() => checkStreams(bot), config.monitoring.streamCheckInterval);
    console.log(`📡 Мониторинг стримов: проверка каждые ${config.monitoring.streamCheckInterval / 1000} с`);
    return timer;
}

module.exports = { startStreamMonitor };
