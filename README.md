# ADMIN-DXMOD — VPS License Control Panel

Hệ thống quản lý giấy phép VIP theo UID cho game PUBG Mobile.

## Tính năng
- 🔐 Đăng nhập admin bằng JWT
- ✅ API kiểm tra UID (`POST /api/check`)
- 👥 Quản lý UID: thêm, sửa, xoá, phân trang, tìm kiếm
- 📋 Access log realtime
- 🔌 Tab API Info + code Lua mẫu
- 🛡️ Rate limiting chống spam

## Deploy lên VPS

> ⚠️ Script này **KHÔNG đụng tới** project đang chạy trên VPS.  
> DXMOD chạy trên **port 4000** để tránh xung đột.

```bash
# SSH vào VPS
ssh root@YOUR_VPS_IP

# Chạy 1 lệnh deploy hoàn toàn tự động
curl -fsSL https://raw.githubusercontent.com/DeerXua/ADMIN-DXMOD/main/deploy.sh | bash
```

Sau khi chạy xong:
- **Admin Panel**: `http://YOUR_VPS_IP:4000/`
- **API Check**: `POST http://YOUR_VPS_IP:4000/api/check`

## Cấu hình `.env`

```env
PORT=4000
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="your_password"
JWT_SECRET="your_jwt_secret"
API_KEY="DX_API_KEY_2026"
```

## API Endpoints

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/health` | Health check |
| POST | `/api/check` | Kiểm tra UID (từ Lua) |
| POST | `/api/admin/login` | Đăng nhập → JWT |
| GET | `/api/admin/users` | Danh sách UID |
| POST | `/api/admin/users` | Thêm UID |
| PUT | `/api/admin/users/:uid` | Cập nhật UID |
| DELETE | `/api/admin/users/:uid` | Xoá UID |
| GET | `/api/admin/logs` | Access logs |

## Tích hợp Lua

Trong `BRPlayerCharacterBase.lua`, thay `YOUR_VPS_IP` bằng IP thật:

```lua
local VPS_API_URL = "http://YOUR_VPS_IP:4000/api/check"
local VPS_API_KEY = "DX_API_KEY_2026"
```
