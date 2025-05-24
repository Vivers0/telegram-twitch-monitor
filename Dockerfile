# Используем официальный образ Node.js
FROM node:20

# Устанавливаем рабочую директорию внутри контейнера
WORKDIR /usr/src/app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production

# Копируем остальные файлы
COPY . .

# Убедимся, что база данных может сохраняться
RUN mkdir -p data
ENV SQLITE_DATABASE_PATH=./database.db

# Устанавливаем порт, который будет слушать приложение
EXPOSE 22962

# Команда для запуска приложения
CMD ["node", "index.js"]