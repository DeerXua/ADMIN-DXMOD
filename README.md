# ADMIN-DXMOD — VPS License Control Panel

Hệ thống quản lý giấy phép VIP theo UID cho game PUBG Mobile.

## Tính năng
- 🔐 Đăng nhập admin bằng JWT
- ✅ API kiểm tra UID (`POST /api/check`)
- 👥 Quản lý UID: thêm, sửa, xoá, phân trang, tìm kiếm
- 📋 Access log thông minh (Debounced & Match-focused): Chỉ lưu nhật ký khi có sự thay đổi trạng thái (Approved, Blocked...) hoặc khi người chơi bắt đầu vào trận đấu (`method: "enter-match"`), giúp tránh làm trôi nhật ký của người dùng khác.
- 🔌 Tab API Info + code Lua mẫu
- 🛡️ Rate limiting chống spam
- 🌐 Sử dụng **`http_manager` nội bộ của game** để gửi request HTTP POST, chạy an toàn và ổn định mà không phụ thuộc vào `os.execute` (vốn đã bị game vô hiệu hóa hoàn toàn).

## Deploy lên VPS

> ⚠️ Script này **KHÔNG đụng tới** project đang chạy trên VPS.  
> DXMOD chạy trên **port 5000** mặc định.

```bash
# SSH vào VPS
ssh root@YOUR_VPS_IP

# Chạy 1 lệnh deploy hoàn toàn tự động
curl -fsSL https://raw.githubusercontent.com/DeerXua/ADMIN-DXMOD/main/deploy.sh | bash
```

Sau khi chạy xong:
- **Admin Panel**: `http://YOUR_VPS_IP:5000/`
- **API Check**: `POST http://YOUR_VPS_IP:5000/api/check`

## Cấu hình `.env`

```env
PORT=5000
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="your_password"
JWT_SECRET="your_jwt_secret"
API_KEY="DX_API_KEY_2026"
```

## API Endpoints

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/health` | Health check |
| POST | `/api/check` | Kiểm tra UID (từ Lua, nhận các tham số `uid`, `apiKey`, `method`) |
| POST | `/api/admin/login` | Đăng nhập → JWT |
| GET | `/api/admin/users` | Danh sách UID |
| POST | `/api/admin/users` | Thêm UID |
| PUT | `/api/admin/users/:uid` | Cập nhật UID |
| DELETE | `/api/admin/users/:uid` | Xoá UID |
| GET | `/api/admin/logs` | Access logs |

## Tích hợp Lua (Kiểu mới không cần `os.execute`)

Trong `BRPlayerCharacterBase.lua`, nạp thư viện mạng của game và gọi API check:

```lua
-- Gọi API kiểm tra bản quyền
function _G.DX_CheckUIDWithAdminVPS(customMethod)
    local now = os.time()
    local interval = 60 -- Mặc định 60s check 1 lần nếu đã APPROVED
    if not _G.DX_UIDStatus or _G.DX_UIDStatus.status ~= "approved" then
        interval = 10 -- 10s check 1 lần nếu chưa APPROVED
    end

    -- Bỏ qua giới hạn thời gian nếu là check khi vào trận đấu (enter-match)
    local isMatchCheck = (customMethod == "enter-match")
    if not isMatchCheck then
        if _G.LastDXCheckTime and (now - _G.LastDXCheckTime) < interval then
            return
        end
        _G.LastDXCheckTime = now
    end

    local uid = _G.DX_GetLocalGameUID()
    if not uid or uid == "" then return end

    local ModuleManager = require("client.module_framework.ModuleManager")
    local http_manager = ModuleManager.GetModule(ModuleManager.CommonModuleConfig.http_manager)
    if not http_manager then return end

    local url = "http://YOUR_VPS_IP:5000/api/check"
    local post_header = { ["Content-Type"] = "application/json" }
    local reqMethod = customMethod or "check"
    local post_content = string.format('{"uid":"%s","apiKey":"DX_API_KEY_2026","method":"%s"}', uid, reqMethod)

    local function onResponse(success, data)
        if success and data and #data > 0 then
            -- Ghi đè bộ nhớ đệm
            local f = io.open("/sdcard/Android/data/com.vng.pubgmobile/files/dx_uid_resp.txt", "w")
            if f then f:write(data) f:close() end

            -- Xử lý phân tích kết quả trả về để cập nhật trạng thái UI
            -- ...
        end
    end

    http_manager:Post(url, post_header, post_content, nil, onResponse)
end
```

### Các sự kiện cần kích hoạt:
1. **Khi vào trận đấu (Lớp nhân vật được khởi tạo)**: Gọi `_G.DX_CheckUIDWithAdminVPS("enter-match")` bên trong hàm `StartAdvancedSystems()` để ghi nhận log trận đấu mới trên trang quản trị.
2. **Khi mở Menu cài đặt (Lobby/In-game)**: Gọi `_G.DX_CheckUIDWithAdminVPS()` để kiểm tra tức thời.
3. **Vòng lặp tự động (AddGameTimer)**: Đếm nhịp chạy ngầm định kỳ mỗi 10s-60s để tự động thu hồi/cấp phát quyền khi Admin chỉnh sửa trên bảng quản lý.
