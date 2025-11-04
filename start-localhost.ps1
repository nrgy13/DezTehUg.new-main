# Скрипт запуска сайта DezTehUg на localhost:3000
# Использование: .\start-localhost.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Запуск сайта DezTehUg на localhost:3000" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Проверка наличия Node.js
try {
    $nodeVersion = node --version
    Write-Host "[OK] Node.js найден: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ОШИБКА] Node.js не найден! Установите Node.js с https://nodejs.org" -ForegroundColor Red
    Read-Host "Нажмите Enter для выхода"
    exit 1
}

# Проверка наличия npm
try {
    $npmVersion = npm --version
    Write-Host "[OK] npm найден: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "[ОШИБКА] npm не найден! Установите Node.js с https://nodejs.org" -ForegroundColor Red
    Read-Host "Нажмите Enter для выхода"
    exit 1
}

Write-Host ""
Write-Host "[1/3] Проверка зависимостей..." -ForegroundColor Yellow

if (-not (Test-Path "node_modules")) {
    Write-Host "[2/3] Установка зависимостей..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ОШИБКА] Не удалось установить зависимости!" -ForegroundColor Red
        Read-Host "Нажмите Enter для выхода"
        exit 1
    }
    Write-Host "[OK] Зависимости установлены!" -ForegroundColor Green
} else {
    Write-Host "[OK] Зависимости уже установлены" -ForegroundColor Green
}

Write-Host ""
Write-Host "[3/3] Запуск dev сервера на http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Сервер запускается..." -ForegroundColor Cyan
Write-Host "  Откройте браузер: http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Для остановки нажмите Ctrl+C" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

npm run dev

