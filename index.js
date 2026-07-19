// Точка входа: собирает приложение из модулей src/
// Конфигурация и валидация env — src/config.js

const { createBot } = require('./src/bot');
const { startServer } = require('./src/server');
const { startStreamMonitor } = require('./src/jobs/streamMonitor');
const { startFollowsSync } = require('./src/jobs/followsSync');

async function main() {
    const bot = createBot();

    // HTTP-сервер (OAuth-колбэк для /addall + health-check)
    const server = startServer(bot);

    // Фоновые задачи
    const monitorTimer = startStreamMonitor(bot);
    const followsTimer = startFollowsSync(bot);

    // Telegram-бот
    bot.launch().then(() => {
        console.log('🤖 Telegram бот запущен');
    });

    // Корректное завершение по сигналам (Ctrl+C, docker stop)
    const shutdown = (signal) => {
        console.log(`\n⏹ Получен ${signal}, останавливаюсь...`);
        clearInterval(monitorTimer);
        clearInterval(followsTimer);
        bot.stop(signal);
        server.close(() => process.exit(0));
        // На случай зависших соединений — жёсткий выход через 5 секунд
        setTimeout(() => process.exit(0), 5000).unref();
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
    console.error('❌ Фатальная ошибка при запуске:', err);
    process.exit(1);
});
