#!/bin/bash
# =============================================================
#  DXMOD VPS DEPLOY SCRIPT
#  Chạy script này trên VPS sau khi SSH vào:
#  ssh root@160.250.246.119
#  bash <(curl -s https://raw.githubusercontent.com/DeerXua/ADMIN-DXMOD/main/deploy.sh)
# =============================================================

set -e
VPS_DIR="/opt/dxmod"
REPO="https://github.com/DeerXua/ADMIN-DXMOD.git"
SERVICE="dxmod"

echo "=============================="
echo "  DXMOD VPS Deploy Script"
echo "=============================="

# 1. Cài Node.js 20 nếu chưa có
if ! command -v node &>/dev/null; then
    echo "[1/6] Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo "[1/6] Node.js $(node --version) already installed ✓"
fi

# 2. Cài git nếu chưa có
if ! command -v git &>/dev/null; then
    echo "[2/6] Installing git..."
    apt-get install -y git
else
    echo "[2/6] git $(git --version) already installed ✓"
fi

# 3. Cài PM2 nếu chưa có
if ! command -v pm2 &>/dev/null; then
    echo "[3/6] Installing PM2..."
    npm install -g pm2
else
    echo "[3/6] PM2 $(pm2 --version) already installed ✓"
fi

# 4. Clone hoặc pull repo
echo "[4/6] Deploying code..."
if [ -d "$VPS_DIR/.git" ]; then
    cd "$VPS_DIR"
    git pull origin main
    echo "  → Code updated via git pull"
else
    mkdir -p "$VPS_DIR"
    git clone "$REPO" "$VPS_DIR"
    echo "  → Code cloned fresh"
fi

cd "$VPS_DIR"

# 5. Tạo .env nếu chưa có
if [ ! -f "$VPS_DIR/.env" ]; then
    echo "[5/6] Creating .env file..."
    cat > "$VPS_DIR/.env" << 'ENVEOF'
PORT=3000
ADMIN_TOKEN="LeThienNhan2006@#"
JWT_SECRET="DX_JWT_SECRET_VERY_LONG_2026_@#$%"
API_KEY="DX_API_KEY_2026"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="LeThienNhan2006@#"
DB_PATH="./data/app.json"
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=15
ENVEOF
    echo "  → .env created (chỉnh sửa lại nếu cần)"
else
    echo "[5/6] .env already exists, keeping it ✓"
fi

# 6. Cài npm packages
echo "[6/6] Installing npm packages..."
npm install --omit=dev

# 7. Tạo data dir
mkdir -p "$VPS_DIR/data"

# 8. Khởi động / restart với PM2
echo ""
echo "[PM2] Starting/restarting service..."
pm2 describe "$SERVICE" &>/dev/null && pm2 restart "$SERVICE" || pm2 start src/server.js --name "$SERVICE" --cwd "$VPS_DIR"
pm2 save

# 9. Setup PM2 startup (chạy khi reboot)
pm2 startup 2>/dev/null | tail -1 | bash 2>/dev/null || true

# 10. Firewall
echo "[UFW] Allowing port 3000..."
ufw allow 3000/tcp 2>/dev/null || true
ufw allow 80/tcp   2>/dev/null || true
ufw allow 22/tcp   2>/dev/null || true

# Done
echo ""
echo "=============================="
echo "  ✅ DEPLOY COMPLETE!"
echo "=============================="
echo "  URL:    http://160.250.246.119:3000"
echo "  Admin:  http://160.250.246.119:3000/"
echo "  Health: http://160.250.246.119:3000/health"
echo ""
echo "  PM2 logs: pm2 logs $SERVICE"
echo "  PM2 status: pm2 status"
echo "=============================="
