const db = require('./index');

const stmts = {
    insert: db.prepare('INSERT OR IGNORE INTO followed_seen (chat_id, channel) VALUES (?, ?)'),
    remove: db.prepare('DELETE FROM followed_seen WHERE chat_id = ? AND channel = ?'),
    listByChat: db.prepare('SELECT channel FROM followed_seen WHERE chat_id = ?')
};

const insertMany = db.transaction((chatId, channels) => {
    for (const channel of channels) {
        stmts.insert.run(chatId, channel.toLowerCase());
    }
});

const removeMany = db.transaction((chatId, channels) => {
    for (const channel of channels) {
        stmts.remove.run(chatId, channel.toLowerCase());
    }
});

// Отметить каналы как уже известные (чтобы не спрашивать про них повторно)
function markChannelsSeen(chatId, channels) {
    insertMany(chatId, channels);
}

function removeSeenChannels(chatId, channels) {
    removeMany(chatId, channels);
}

function getSeenChannels(chatId) {
    return stmts.listByChat.all(chatId).map(row => row.channel);
}

module.exports = {
    markChannelsSeen,
    removeSeenChannels,
    getSeenChannels
};
