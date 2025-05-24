# 🎮 Twitch Stream Monitor Bot

Telegram-бот, который отслеживает начало стримов на Twitch и присылает уведомления в Telegram.  
Использует Twitch API и SQLite для хранения подписок пользователей.

---

## 📌 Функционал

- 🔔 Получение уведомлений о начале стрима
- 🧩 Команды: `/add`, `/remove`, `/list`
- 🗃 Хранение данных в локальной БД (SQLite)
- 🐳 Поддержка Docker и `docker-compose`

---

## 🛠 Технологии

- Node.js
- Telegraf.js (Telegram Bot Framework)
- Twitch API
- SQLite (через `better-sqlite3`)
- Docker / Docker Compose

---

## 📦 Установка и запуск

### 1. Склонируй репозиторий

```bash
git clone https://github.com/ваше-имя/twitch-stream-monitor.git
cd twitch-stream-monitor
```

### 2. Установи зависимости (если не используешь Docker)

```bash
npm install
```

### 3. Создай `.env` файл

Скопируй пример:

```bash
cp .env.example .env
```

Открой `.env` и замени значения:

```env
TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_client_secret
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
PORT=3000
```

---

### 4. Запуск через Docker

#### Сборка и запуск:

```bash
docker-compose up -d
```

Бот будет работать в фоне, а база данных сохранится в папке `./data`.

---

## 📱 Как использовать

1. Напиши боту в Telegram: `/start`
2. Добавь канал:
   ```
   /add shroud
   ```
3. Удали канал:
   ```
   /remove shroud
   ```
4. Посмотри список отслеживаемых:
   ```
   /list
   ```

---

## 📁 Структура проекта

```
twitch-stream-monitor/
├── index.js              # Основной код бота
├── .env.example          # Пример файла с переменными окружения
├── docker-compose.yml    # Конфиг для Docker Compose
├── Dockerfile            # Docker-образ
├── package.json
└── data/                 # Локальное хранилище SQLite БД
```

---

## 🤝 Автор

@Vivers1  
Если есть идеи или нашёл баг — создавай Issue или Pull Request!

---

## 📜 Лицензия

MIT License