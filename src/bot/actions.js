const subscriptions = require('../db/subscriptions');

function registerActions(bot) {
    // Кнопка "Да" — добавить канал в отслеживание
    bot.action(/^addfollow_(.+)$/, async (ctx) => {
        const channel = ctx.match[1];

        subscriptions.addSubscription(ctx.chat.id, channel);
        await ctx.answerCbQuery('Добавлено ✅');
        await ctx.editMessageText(
            `✅ Канал <b>${channel}</b> добавлен в список отслеживания.`,
            { parse_mode: 'HTML' }
        );
    });

    // Кнопка "Нет" — пропустить канал
    bot.action(/^ignorefollow_(.+)$/, async (ctx) => {
        const channel = ctx.match[1];

        await ctx.answerCbQuery('Пропущено');
        await ctx.editMessageText(
            `ℹ️ Канал <b>${channel}</b> не будет отслеживаться.`,
            { parse_mode: 'HTML' }
        );
    });
}

module.exports = { registerActions };
