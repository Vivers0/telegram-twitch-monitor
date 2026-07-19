const crypto = require('crypto');

// Хранилище состояний OAuth-авторизации (state -> { chatId, createdAt })
// Общее для команды /addall и express-колбэка
const pending = new Map();

const STATE_TTL_MS = 10 * 60 * 1000; // ссылка живёт 10 минут

function createState(chatId) {
    // Случайный state вместо предсказуемого chatId_timestamp — защита от подделки колбэка
    const state = crypto.randomBytes(24).toString('hex');
    pending.set(state, { chatId, createdAt: Date.now() });
    return state;
}

function consumeState(state) {
    const entry = pending.get(state);
    if (!entry) return null;

    pending.delete(state);

    if (Date.now() - entry.createdAt > STATE_TTL_MS) {
        return null; // ссылка протухла
    }
    return entry.chatId;
}

// Периодическая очистка протухших state, чтобы Map не рос бесконечно
setInterval(() => {
    const now = Date.now();
    for (const [state, entry] of pending) {
        if (now - entry.createdAt > STATE_TTL_MS) pending.delete(state);
    }
}, STATE_TTL_MS).unref();

module.exports = { createState, consumeState };
