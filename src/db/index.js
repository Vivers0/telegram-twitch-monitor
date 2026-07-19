const Database = require('better-sqlite3');
const config = require('../config');

const db = new Database(config.dbPath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// Схема БД
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

module.exports = db;
