const { Markup } = require('telegraf');
const config = require('../config');
const { ensureValidUserToken } = require('../twitch/auth');
const twitchApi = require('../twitch/api');
const subscriptions = require('../db/subscriptions');
const { getAllTwitchAccounts } = require('../db/twitchAccounts');
const followedSeen = require('../db/followedSeen');

let inProgress = false;

async function syncFollows(bot) {
    if (inProgress) return;
    inProgress = true;

    try {
        for (const account of getAllTwitchAccounts()) {
            try {
                await syncAccount(bot, account);
            } catch (err) {
                console.error(`❌ Ошибка проверки подписок для chat_id=${account.chat_id}:`, err.message);
            }
        }
    } finally {
        inProgress = false;
    }
}

async function syncAccount(bot, account) {
    const accessToken = await ensureValidUserToken(account);
    if (!accessToken) return;

    const currentChannels = await twitchApi.getFollowedChannels(accessToken, account.twitch_user_id);
    // Ошибка API — пропускаем цикл, ничего не удаляем
    // (иначе сбой сети выглядел бы как массовая отписка от всех каналов)
    if (currentChannels === null) return;

    const currentSet = new Set(currentChannels.map(c => c.toLowerCase()));
    const previousChannels = followedSeen.getSeenChannels(account.chat_id);
    const previousSet = new Set(previousChannels);

    // Новые подписки — появились на Twitch, но раньше их не было
    const newChannels = currentChannels.filter(c => !previousSet.has(c.toLowerCase()));

    for (const channel of newChannels) {
        followedSeen.markChannelsSeen(account.chat_id, [channel]);

        if (subscriptions.isSubscribed(account.chat_id, channel)) continue;

        await bot.telegram.sendMessage(
            account.chat_id,
            `👀 Вы подписались на новый канал на Twitch: <b>${channel}</b>\nДобавить его в отслеживание стримов?`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    Markup.button.callback('✅ Да', `addfollow_${channel}`),
                    Markup.button.callback('❌ Нет', `ignorefollow_${channel}`)
                ])
            }
        );
    }

    // Отписки — были в подписках раньше, а теперь пропали
    const unfollowedChannels = previousChannels.filter(c => !currentSet.has(c));

    for (const channel of unfollowedChannels) {
        followedSeen.removeSeenChannels(account.chat_id, [channel]);

        if (!subscriptions.isSubscribed(account.chat_id, channel)) continue;

        subscriptions.removeSubscription(account.chat_id, channel);
        await bot.telegram.sendMessage(
            account.chat_id,
            `🚫 Вы отписались от канала <b>${channel}</b> на Twitch.\nОн удалён из списка отслеживания.`,
            { parse_mode: 'HTML' }
        );
    }
}

function startFollowsSync(bot) {
    const timer = setInterval(() => syncFollows(bot), config.monitoring.followsCheckInterval);
    console.log(`👥 Синхронизация подписок: проверка каждые ${config.monitoring.followsCheckInterval / 1000} с`);
    return timer;
}

module.exports = { startFollowsSync };
