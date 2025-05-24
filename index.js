require('dotenv').config();
const express = require('express');
const { default: fetch } = require('node-fetch');
const { Telegraf } = require('telegraf');
const Database = require('better-sqlite3');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Подключение к SQLite
const db = new Database('database.db');
db.pragma('foreign_keys = ON');

// Создание таблиц
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    chat_id INTEGER PRIMARY KEY
  );
  CREATE TABLE IF NOT EXISTS subscriptions (
    chat_id INTEGER,
    channel TEXT,
    FOREIGN KEY(chat_id) REFERENCES users(chat_id),
    UNIQUE(chat_id, channel)
  );
`);

// Функции для работы с БД
function addUser(chatId) {
    db.prepare('INSERT OR IGNORE INTO users (chat_id) VALUES (?)').run(chatId);
}

function addSubscription(chatId, channel) {
    db.prepare('INSERT OR IGNORE INTO users (chat_id) VALUES (?)').run(chatId);
    db.prepare('INSERT OR IGNORE INTO subscriptions (chat_id, channel) VALUES (?, ?)').run(chatId, channel.toLowerCase());
}

function removeSubscription(chatId, channel) {
    db.prepare('DELETE FROM subscriptions WHERE chat_id = ? AND channel = ?').run(chatId, channel.toLowerCase());
}

function getSubscriptions(chatId) {
    return db.prepare('SELECT channel FROM subscriptions WHERE chat_id = ?')
        .all(chatId)
        .map(row => row.channel);
}

function getAllSubscriptions() {
    return db.prepare('SELECT * FROM subscriptions').all();
}

// Инициализация Telegram-бота
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Хранилище последнего состояния стримов
const streamStatusCache = {};

// Получение токена Twitch
async function getTwitchToken() {
    const res = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        body: new URLSearchParams({
            client_id: process.env.TWITCH_CLIENT_ID,
            client_secret: process.env.TWITCH_CLIENT_SECRET,
            grant_type: 'client_credentials'
        })
    });
    const data = await res.json();
    return data.access_token;
}

// Получить ID канала по имени
async function getChannelId(token, username) {
    const res = await fetch(`https://api.twitch.tv/helix/users?login=${username}`, {
        headers: {
            'Client-ID': process.env.TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${token}`
        }
    });
    const data = await res.json();

    if (!data || !Array.isArray(data.data) || data.data.length === 0) {
        console.warn(`⚠️ Канал "${username}" не найден`);
        return null;
    }

    return data.data[0].id;
}

// Проверяет, стримит ли пользователь
async function checkStreamStatus(token, channelId) {
    const res = await fetch(`https://api.twitch.tv/helix/streams?user_id=${channelId}`, {
        headers: {
            'Client-ID': process.env.TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${token}`
        }
    });

    if (!res.ok) {
        console.error('Ошибка при запросе к Twitch API:', res.statusText);
        return false;
    }

    const data = await res.json();
    return data.data.length > 0;
}

// Отправляет уведомление через Telegram
async function sendNotification(chatId, username) {
    const message = `🔴 <b>${username}</b> начал стрим на Twitch!\n🔗 https://twitch.tv/${username}`;
    await bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML' });
    console.log(`🔔 Уведомление отправлено: ${username} начал стрим`);
}

// Функция периодической проверки
async function startMonitoring() {
    const token = await getTwitchToken();
    const allSubs = getAllSubscriptions();

    for (const sub of allSubs) {
        const { chat_id, channel } = sub;

        const channelId = await getChannelId(token, channel);
        if (!channelId) continue;

        const isStreaming = await checkStreamStatus(token, channelId);

        const wasStreaming = streamStatusCache[channel] || false;

        if (!wasStreaming && isStreaming) {
            // Только что начался стрим
            await sendNotification(chat_id, channel);
            streamStatusCache[channel] = true;
        } else if (!isStreaming) {
            streamStatusCache[channel] = false;
        }
    }
}

// Запуск проверки каждые 10 секунд
setInterval(startMonitoring, process.env.INTERVAL);

// Команда /start
bot.start((ctx) => {
    const chatId = ctx.chat.id;
    addUser(chatId);
    ctx.reply('👋 Привет! Я уведомлю тебя, когда начнётся стрим.\n\nДоступные команды:\n/add [имя_канала] — добавить канал\n/remove [имя_канала] — удалить канал');
});

// Команда /add
bot.command('add', (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length === 0) {
        return ctx.reply('❌ Укажите имя канала. Пример: /add shroud');
    }

    const user = args[0].toLowerCase();
    const chatId = ctx.chat.id;

    addSubscription(chatId, user);
    ctx.reply(`✅ Канал "${user}" добавлен в список отслеживания.`);
});

// Команда /remove
bot.command('remove', (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length === 0) {
        return ctx.reply('❌ Укажите имя канала. Пример: /remove shroud');
    }

    const user = args[0].toLowerCase();
    const chatId = ctx.chat.id;

    removeSubscription(chatId, user);
    ctx.reply(`✅ Канал "${user}" удалён из списка отслеживания.`);
});

// Вывод текущего списка отслеживаемых каналов
bot.command('list', (ctx) => {
    const chatId = ctx.chat.id;
    const subs = getSubscriptions(chatId);

    if (subs.length === 0) {
        return ctx.reply('📋 Список отслеживаемых каналов пуст.');
    }

    const list = subs.join('\n• ');
    ctx.reply(`📋 Отслеживаемые каналы:\n• ${list}`);
});

// Запуск бота
bot.launch().then(() => {
    console.log('🤖 Telegram бот запущен');
});

// Запуск сервера
app.listen(process.env.PORT || 3000, () => {
    console.log(`🚀 Сервер запущен на порту ${process.env.PORT || 3000}`);
});