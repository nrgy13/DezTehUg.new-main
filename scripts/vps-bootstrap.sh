#!/usr/bin/env bash
# =====================================================
# Первичная настройка VPS Beget (Ubuntu 24.04)
# Запускать ОТ ROOT после первичного логина
#
# Что делает:
#   - apt update + upgrade
#   - swap-файл 4GB
#   - ufw firewall (открывает 22, 80, 443)
#   - Docker + Docker Compose
#   - timezone Europe/Moscow
#   - создаёт docker network "web" для Traefik
# =====================================================
set -euo pipefail

echo "▶ apt update & upgrade..."
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y

echo "▶ Базовые пакеты..."
apt-get install -y \
  ca-certificates curl gnupg lsb-release \
  htop vim ufw fail2ban \
  unzip git tzdata

echo "▶ Timezone Europe/Moscow..."
timedatectl set-timezone Europe/Moscow

echo "▶ Swap-файл 4GB..."
if ! swapon --show | grep -q '/swapfile'; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo 'vm.swappiness=10' >> /etc/sysctl.conf
  sysctl -p
fi

echo "▶ UFW firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable

echo "▶ Docker..."
if ! command -v docker &>/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

echo "▶ Docker network 'web' (для Traefik)..."
if ! docker network ls --format '{{.Name}}' | grep -q '^web$'; then
  docker network create web
fi

echo "▶ /opt/deztech-crm/ — рабочая директория..."
mkdir -p /opt/deztech-crm
mkdir -p /opt/deztech-crm/backups

echo ""
echo "✅ VPS готов к деплою!"
echo ""
echo "Проверка:"
docker --version
docker compose version
ufw status
free -h | grep -i swap
echo ""
echo "Дальше:"
echo "  1. Залить код в /opt/deztech-crm/"
echo "  2. Создать /opt/deztech-crm/.env по образцу .env.production.example"
echo "  3. cd /opt/deztech-crm && docker compose -f docker-compose.prod.yml up -d --build"
