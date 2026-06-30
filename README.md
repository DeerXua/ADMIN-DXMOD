# ADMIN-DXMOD (Máy chủ quản trị cấp phép & tải code từ xa)

Dự án này là máy chủ quản lý thiết bị (`machineId`) và cấp phát mã nguồn bảo mật (`protected_script.lua`) từ xa cho game client.

## 🚀 Hướng dẫn cài đặt nhanh trên VPS

### 1. Cấu hình môi trường (`.env`)
Tạo file `.env` tại thư mục gốc của dự án:
```env
PORT=8080
ADMIN_TOKEN=nhap_key_bi_mat_cua_ban_tai_day
DB_PATH=./data/app.json
```

### 2. Cài đặt và khởi chạy với PM2
```bash
# Di chuyển vào thư mục dự án
cd /root/ADMIN-DXMOD

# Cài đặt thư viện dependencies
npm install --omit=dev

# Tạo thư mục lưu trữ data thiết bị
mkdir -p data

# Đưa protected_script.lua vào thư mục gốc của dự án
# (Bản script này sẽ được mã hóa XOR tự động khi truyền về game client)

# Khởi chạy bằng PM2
pm2 start src/server.js --name admin-dxmod
pm2 save
```

### 3. Cách lấy script test từ cổng 8080
Nếu bạn muốn thử nghiệm việc xác thực qua API, sử dụng lệnh `curl` đính kèm ID thiết bị:
```bash
# Đăng ký thiết bị (trạng thái pending)
curl -X POST -H "Content-Type: application/json" -d '{"machineId":"TEST_DEVICE_01","label":"May Test 1"}' http://localhost:8080/api/devices/register

# Lấy script đã mã hóa (Chỉ thành công khi thiết bị đã được duyệt "approved" trong data/app.json)
curl "http://localhost:8080/api/load-script?machineId=TEST_DEVICE_01"
```

## 🔒 Cơ chế bảo mật
*   **Mã hóa XOR**: Tự động mã hóa tệp tin `protected_script.lua` thành mã Hex-XOR trước khi truyền đi để ngăn chặn hành vi bắt gói tin (Sniffing) qua HTTP.
*   **Xác thực thiết bị**: Chỉ các thiết bị có `machineId` được Admin duyệt (`approved`) mới được phép tải về mã nguồn của Mod.
