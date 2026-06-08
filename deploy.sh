#!/bin/bash
set -e

SERVER_IP="103.247.11.124"
REPO_URL="https://github.com/magsikastudio-droid/workspace-magsika.git"
APP_DIR="/root/admin-dashboard"
MONGO_URI="mongodb+srv://magsika_db_user:!V0belajar@dashboard.sm0iurn.mongodb.net/?appName=Dashboard"

echo "=== [1/7] Update sistem ==="
apt update -y && apt upgrade -y

echo "=== [2/7] Install dependencies ==="
apt install -y git python3 python3-venv python3-pip nginx curl

echo "=== Install Node.js 18 ==="
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

echo "=== [3/7] Clone / update repo ==="
if [ -d "$APP_DIR" ]; then
    cd "$APP_DIR" && git pull
else
    git clone "$REPO_URL" "$APP_DIR"
fi

echo "=== [4/7] Setup backend ==="
cd "$APP_DIR/backend"
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")

cat > .env << EOF
SECRET_KEY=$SECRET_KEY
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
MONGODB_URI=$MONGO_URI
DB_NAME=admin_dashboard
ALLOWED_ORIGINS=http://$SERVER_IP
EOF

echo "=== Setup systemd service ==="
cat > /etc/systemd/system/admin-dashboard.service << EOF
[Unit]
Description=Admin Dashboard Backend
After=network.target

[Service]
WorkingDirectory=$APP_DIR/backend
ExecStart=$APP_DIR/backend/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8001
Restart=always
RestartSec=3
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable admin-dashboard
systemctl restart admin-dashboard
sleep 2
systemctl status admin-dashboard --no-pager

echo "=== [5/7] Build frontend ==="
cd "$APP_DIR/frontend"

cat > .env << EOF
VITE_BACKEND_URL=http://$SERVER_IP/api
EOF

npm install --legacy-peer-deps
npm run build

echo "=== [6/7] Konfigurasi Nginx ==="
cat > /etc/nginx/sites-available/admin-dashboard << EOF
server {
    listen 80;
    server_name $SERVER_IP;

    root $APP_DIR/frontend/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8001/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF

ln -sf /etc/nginx/sites-available/admin-dashboard /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "=== [7/7] SELESAI ==="
echo ""
echo "App berjalan di: http://$SERVER_IP"
echo "Login: admin / password"
echo ""
systemctl status admin-dashboard --no-pager
