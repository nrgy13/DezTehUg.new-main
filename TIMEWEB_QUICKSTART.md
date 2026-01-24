# 🚀 Быстрый старт: Деплой на TimeWeb.cloud

## Шаг 1: Подготовка сервера (5 минут)

```bash
# Подключитесь к серверу TimeWeb.cloud через SSH
ssh username@your-server-ip

# Установите Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Установите PM2
sudo npm install -g pm2

# Создайте директорию для деплоя
sudo mkdir -p /var/www/deztechug
sudo chown -R $USER:$USER /var/www/deztechug
```

## Шаг 2: Настройка SSH ключа (3 минуты)

```bash
# На вашем локальном компьютере создайте SSH ключ
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/timeweb_deploy

# Скопируйте публичный ключ на сервер
cat ~/.ssh/timeweb_deploy.pub | ssh username@your-server-ip "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"

# Скопируйте приватный ключ (понадобится для GitHub)
cat ~/.ssh/timeweb_deploy
```

## Шаг 3: Настройка GitHub Secrets (2 минуты)

1. Откройте ваш репозиторий на GitHub
2. Перейдите в **Settings** → **Secrets and variables** → **Actions**
3. Добавьте следующие секреты:

| Секрет | Значение | Пример |
|--------|----------|--------|
| `TIMEWEB_HOST` | IP или домен сервера | `123.45.67.89` |
| `TIMEWEB_USERNAME` | SSH пользователь | `root` |
| `TIMEWEB_SSH_KEY` | Приватный SSH ключ | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `TIMEWEB_DEPLOY_PATH` | Путь на сервере | `/var/www/deztechug` |
| `TIMEWEB_SSH_PORT` | Порт SSH (опционально) | `22` |

## Шаг 4: Первый деплой (автоматически)

```bash
# Сделайте commit и push в ветку main
git add .
git commit -m "Настройка деплоя на TimeWeb.cloud"
git push origin main
```

GitHub Actions автоматически:
- ✅ Соберет приложение
- ✅ Загрузит на сервер
- ✅ Запустит через PM2

## Шаг 5: Настройка PM2 на сервере (опционально)

```bash
# Подключитесь к серверу
ssh username@your-server-ip
cd /var/www/deztechug

# Создайте ecosystem.config.js
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'deztechug',
    script: 'server.js',
    cwd: '/var/www/deztechug',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      HOSTNAME: '0.0.0.0'
    }
  }]
};
EOF

# Запустите PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Следуйте инструкциям
```

## Шаг 6: Настройка Nginx (опционально, для домена)

```bash
# Установите Nginx
sudo apt install nginx -y

# Создайте конфигурацию
sudo nano /etc/nginx/sites-available/deztechug
```

Вставьте:

```nginx
server {
    listen 80;
    server_name ваш-домен.ru www.ваш-домен.ru;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Активируйте конфигурацию
sudo ln -s /etc/nginx/sites-available/deztechug /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## ✅ Готово!

Теперь каждый push в `main` автоматически деплоит сайт на TimeWeb.cloud!

### Проверка работы:

```bash
# Проверьте статус PM2
pm2 status

# Проверьте логи
pm2 logs deztechug

# Откройте сайт в браузере
# http://your-server-ip:3000 или http://your-domain.ru
```

## 🆘 Проблемы?

Смотрите подробную документацию в [TIMEWEB_DEPLOYMENT.md](./TIMEWEB_DEPLOYMENT.md)

---

**Время настройки: ~15 минут** ⏱️
