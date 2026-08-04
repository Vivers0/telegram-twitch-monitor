# Официальный образ Node.js (LTS)
FROM node:22

# Рабочая директория внутри контейнера
WORKDIR /usr/src/app

# Сначала манифесты — для кеширования слоя с зависимостями
COPY package*.json ./

# Только production-зависимости
RUN npm ci --only=production

# Остальные файлы проекта
COPY . .

# Каталог для персистентной БД (монтируется как volume)
RUN mkdir -p data

# Путь к файлу БД (переопределяется переменной окружения DB_PATH)
ENV DB_PATH=./data/database.db

# Порт, который слушает приложение внутри контейнера (совпадает с PORT)
EXPOSE 3000

# Запуск
CMD ["node", "index.js"]
