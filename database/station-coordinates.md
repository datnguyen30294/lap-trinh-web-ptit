# Tọa độ bến demo Hà Nội

`stations.latitude` và `stations.longitude` là tọa độ WGS84 dạng độ thập phân. Cả hai có thể `NULL` đối với bến do người dùng tạo nhưng chưa có vị trí. Khi có giá trị, cả hai phải nằm trong khoảng hợp lệ. Backend trả về chuỗi thập phân (kiểu `DECIMAL` của MySQL); frontend đổi bằng `Number(...)` khi đưa vào thư viện bản đồ.

19 vị trí trong [hanoi-station-coordinates.json](hanoi-station-coordinates.json) được đối chiếu với các địa điểm trên OpenStreetMap qua Mapcarta và Geoview. Mỗi mục có liên kết nguồn riêng. Các mã `HN-NTS`, `HN-SVD`, `HN-NT`, `HN-HDT` và `HN-TV` là **điểm đại diện trong khu vực** vì seed chỉ ghi giao lộ, sân vận động hoặc đường, không xác định một cột biển xe buýt duy nhất. Chúng phù hợp để demo tìm tuyến và đặt marker, chưa đủ chính xác để chỉ đường đi bộ tới đúng cửa lên xe. Đường đi thực tế cần lấy riêng từ dịch vụ định tuyến, không nối thẳng các marker.

Database mới sau `node database/scripts/setup-local.mjs` nhận tọa độ từ `01-schema.sql` và `02-seed-hanoi.sql`. Máy đã có database sẽ không được `setup-local` nạp lại seed. Từ thư mục gốc project, sau khi bảo đảm `.env` trỏ đúng database ứng dụng và backend đã `npm install`, chạy **một lần**:

```bash
node database/migrations/006-station-coordinates.mjs
```

Migration tạo bản sao JSON của các bảng trong `.local/backups/` (thư mục bị Git bỏ qua), thêm cột nếu thiếu, rồi chỉ điền tọa độ cho mã bến demo đang có **cả hai cột trống**. Tọa độ đã được sửa bằng tay, dữ liệu bến khác, tuyến, lịch và vé được giữ nguyên. Chạy lại an toàn; không cần xóa Docker volume. Kiểm tra bằng:

```sql
SELECT code, name, latitude, longitude FROM stations ORDER BY code;
```

Tọa độ chỉ định vị các bến trên bản đồ; `route_stops.km_from_origin` trong dữ liệu demo vẫn là số km ước lượng, không được tính lại từ khoảng cách đường chim bay giữa hai tọa độ.
