#!/bin/bash

echo "Updating Termux..."
pkg update && pkg upgrade -y

echo "Installing required packages..."
pkg install nodejs-lts git redis postgresql tsu unzip wget nano -y

echo "Initializing PostgreSQL..."
initdb $PREFIX/var/lib/postgresql
pg_ctl -D $PREFIX/var/lib/postgresql start

echo "Creating PostgreSQL user and database..."
createuser tiktok_user --pwprompt
createdb -O tiktok_user tiktok

echo "Starting Redis server..."
redis-server --daemonize yes

echo "Installing ngrok..."
wget https://bin.equinox.io/c/4VmDzA7iaHb/ngrok-stable-linux-arm.zip -O ngrok.zip
unzip ngrok.zip
chmod +x ngrok

echo "============================================"
echo "DONE ✅"
echo "Next Steps:"
echo "1️⃣ ./ngrok config add-authtoken ISI_TOKEN_NGROK_DISINI"
echo "2️⃣ ./ngrok http 3000"
echo "3️⃣ Update .env with your TikTok client ID/secret and ngrok URL"
echo "4️⃣ npm install"
echo "5️⃣ npm run dev"
echo "============================================"
