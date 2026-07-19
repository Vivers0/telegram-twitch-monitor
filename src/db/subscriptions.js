const db = require('./index');

const stmts = {
    addUser: db.prepare('INSERT OR IGNORE INTO users (chat_id) VALUES (?)'),
    addSub: db.prepare('INSERT OR IGNORE INTO subscriptions (chat_id, channel) VALUES (?, ?)'),
    removeSub: db.prepare('DELETE FROM subscriptions WHERE chat_id = ? AND channel = ?'),
    listByChat: db.prepare('SELECT channel FROM subscriptions WHERE chat_id = ?'),
    listAll: db.prepare('SELECT chat_id, channel FROM subscriptions'),
    exists: db.prepare('SELECT 1 FROM subscriptions WHERE chat_id = ? AND channel = ?')
};

function addUser(chatId) {
    stmts.addUser.run(chatId);
}

function addSubscription(chatId, channel) {
    stmts.addUser.run(chatId);
    stmts.addSub.run(chatId, channel.toLowerCase());
}

function removeSubscription(chatId, channel) {
    stmts.removeSub.run(chatId, channel.toLowerCase());
}

function getSubscriptions(chatId) {
    return stmts.listByChat.all(chatId).map(row => row.channel);
}

function getAllSubscriptions() {
    return stmts.listAll.all();
}

function isSubscribed(chatId, channel) {
    return !!stmts.exists.get(chatId, channel.toLowerCase());
}

module.exports = {
    addUser,
    addSubscription,
    removeSubscription,
    getSubscriptions,
    getAllSubscriptions,
    isSubscribed
};
