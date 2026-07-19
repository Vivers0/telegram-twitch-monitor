const { Telegraf } = require('telegraf');
const config = require('../config');
const proxyAgent = require('../proxy');
const { registerCommands } = require('./commands');
const { registerActions } = require('./actions');

function createBot() {
    const bot = new Telegraf(
        config.telegram.botToken,
        proxyAgent ? { telegram: { agent: proxyAgent } } : {}
    );

    registerCommands(bot);
    registerActions(bot);

    // Глобальный обработчик ошибок Telegraf — чтобы одна упавшая команда не роняла процесс
    bot.catch((err, ctx) => {
        console.error(`❌ Ошибка при обработке апдейта ${ctx.updateType}:`, err.message);
    });

    return bot;
}

module.exports = { createBot };
