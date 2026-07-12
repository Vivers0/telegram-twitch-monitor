# 🎮 Twitch Stream Monitor Bot

Telegram-бот, который отслеживает начало стримов на Twitch и присылает уведомления в Telegram.  
Использует Twitch API и SQLite для хранения подписок пользователей.

---

## 📌 Функционал

- 🔔 Получение уведомлений о начале стрима
- 🧩 Команды: `/add`, `/remove`, `/list`
- 🔗 `/addall` — авторизация через Twitch и добавление всех текущих подписок пользователя одним действием
- 🆕 Автоматическое обнаружение новых подписок на Twitch с предложением добавить канал в отслеживание (кнопки «Да / Нет»)
- 🚫 Автоматическое обнаружение отписок на Twitch — канал удаляется из отслеживания с уведомлением
- 🗃 Хранение данных в локальной БД (SQLite)
- 🌐 Поддержка прокси (HTTP/HTTPS/SOCKS4/SOCKS5)
- 🐳 Поддержка Docker и `docker-compose`

---

## 🛠 Технологии

- Node.js 22 (LTS)
- Telegraf.js (Telegram Bot Framework)
- Twitch API
- SQLite (через `better-sqlite3`)
- Docker / Docker Compose

---

## 📦 Установка и запуск

### 1. Склонируй репозиторий

```bash
git clone https://github.com/Vivers0/twitch-stream-monitor.git
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
TWITCH_REDIRECT_URI=http://localhost:3000/auth/twitch/callback
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
PORT=3000
INTERVAL=10000
FOLLOWS_CHECK_INTERVAL=300000

# Опционально: прокси для запросов к Twitch и Telegram API
# Поддерживаются протоколы: http, https, socks4, socks5
# PROXY_URL=socks5://user:pass@host:port
```

- `TWITCH_REDIRECT_URI` — должен точь-в-точь совпадать со значением, указанным в Twitch Developer Console в разделе **OAuth Redirect URLs**. Используется командой `/addall`.
- `FOLLOWS_CHECK_INTERVAL` — как часто (в миллисекундах) бот проверяет новые подписки/отписки у пользователей, прошедших `/addall`. По умолчанию `300000` (5 минут).

#### 🌐 Настройка прокси (опционально)

Если бот развернут в регионе, где Twitch или Telegram API недоступны напрямую, можно указать прокси через переменную `PROXY_URL`. Поддерживаемые форматы:

```env
PROXY_URL=http://user:pass@host:port
PROXY_URL=https://user:pass@host:port
PROXY_URL=socks4://host:port
PROXY_URL=socks5://user:pass@host:port
```

Если переменная не указана — бот работает в обычном режиме, без прокси.

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
`/add shroud`
3. Удали канал:
`/remove shroud`
4. Посмотри список отслеживаемых:
`/list`
5. Добавь сразу все каналы, на которые ты подписан на Twitch:
`/addall`
Бот пришлёт ссылку для авторизации через Twitch — после подтверждения все текущие подписки добавятся автоматически, а о новых подписках/отписках бот будет сообщать сам.

---

## 📁 Структура проекта

```
twitch-stream-monitor/
├── index.js              # Основной код бота
├── database.db           # SQLite БД (создаётся автоматически при первом запуске)
├── .env.example          # Пример файла с переменными окружения
├── local.env             # (опционально) локальные переопределения, не коммитить
├── docker-compose.yml    # Конфиг для Docker Compose
├── Dockerfile            # Docker-образ
├── package.json
└── data/                 # Локальное хранилище SQLite БД (при запуске через Docker)
```

---

## 🤝 Автор

@Vivers0 
Если есть идеи или нашёл баг — создавай Issue или Pull Request!

---

## 📜 Лицензия

MIT License