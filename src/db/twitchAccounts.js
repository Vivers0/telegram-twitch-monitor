const db = require('./index');

const stmts = {
    addUser: db.prepare('INSERT OR IGNORE INTO users (chat_id) VALUES (?)'),
    upsert: db.prepare(`
        INSERT INTO twitch_accounts (chat_id, twitch_user_id, access_token, refresh_token, expires_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(chat_id) DO UPDATE SET
            twitch_user_id = excluded.twitch_user_id,
            access_token = excluded.access_token,
            refresh_token = excluded.refresh_token,
            expires_at = excluded.expires_at
    `),
    getByChat: db.prepare('SELECT * FROM twitch_accounts WHERE chat_id = ?'),
    getAll: db.prepare('SELECT * FROM twitch_accounts')
};

// Сохранение / обновление токена Twitch-аккаунта пользователя
function saveTwitchAccount(chatId, twitchUserId, accessToken, refreshToken, expiresInSeconds) {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    stmts.addUser.run(chatId);
    stmts.upsert.run(chatId, twitchUserId, accessToken, refreshToken, expiresAt);
}

function getTwitchAccount(chatId) {
    return stmts.getByChat.get(chatId);
}

function getAllTwitchAccounts() {
    return stmts.getAll.all();
}

module.exports = {
    saveTwitchAccount,
    getTwitchAccount,
    getAllTwitchAccounts
};
