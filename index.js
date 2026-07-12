require('dotenv').config();
const express = require('express');
const { default: fetch } = require('node-fetch');
const { Telegraf, Markup } = require('telegraf');
const Database = require('better-sqlite3');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== Настройка прокси =====
function createProxyAgent() {
    const proxyUrl = process.env.PROXY_URL;
    if (!proxyUrl) return null;

    try {
        const protocol = proxyUrl.split('://')[0].toLowerCase();

        if (protocol === 'socks4' || protocol === 'socks5') {
            console.log(`🌐 Используется SOCKS-прокси (${protocol}): ${proxyUrl}`);
            return new SocksProxyAgent(proxyUrl);
        } else if (protocol === 'http' || protocol === 'https') {
            console.log(`🌐 Используется HTTP(S)-прокси: ${proxyUrl}`);
            return new HttpsProxyAgent(proxyUrl);
        } else {
            console.warn(`⚠️ Неизвестный протокол прокси "${protocol}", прокси не будет использован.`);
            return null;
        }
    } catch (err) {
        console.error('❌ Ошибка при создании прокси-агента:', err.message);
        return null;
    }
}

const proxyAgent = createProxyAgent();

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
  CREATE TABLE IF NOT EXISTS twitch_accounts (
    chat_id INTEGER PRIMARY KEY,
    twitch_user_id TEXT,
    access_token TEXT,
    refresh_token TEXT,
    expires_at INTEGER,
    FOREIGN KEY(chat_id) REFERENCES users(chat_id)
  );
  CREATE TABLE IF NOT EXISTS followed_seen (
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

function isSubscribed(chatId, channel) {
    const row = db.prepare('SELECT 1 FROM subscriptions WHERE chat_id = ? AND channel = ?').get(chatId, channel.toLowerCase());
    return !!row;
}

// Сохранение / обновление токена Twitch-аккаунта пользователя (для /addall и фоновой проверки)
function saveTwitchAccount(chatId, twitchUserId, accessToken, refreshToken, expiresInSeconds) {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    db.prepare('INSERT OR IGNORE INTO users (chat_id) VALUES (?)').run(chatId);
    db.prepare(`
        INSERT INTO twitch_accounts (chat_id, twitch_user_id, access_token, refresh_token, expires_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(chat_id) DO UPDATE SET
            twitch_user_id = excluded.twitch_user_id,
            access_token = excluded.access_token,
            refresh_token = excluded.refresh_token,
            expires_at = excluded.expires_at
    `).run(chatId, twitchUserId, accessToken, refreshToken, expiresAt);
}

function getTwitchAccount(chatId) {
    return db.prepare('SELECT * FROM twitch_accounts WHERE chat_id = ?').get(chatId);
}

function getAllTwitchAccounts() {
    return db.prepare('SELECT * FROM twitch_accounts').all();
}

// Отметить каналы как уже известные (чтобы не спрашивать про них повторно)
function markChannelsSeen(chatId, channels) {
    const insert = db.prepare('INSERT OR IGNORE INTO followed_seen (chat_id, channel) VALUES (?, ?)');
    const insertMany = db.transaction((chId, chans) => {
        for (const channel of chans) {
            insert.run(chId, channel.toLowerCase());
        }
    });
    insertMany(chatId, channels);
}

function isChannelSeen(chatId, channel) {
    const row = db.prepare('SELECT 1 FROM followed_seen WHERE chat_id = ? AND channel = ?').get(chatId, channel.toLowerCase());
    return !!row;
}

function getSeenChannels(chatId) {
    return db.prepare('SELECT channel FROM followed_seen WHERE chat_id = ?')
        .all(chatId)
        .map(row => row.channel);
}

function removeSeenChannels(chatId, channels) {
    const del = db.prepare('DELETE FROM followed_seen WHERE chat_id = ? AND channel = ?');
    const delMany = db.transaction((chId, chans) => {
        for (const channel of chans) {
            del.run(chId, channel.toLowerCase());
        }
    });
    delMany(chatId, channels);
}

// Инициализация Telegram-бота (с прокси, если задан)
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN, proxyAgent ? {
    telegram: { agent: proxyAgent }
} : {});

// Хранилище последнего состояния стримов
const streamStatusCache = {};

// Хранилище состояний OAuth-авторизации (state -> chatId), нужно для /addall
const pendingTwitchAuth = new Map();

// Получение токена Twitch
async function getTwitchToken() {
    const res = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        agent: proxyAgent,
        body: new URLSearchParams({
            client_id: process.env.TWITCH_CLIENT_ID,
            client_secret: process.env.TWITCH_CLIENT_SECRET,
            grant_type: 'client_credentials'
        })
    });
    const data = await res.json();
    return data.access_token;
}

// Обмен authorization code на пользовательский access token (для /addall)
async function exchangeTwitchCode(code) {
    const res = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        agent: proxyAgent,
        body: new URLSearchParams({
            client_id: process.env.TWITCH_CLIENT_ID,
            client_secret: process.env.TWITCH_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: process.env.TWITCH_REDIRECT_URI
        })
    });
    const data = await res.json();
    if (!data.access_token) {
        console.error('❌ Не удалось получить пользовательский токен Twitch:', data);
        return null;
    }
    return data; // { access_token, refresh_token, expires_in }
}

// Обновление пользовательского access token по refresh token
async function refreshTwitchUserToken(refreshToken) {
    const res = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        agent: proxyAgent,
        body: new URLSearchParams({
            client_id: process.env.TWITCH_CLIENT_ID,
            client_secret: process.env.TWITCH_CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        })
    });
    const data = await res.json();
    if (!data.access_token) {
        console.error('❌ Не удалось обновить пользовательский токен Twitch:', data);
        return null;
    }
    return data; // { access_token, refresh_token, expires_in }
}

// Возвращает действующий access token для сохранённого Twitch-аккаунта, обновляя его при необходимости
async function ensureValidUserToken(account) {
    const isExpiringSoon = !account.expires_at || Date.now() > account.expires_at - 60_000;

    if (!isExpiringSoon) {
        return account.access_token;
    }

    const refreshed = await refreshTwitchUserToken(account.refresh_token);
    if (!refreshed) return null;

    saveTwitchAccount(account.chat_id, account.twitch_user_id, refreshed.access_token, refreshed.refresh_token, refreshed.expires_in);
    return refreshed.access_token;
}

// Получить Twitch user_id владельца пользовательского токена
async function getTwitchSelfUserId(userAccessToken) {
    const res = await fetch('https://api.twitch.tv/helix/users', {
        agent: proxyAgent,
        headers: {
            'Client-ID': process.env.TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${userAccessToken}`
        }
    });
    const data = await res.json();
    if (!data || !Array.isArray(data.data) || data.data.length === 0) return null;
    return data.data[0].id;
}

// Получить список каналов, на которые подписан пользователь (с пагинацией)
async function getFollowedChannels(userAccessToken, userId) {
    const channels = [];
    let cursor = null;

    do {
        const url = new URL('https://api.twitch.tv/helix/channels/followed');
        url.searchParams.set('user_id', userId);
        url.searchParams.set('first', '100');
        if (cursor) url.searchParams.set('after', cursor);

        const res = await fetch(url.toString(), {
            agent: proxyAgent,
            headers: {
                'Client-ID': process.env.TWITCH_CLIENT_ID,
                'Authorization': `Bearer ${userAccessToken}`
            }
        });

        if (!res.ok) {
            console.error('Ошибка при получении подписок Twitch:', res.statusText);
            break;
        }

        const data = await res.json();
        for (const item of data.data || []) {
            channels.push(item.broadcaster_login);
        }

        cursor = data.pagination && data.pagination.cursor ? data.pagination.cursor : null;
    } while (cursor);

    return channels;
}

// Получить ID канала по имени
async function getChannelId(token, username) {
    const res = await fetch(`https://api.twitch.tv/helix/users?login=${username}`, {
        agent: proxyAgent,
        headers: {
            'Client-ID': process.env.TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${token}`
        }
    });
    const data = await res.json();

    if (!data || !Array.isArray(data.data) || data.data.length === 0) {
        return null;
    }

    return data.data[0].id;
}

// Проверяет, стримит ли пользователь
async function checkStreamStatus(token, channelId) {
    const res = await fetch(`https://api.twitch.tv/helix/streams?user_id=${channelId}`, {
        agent: proxyAgent,
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

// Проверка новых подписок и отписок Twitch у пользователей, прошедших /addall
async function checkNewFollows() {
    const accounts = getAllTwitchAccounts();

    for (const account of accounts) {
        try {
            const accessToken = await ensureValidUserToken(account);
            if (!accessToken) continue;

            const currentChannels = await getFollowedChannels(accessToken, account.twitch_user_id);
            const currentSet = new Set(currentChannels.map(c => c.toLowerCase()));

            const previousChannels = getSeenChannels(account.chat_id);
            const previousSet = new Set(previousChannels);

            // Новые подписки — те, что появились у пользователя на Twitch, но которых не было раньше
            const newChannels = currentChannels.filter(c => !previousSet.has(c.toLowerCase()));

            for (const channel of newChannels) {
                markChannelsSeen(account.chat_id, [channel]);

                if (isSubscribed(account.chat_id, channel)) continue;

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

            // Отписки — каналы, которые раньше были у пользователя в подписках, а теперь пропали
            const unfollowedChannels = previousChannels.filter(c => !currentSet.has(c));

            for (const channel of unfollowedChannels) {
                removeSeenChannels(account.chat_id, [channel]);

                if (!isSubscribed(account.chat_id, channel)) continue;

                removeSubscription(account.chat_id, channel);
                await bot.telegram.sendMessage(
                    account.chat_id,
                    `🚫 Вы отписались от канала <b>${channel}</b> на Twitch.\nОн удалён из списка отслеживания.`,
                    { parse_mode: 'HTML' }
                );
            }
        } catch (err) {
            console.error(`❌ Ошибка проверки подписок для chat_id=${account.chat_id}:`, err.message);
        }
    }
}

// Запуск проверки новых подписок каждые 5 минут
setInterval(checkNewFollows, process.env.FOLLOWS_CHECK_INTERVAL || 5 * 60 * 1000);

// Обработка кнопки "Да" — добавить канал в отслеживание
bot.action(/^addfollow_(.+)$/, async (ctx) => {
    const channel = ctx.match[1];
    const chatId = ctx.chat.id;

    addSubscription(chatId, channel);
    await ctx.answerCbQuery('Добавлено ✅');
    await ctx.editMessageText(`✅ Канал <b>${channel}</b> добавлен в список отслеживания.`, { parse_mode: 'HTML' });
});

// Обработка кнопки "Нет" — пропустить канал
bot.action(/^ignorefollow_(.+)$/, async (ctx) => {
    const channel = ctx.match[1];

    await ctx.answerCbQuery('Пропущено');
    await ctx.editMessageText(`ℹ️ Канал <b>${channel}</b> не будет отслеживаться.`, { parse_mode: 'HTML' });
});

// Команда /start
bot.start((ctx) => {
    const chatId = ctx.chat.id;
    addUser(chatId);
    ctx.reply('👋 Привет! Я уведомлю тебя, когда начнётся стрим.\n\nДоступные команды:\n/add [имя_канала] — добавить канал\n/remove [имя_канала] — удалить канал\n/addall — добавить все каналы, на которые вы подписаны на Twitch\n/list — показать список отслеживаемых каналов');
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

// Команда /addall — авторизация через Twitch и добавление всех подписок пользователя
bot.command('addall', (ctx) => {
    const chatId = ctx.chat.id;
    const state = `${chatId}_${Date.now()}`;
    pendingTwitchAuth.set(state, chatId);

    const authUrl = new URL('https://id.twitch.tv/oauth2/authorize');
    authUrl.searchParams.set('client_id', process.env.TWITCH_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', process.env.TWITCH_REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'user:read:follows');
    authUrl.searchParams.set('state', state);

    ctx.reply(
        `🔗 Чтобы добавить все каналы, на которые вы подписаны на Twitch, авторизуйтесь по ссылке:\n${authUrl.toString()}\n\nСсылка одноразовая и действительна только для вас.`
    );
});

// Callback для Twitch OAuth (используется командой /addall)
app.get('/auth/twitch/callback', async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
        res.send('❌ Авторизация отменена. Можете закрыть эту вкладку.');
        return;
    }

    const chatId = pendingTwitchAuth.get(state);
    if (!chatId) {
        res.status(400).send('❌ Ссылка недействительна или уже использована.');
        return;
    }
    pendingTwitchAuth.delete(state);

    try {
        const tokenData = await exchangeTwitchCode(code);
        if (!tokenData) throw new Error('no user token');
        const userToken = tokenData.access_token;

        const userId = await getTwitchSelfUserId(userToken);
        if (!userId) throw new Error('no user id');

        // Сохраняем токен, чтобы потом проверять новые подписки в фоне
        saveTwitchAccount(chatId, userId, tokenData.access_token, tokenData.refresh_token, tokenData.expires_in);

        const channels = await getFollowedChannels(userToken, userId);

        for (const channel of channels) {
            addSubscription(chatId, channel);
        }

        // Отмечаем все текущие подписки как уже известные — дальше уведомляем только о новых
        markChannelsSeen(chatId, channels);

        res.send(`✅ Готово! Добавлено каналов: ${channels.length}. Можете закрыть эту вкладку и вернуться в Telegram.`);

        if (channels.length > 0) {
            await bot.telegram.sendMessage(
                chatId,
                `✅ Добавлено ${channels.length} канал(ов) из ваших Twitch-подписок:\n• ${channels.join('\n• ')}`
            );
        } else {
            await bot.telegram.sendMessage(chatId, 'ℹ️ У вас нет активных подписок на Twitch, либо не удалось их получить.');
        }
    } catch (err) {
        console.error('❌ Ошибка при обработке /addall:', err.message);
        res.status(500).send('❌ Произошла ошибка при получении списка подписок.');
        await bot.telegram.sendMessage(chatId, '❌ Не удалось получить список подписок Twitch. Попробуйте позже.');
    }
});

// Запуск бота
bot.launch().then(() => {
    console.log('🤖 Telegram бот запущен');
});

// Запуск сервера
app.listen(process.env.PORT || 3000, () => {
    console.log(`🚀 Сервер запущен на порту ${process.env.PORT || 3000}`);
});