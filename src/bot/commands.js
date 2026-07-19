const subscriptions = require('../db/subscriptions');
const { buildAuthUrl } = require('../twitch/auth');
const { createState } = require('./oauthState');

const HELP_TEXT = [
    '👋 Привет! Я уведомлю тебя, когда начнётся стрим.',
    '',
    'Доступные команды:',
    '/add [имя_канала] — добавить канал',
    '/remove [имя_канала] — удалить канал',
    '/addall — добавить все каналы, на которые вы подписаны на Twitch',
    '/list — показать список отслеживаемых каналов'
].join('\n');

// Достаёт первый аргумент команды: "/add shroud" -> "shroud"
function getArg(ctx) {
    const args = ctx.message.text.split(' ').slice(1);
    return args.length > 0 ? args[0].toLowerCase() : null;
}

function registerCommands(bot) {
    bot.start((ctx) => {
        subscriptions.addUser(ctx.chat.id);
        ctx.reply(HELP_TEXT);
    });

    bot.command('add', (ctx) => {
        const channel = getArg(ctx);
        if (!channel) {
            return ctx.reply('❌ Укажите имя канала. Пример: /add shroud');
        }

        subscriptions.addSubscription(ctx.chat.id, channel);
        ctx.reply(`✅ Канал "${channel}" добавлен в список отслеживания.`);
    });

    bot.command('remove', (ctx) => {
        const channel = getArg(ctx);
        if (!channel) {
            return ctx.reply('❌ Укажите имя канала. Пример: /remove shroud');
        }

        subscriptions.removeSubscription(ctx.chat.id, channel);
        ctx.reply(`✅ Канал "${channel}" удалён из списка отслеживания.`);
    });

    bot.command('list', (ctx) => {
        const subs = subscriptions.getSubscriptions(ctx.chat.id);

        if (subs.length === 0) {
            return ctx.reply('📋 Список отслеживаемых каналов пуст.');
        }

        ctx.reply(`📋 Отслеживаемые каналы:\n• ${subs.join('\n• ')}`);
    });

    bot.command('addall', (ctx) => {
        const state = createState(ctx.chat.id);
        const authUrl = buildAuthUrl(state);

        ctx.reply(
            `🔗 Чтобы добавить все каналы, на которые вы подписаны на Twitch, авторизуйтесь по ссылке:\n${authUrl}\n\nСсылка одноразовая, действует 10 минут.`
        );
    });
}

module.exports = { registerCommands };
