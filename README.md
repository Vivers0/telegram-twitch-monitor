# 🎮 Twitch Stream Monitor Bot

Telegram-бот, который отслеживает начало стримов на Twitch и присылает уведомления в Telegram.
Использует Twitch API и SQLite для хранения подписок пользователей.

---

## 📌 Функционал

- 🔔 Уведомления о начале стрима
- 🧩 Команды: `/add`, `/remove`, `/list`
- 🔗 `/addall` — авторизация через Twitch и добавление всех текущих подписок пользователя одним действием
- 🆕 Автоматическое обнаружение новых подписок на Twitch с предложением добавить канал (кнопки «Да / Нет»)
- 🚫 Автоматическое обнаружение отписок на Twitch — канал удаляется из отслеживания с уведомлением
- 🗃 Хранение данных в локальной БД (SQLite)
- 🌐 Поддержка прокси для Telegram API (HTTP/HTTPS/SOCKS4/SOCKS5)
- 🐳 Поддержка Docker и `docker-compose`

---

## 🛠 Технологии

- Node.js 22 (LTS)
- Telegraf.js (Telegram Bot Framework)
- Twitch API (Helix)
- SQLite (через `better-sqlite3`)
- Express (OAuth-колбэк для `/addall`)
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
cp example.env .env
```

Открой `.env` и заполни значения:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_client_secret
TWITCH_REDIRECT_URI=http://localhost:3000/auth/twitch/callback
PORT=3000
INTERVAL=10000
FOLLOWS_CHECK_INTERVAL=300000
DB_PATH=./data/database.db

# Опционально: прокси для запросов к Telegram API (Twitch идёт напрямую)
# Поддерживаются протоколы: http, https, socks4, socks5
# PROXY_URL=socks5://user:pass@host:port
```

- `TWITCH_REDIRECT_URI` — должен точь-в-точь совпадать со значением в Twitch Developer Console (раздел **OAuth Redirect URLs**). Используется командой `/addall`.
- `INTERVAL` — интервал проверки статуса стримов, мс.
- `FOLLOWS_CHECK_INTERVAL` — интервал проверки новых подписок/отписок, мс (по умолчанию 5 минут).

#### 🌱 Файлы окружения (`.env`, `local.env`, `<NODE_ENV>.env`)

Бот читает несколько файлов окружения с таким приоритетом (каждый следующий перекрывает предыдущий):

1. `.env` — базовый файл, читается всегда.
2. `<NODE_ENV>.env` — например `development.env` или `production.env`, подхватывается, только если задана переменная `NODE_ENV` (например, `NODE_ENV=development node index.js`).
3. `local.env` — локальные переопределения, которые не должны попадать в git; имеют наивысший приоритет.

Файл кладётся в корень проекта — туда, откуда запускается `node index.js`.

#### 🌐 Настройка прокси (опционально)

Если бот развёрнут в регионе, где Telegram API недоступен напрямую, можно указать прокси через `PROXY_URL`. Прокси применяется **только к запросам Telegram** — запросы к Twitch всегда идут напрямую.

```env
PROXY_URL=http://user:pass@host:port
PROXY_URL=socks5://user:pass@host:port
```

Если переменная не указана — бот работает без прокси.

---

### 4. Настройка Twitch-приложения

Для команды `/addall` нужен доступ к OAuth:

1. Создай приложение в [Twitch Developer Console](https://dev.twitch.tv/console/apps).
2. В разделе **OAuth Redirect URLs** добавь значение, **точно совпадающее** с `TWITCH_REDIRECT_URI` из `.env` (например, `http://localhost:3000/auth/twitch/callback` для локального теста или `https://твой-домен/auth/twitch/callback` для продакшена), нажми **Add**, затем **Save**.
3. Скопируй **Client ID** и **Client Secret** в `.env`.

> Для продакшена Twitch требует `https` в redirect URL (исключение — `localhost`). Используй reverse proxy (например, Nginx Proxy Manager) для выдачи HTTPS-домена.

---

### 5. Запуск через Docker

Проект использует базовый `docker-compose.yml` + локальный `docker-compose.override.yml`, который Compose накладывает автоматически. В репозитории лежат два примера override — выбери подходящий:

**Вариант A — reverse proxy на другой машине или без общей docker-сети** (проброс порта):

```bash
cp docker-compose.override.example.yml docker-compose.override.yml
docker compose up -d --build
```

**Вариант B — Nginx Proxy Manager в Docker на этом же сервере** (общая сеть, без публикации порта):

```bash
cp docker-compose.override.npm-network.example.yml docker-compose.override.yml
# затем подставь имя docker-сети своего NPM внутри файла
docker compose up -d --build
```

Проверить итоговую (склеенную) конфигурацию:

```bash
docker compose config
```

Бот работает в фоне, база данных сохраняется в папке `./data`.

Полезные команды:

```bash
docker compose logs -f        # логи
docker compose up -d --build  # пересборка после изменений кода
docker compose down           # остановить и удалить контейнер
```

---

## 📱 Как использовать

1. Напиши боту в Telegram: `/start`
2. Добавь канал: `/add shroud`
3. Удали канал: `/remove shroud`
4. Посмотри список отслеживаемых: `/list`
5. Добавь сразу все свои подписки Twitch: `/addall`

После `/addall` бот пришлёт ссылку для авторизации через Twitch. По подтверждению все текущие подписки добавятся автоматически, а о новых подписках/отписках бот будет сообщать сам.

---

## 📁 Структура проекта

```
twitch-stream-monitor/
├── index.js                                         # Точка входа: собирает и запускает приложение
├── src/
│   ├── config.js                                    # Загрузка env-файлов, валидация, настройки
│   ├── proxy.js                                     # Прокси-агент для Telegram API
│   ├── db/
│   │   ├── index.js                                 # Подключение к SQLite + схема таблиц
│   │   ├── subscriptions.js                         # Пользователи и отслеживаемые каналы
│   │   ├── twitchAccounts.js                        # OAuth-токены Twitch-аккаунтов
│   │   └── followedSeen.js                          # Снимок известных подписок Twitch
│   ├── twitch/
│   │   ├── auth.js                                  # Токены: app token, OAuth-обмен, refresh
│   │   └── api.js                                   # Запросы к Twitch Helix API
│   ├── bot/
│   │   ├── index.js                                 # Создание Telegram-бота
│   │   ├── commands.js                              # /start /add /remove /list /addall
│   │   ├── actions.js                               # Инлайн-кнопки «Да / Нет»
│   │   └── oauthState.js                            # Одноразовые state для OAuth-ссылок
│   ├── jobs/
│   │   ├── streamMonitor.js                         # Периодическая проверка стримов
│   │   └── followsSync.js                           # Синхронизация подписок/отписок Twitch
│   └── server/
│       └── index.js                                 # Express: OAuth-колбэк, /health
├── data/                                            # Хранилище SQLite БД (volume)
├── example.env                                      # Пример переменных окружения
├── docker-compose.yml                               # Базовая конфигурация Compose
├── docker-compose.override.example.yml              # Пример override: проброс порта
├── docker-compose.override.npm-network.example.yml  # Пример override: общая docker-сеть
├── Dockerfile
├── package.json
├── CHANGELOG.md
└── LICENSE
```

---

## 🤝 Автор

@Vivers0
Если есть идеи или нашёл баг — создавай Issue или Pull Request!

---

## 📜 Лицензия

MIT License — см. файл [LICENSE](LICENSE).
