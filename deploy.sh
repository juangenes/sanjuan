#!/bin/bash
# deploy.sh — ejecutar desde local: bash deploy.sh
# Requiere acceso SSH al droplet configurado como 'droplet'

set -e

echo "=== Sincronizando código al droplet ==="
rsync -avz --exclude 'node_modules' --exclude '.env' --exclude 'dist' \
  ./backend/ droplet:/var/www/sanjuan/backend/

rsync -avz --exclude 'node_modules' --exclude '.env' --exclude 'dist' \
  ./frontend/ droplet:/var/www/sanjuan/frontend/

echo "=== Instalando dependencias backend ==="
ssh droplet "cd /var/www/sanjuan/backend && npm install --production"

echo "=== Build frontend ==="
ssh droplet "cd /var/www/sanjuan/frontend && npm install && npm run build"

echo "=== Reiniciando API con PM2 ==="
ssh droplet "cd /var/www/sanjuan/backend && pm2 startOrRestart ecosystem.config.js --env production"

echo "=== Deploy completado ==="
