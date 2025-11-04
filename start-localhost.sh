#!/bin/bash

# Скрипт запуска сайта DezTehUg на localhost:3000
# Использование: ./start-localhost.sh

echo "========================================"
echo "  Запуск сайта DezTehUg на localhost:3000"
echo "========================================"
echo ""

# Проверка наличия Node.js
if ! command -v node &> /dev/null; then
    echo "[ОШИБКА] Node.js не найден! Установите Node.js с https://nodejs.org"
    exit 1
fi

echo "[OK] Node.js найден: $(node --version)"

# Проверка наличия npm
if ! command -v npm &> /dev/null; then
    echo "[ОШИБКА] npm не найден! Установите Node.js с https://nodejs.org"
    exit 1
fi

echo "[OK] npm найден: $(npm --version)"
echo ""

echo "[1/3] Проверка зависимостей..."

if [ ! -d "node_modules" ]; then
    echo "[2/3] Установка зависимостей..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[ОШИБКА] Не удалось установить зависимости!"
        exit 1
    fi
    echo "[OK] Зависимости установлены!"
else
    echo "[OK] Зависимости уже установлены"
fi

echo ""
echo "[3/3] Запуск dev сервера на http://localhost:3000"
echo ""
echo "========================================"
echo "  Сервер запускается..."
echo "  Откройте браузер: http://localhost:3000"
echo "  Для остановки нажмите Ctrl+C"
echo "========================================"
echo ""

npm run dev

