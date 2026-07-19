const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// ===== Загрузка файлов окружения =====
// Приоритет (каждый следующий перекрывает предыдущий):
// 1. .env            — базовый файл
// 2. <NODE_ENV>.env  — например development.env / production.env
// 3. local.env       — локальные переопределения (не коммитить в git)

dotenv.config();

if (process.env.NODE_ENV) {
    const envPath = path.resolve(process.cwd(), `${process.env.NODE_ENV}.env`);
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath, override: true });
        console.log(`⚙️  Загружены переменные окружения из ${process.env.NODE_ENV}.env`);
    }
}

const localEnvPath = path.resolve(process.cwd(), 'local.env');
if (fs.existsSync(localEnvPath)) {
    dotenv.config({ path: localEnvPath, override: true });
    console.log('⚙️  Загружены локальные переопределения из local.env');
}

// ===== Валидация обязательных переменных =====
const required = [
    'TELEGRAM_BOT_TOKEN',
    'TWITCH_CLIENT_ID',
    'TWITCH_CLIENT_SECRET',
    'TWITCH_REDIRECT_URI'
];

const missing = required.filter(name => !process.env[name]);
if (missing.length > 0) {
    console.error(`❌ Отсутствуют обязательные переменные окружения: ${missing.join(', ')}`);
    process.exit(1);
}

function toInt(value, fallback) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// ===== Итоговая конфигурация =====
module.exports = {
    telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN
    },
    twitch: {
        clientId: process.env.TWITCH_CLIENT_ID,
        clientSecret: process.env.TWITCH_CLIENT_SECRET,
        redirectUri: process.env.TWITCH_REDIRECT_URI
    },
    server: {
        port: toInt(process.env.PORT, 3000)
    },
    monitoring: {
        // Интервал проверки статуса стримов, мс
        streamCheckInterval: toInt(process.env.INTERVAL, 10_000),
        // Интервал проверки новых подписок/отписок, мс
        followsCheckInterval: toInt(process.env.FOLLOWS_CHECK_INTERVAL, 5 * 60 * 1000)
    },
    proxyUrl: process.env.PROXY_URL || null,
    dbPath: process.env.DB_PATH || 'database.db'
};
