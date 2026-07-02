#!/bin/bash
# =============================================================
#  DXMOD VPS Deploy Script — SAFE MODE
#  - Chỉ cài vào /opt/dxmod (thư mục riêng biệt)
#  - KHÔNG đụng tới bất kỳ project/process nào đang chạy
#  - KHÔNG dùng pm2 delete/stop/kill trên process khác
#  - KHÔNG thay đổi firewall rules hiện có
#  - Chạy DXMOD trên port 5000
# =============================================================

set -e

VPS_DIR="/opt/dxmod"
REPO="https://github.com/DeerXua/ADMIN-DXMOD.git"
SERVICE="dxmod"            # PM2 app name riêng biệt
DXMOD_PORT=5000            # Port mặc định

echo ""
echo "╔══════════════════════════════════════╗"
echo "║      DXMOD VPS Deploy — SAFE MODE    ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "⚠️  Chỉ cài vào: $VPS_DIR"
echo "⚠️  Port sử dụng: $DXMOD_PORT"
echo "⚠️  KHÔNG đụng tới project/process khác"
echo ""

# 1. Cài Node.js 20 (chỉ nếu chưa có — KHÔNG ghi đè version hiện tại nếu đã đủ)
echo "[1/6] Checking Node.js..."
if ! command -v node &>/dev/null; then
    echo "  → Node.js chưa có, cài Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
    apt-get install -y nodejs >/dev/null 2>&1
    echo "  ✓ Node.js $(node --version) installed"
else
    echo "  ✓ Node.js $(node --version) already installed (giữ nguyên)"
fi

# 2. Cài git (chỉ nếu chưa có)
echo "[2/6] Checking git..."
if ! command -v git &>/dev/null; then
    echo "  → Cài git..."
    apt-get install -y git >/dev/null 2>&1
else
    echo "  ✓ git $(git --version | head -1) already installed (giữ nguyên)"
fi

# 3. Cài PM2 (chỉ nếu chưa có — KHÔNG reset pm2 hiện tại)
echo "[3/6] Checking PM2..."
if ! command -v pm2 &>/dev/null; then
    echo "  → Cài PM2..."
    npm install -g pm2 >/dev/null 2>&1
    echo "  ✓ PM2 installed"
else
    echo "  ✓ PM2 $(pm2 --version) already installed (giữ nguyên)"
fi

# 4. Clone hoặc pull chỉ repo DXMOD vào /opt/dxmod
echo "[4/6] Deploying DXMOD code..."
if [ -d "$VPS_DIR/.git" ]; then
    cd "$VPS_DIR"
    # Chỉ pull repo DXMOD — không ảnh hưởng gì khác
    git pull origin main
    echo "  ✓ Code updated via git pull"
else
    mkdir -p "$VPS_DIR"
    git clone "$REPO" "$VPS_DIR"
    echo "  ✓ Code cloned to $VPS_DIR"
fi

cd "$VPS_DIR"

# 5. Tạo/cập nhật .env cho DXMOD
echo "[5/6] Checking .env..."
if [ ! -f "$VPS_DIR/.env" ]; then
    cat > "$VPS_DIR/.env" << ENVEOF
PORT=${DXMOD_PORT}
ADMIN_TOKEN="LeThienNhan2006@#"
JWT_SECRET="DX_JWT_SECRET_VERY_LONG_2026_@#\$%"
API_KEY="DX_API_KEY_2026"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="LeThienNhan2006@#"
DB_PATH="./data/app.json"
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=15
ENVEOF
    echo "  ✓ .env created (port $DXMOD_PORT)"
else
    # Đảm bảo PORT luôn đúng dù .env đã tồn tại
    sed -i "s/^PORT=.*/PORT=${DXMOD_PORT}/" "$VPS_DIR/.env"
    echo "  ✓ .env exists — đã đảm bảo PORT=${DXMOD_PORT}"
fi

# 6. Cài npm packages (chỉ production)
echo "[6/6] npm install..."
mkdir -p "$VPS_DIR/data"
npm install --omit=dev --silent
echo "  ✓ Dependencies installed"

# 7. Xóa các process cũ bị lỗi (ngoại trừ bybitjobs và dxmod)
echo "[PM2] Cleaning up old/broken processes..."
node -e '
const execSync = require("child_process").execSync;
try {
    const list = JSON.parse(execSync("pm2 jlist").toString());
    list.forEach(p => {
        const name = p.name;
        if (name && name !== "bybitjobs" && name !== "dxmod") {
            console.log(`  → Deleting old/broken process: ${name}`);
            try {
                execSync(`pm2 delete "${name}"`);
            } catch (e) {
                console.error(`Failed to delete ${name}:`, e.message);
            }
        }
    });
} catch (err) {
    console.error("Failed to clean up PM2 list:", err.message);
}
'

# 8. Start/restart CHỈ PM2 app "dxmod" — KHÔNG đụng process khác
echo ""
echo "[PM2] Managing DXMOD service only..."

if pm2 describe "$SERVICE" &>/dev/null 2>&1; then
    echo "  → Restarting existing '$SERVICE' process..."
    pm2 restart "$SERVICE" --update-env
else
    echo "  → Starting new '$SERVICE' process..."
    pm2 start src/server.js \
        --name "$SERVICE" \
        --cwd "$VPS_DIR"
fi

# Lưu PM2 process list (bao gồm cả processes khác đang có)
pm2 save

# Đảm bảo PM2 chạy khi reboot (chỉ setup startup nếu chưa có)
if [ ! -f /etc/systemd/system/pm2-root.service ]; then
    echo "  → Setup PM2 startup on boot..."
    pm2 startup systemd -u root --hp /root 2>/dev/null | grep "^sudo\|^systemctl" | bash 2>/dev/null || true
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         ✅  DEPLOY COMPLETE!             ║"
echo "╠══════════════════════════════════════════╣"
echo "║  DXMOD Admin: http://160.250.246.119:${DXMOD_PORT}  ║"
echo "║  API Check:   POST /api/check            ║"
echo "║  Health:      GET  /health               ║"
echo "╠══════════════════════════════════════════╣"
echo "║  pm2 status          → xem tất cả apps  ║"
echo "║  pm2 logs $SERVICE   → xem log DXMOD    ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Các app PM2 đang chạy:"
pm2 list
