@echo off
echo ========================================
echo   Запуск сайта DezTehUg на localhost:3000
echo ========================================
echo.

REM Проверка наличия Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ОШИБКА] Node.js не найден! Установите Node.js с https://nodejs.org
    pause
    exit /b 1
)

REM Проверка наличия npm
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ОШИБКА] npm не найден! Установите Node.js с https://nodejs.org
    pause
    exit /b 1
)

echo [1/3] Проверка зависимостей...
if not exist "node_modules" (
    echo [2/3] Установка зависимостей...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ОШИБКА] Не удалось установить зависимости!
        pause
        exit /b 1
    )
    echo [OK] Зависимости установлены!
) else (
    echo [OK] Зависимости уже установлены
)

echo [3/3] Запуск dev сервера на http://localhost:3000
echo.
echo ========================================
echo   Сервер запускается...
echo   Откройте браузер: http://localhost:3000
echo   Для остановки нажмите Ctrl+C
echo ========================================
echo.

call npm run dev

pause

