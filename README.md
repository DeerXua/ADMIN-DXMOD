# ADMIN-DXMOD

Source web admin quản lý license thiết bị dạng tổng quát, sẵn sàng đưa lên VPS.

## Chức năng

- Thiết bị gọi API đăng ký `machineId`.
- Admin xem danh sách thiết bị gửi về.
- Admin duyệt, chặn, đưa về chờ duyệt hoặc đặt hạn 30 ngày.
- API kiểm tra trạng thái license theo `machineId`.
- Lưu dữ liệu bằng JSON trong thư mục `data/`, không cần database server riêng.

## Chạy local

```bash
npm install
cp .env.example .env
npm start
```

Mở `http://localhost:3000`, nhập `ADMIN_TOKEN` trong file `.env`.

## API public

Đăng ký thiết bị:

```http
POST /api/devices/register
Content-Type: application/json

{
  "machineId": "DEVICE-ID-123",
  "label": "Tên người dùng hoặc ghi chú"
}
```

Kiểm tra license:

```http
GET /api/licenses/check?machineId=DEVICE-ID-123
```

Response mẫu:

```json
{
  "machineId": "DEVICE-ID-123",
  "status": "approved",
  "active": true,
  "expiresAt": "2026-08-01T00:00:00.000Z"
}
```

## API admin

Tất cả API admin dùng header:

```http
Authorization: Bearer <ADMIN_TOKEN>
```

Danh sách thiết bị:

```http
GET /api/admin/devices
GET /api/admin/devices?status=pending
```

Cập nhật trạng thái:

```http
PATCH /api/admin/devices/1
Content-Type: application/json

{
  "status": "approved",
  "expiresAt": "2026-08-01T00:00:00.000Z",
  "note": "Đã thanh toán"
}
```

Xoá thiết bị:

```http
DELETE /api/admin/devices/1
```

## Deploy VPS nhanh

```bash
git clone https://github.com/DeerXua/ADMIN-DXMOD.git
cd ADMIN-DXMOD
npm install --omit=dev
cp .env.example .env
nano .env
npm start
```

Khuyến nghị chạy sau Nginx reverse proxy và đặt `ADMIN_TOKEN` dài, khó đoán.
