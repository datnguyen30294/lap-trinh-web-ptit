# Database GoBus — dùng cho ứng dụng hiện tại

Bộ SQL hiện tại khớp NestJS và database `gobus_hanoi_student`: có `vehicles`, `schedules.vehicle_id`, `bookings.passenger_name`. Git chứa cấu trúc và dữ liệu mẫu; không chứa Docker volume, `.env`, tài khoản hoặc dữ liệu riêng trên máy thành viên.

## Máy mới sau khi clone

Cài Node.js 24+ và Docker Desktop, mở Docker Desktop rồi chạy từ thư mục gốc project:

```bash
node database/scripts/setup-local.mjs
```

Lệnh dùng được trên Windows, macOS và Linux, không cần cài MySQL riêng hoặc Python. Nó:

1. Tạo `.env` từ `.env.example` nếu chưa có, tạo SESSION_SECRET ngẫu nhiên riêng. Nếu `.env` đã có thì giữ cấu hình; chỉ bổ sung SESSION_SECRET khi còn trống.
2. Khởi động MySQL 8.4, chờ server TCP sẵn sàng sau khi import xong.
3. Volume mới: Docker tự nhập schema, seed và views. Volume đã có nhưng database được chọn chưa có bảng: khởi tạo riêng database đó và cấp quyền cho tài khoản ứng dụng.
4. Database tương thích đã có: giữ nguyên schema và dữ liệu, không nạp lại seed. Database không tương thích: dừng với tên bảng/cột còn thiếu, không ghi đè.

Sau đó mở hai terminal:

```bash
# Terminal backend, từ gốc project
cd backend
npm ci
npm run start:dev
```

```bash
# Terminal frontend, từ gốc project
cd frontend
npm ci
npm run dev
```

Mở http://localhost:5173/login. Nếu đổi WEB_ORIGIN hoặc PORT, khởi động lại frontend/backend.

## Kết nối bằng DBeaver hoặc MySQL Workbench

| Trường | Mặc định cho máy mới |
| --- | --- |
| Host | `127.0.0.1` |
| Port | `3309` (không phải 3306 trên máy host) |
| Database | `gobus_hanoi_student` |
| User | `gobus` |
| Password | Giá trị `DB_PASSWORD` trong `.env` của máy đó |
| Charset | `utf8mb4` |

Docker dùng cổng 3306 **bên trong container**, ánh xạ ra DB_PORT trên máy host. `127.0.0.1` của mỗi người là máy của người đó, không kết nối vào database trên máy người tạo project.

Mở CLI trong container (nhập DB_PASSWORD khi được hỏi):

```bash
docker compose exec mysql mysql -u gobus -p gobus_hanoi_student
```

Nếu đã thay DB_NAME hoặc DB_USER, dùng giá trị tương ứng trong `.env`. Compose đọc cả hai giá trị này, các SQL không còn câu `USE` cố định.

## Thành viên đã chạy bộ SQL cũ

Nếu `.env` đang trỏ tới `gobus_hanoi_erd` và báo thiếu `vehicles`, `vehicle_id` hoặc `passenger_name`:

1. Giữ nguyên database cũ để bảo toàn dữ liệu.
2. Đặt `DB_NAME=gobus_hanoi_student` trong `.env` (hoặc tên database mới chưa có dữ liệu nếu tên đó đã tồn tại nhưng không tương thích).
3. Giữ đúng mật khẩu đã dùng khi tạo volume, chạy lại `node database/scripts/setup-local.mjs`.

Lệnh sẽ tạo database ứng dụng riêng ngay trong volume hiện có và cấp quyền cho DB_USER. Đây là khởi tạo dữ liệu demo mới, **không tự chuyển lịch sử hoặc tài khoản từ schema ERD cũ**.

Máy đang dùng database ứng dụng tương thích không cần đổi DB_NAME hay chạy migration mới. Giữ nguyên dữ liệu đang làm việc. Các migration `004-stations-module.mjs` và `005-routes-module.mjs` chỉ dùng cho bản ứng dụng cũ thiếu cột trạng thái hoặc phút hành trình; chúng không chuyển đổi schema ERD sang schema có vehicles.

Không dùng `docker compose down -v` hoặc xóa database để xử lý lỗi cài đặt. Thay MYSQL_DATABASE/MYSQL_PASSWORD trong Compose không tự sửa dữ liệu/tài khoản đã có trong volume.

## Khởi tạo thủ công, không dùng Docker

Cần MySQL 8.4; trong Workbench dùng tài khoản có quyền tạo database:

```sql
CREATE DATABASE gobus_hanoi_student CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE gobus_hanoi_student;
```

Giữ database này được chọn rồi chạy lần lượt `01-schema.sql`, `02-seed-hanoi.sql`, `03-views.sql` trên một database trống. Hoặc với MySQL CLI:

```bash
mysql -u root -p gobus_hanoi_student < database/01-schema.sql
mysql -u root -p gobus_hanoi_student < database/02-seed-hanoi.sql
mysql -u root -p gobus_hanoi_student < database/03-views.sql
```

Trên PowerShell, có thể dùng Workbench hoặc lệnh `SOURCE` trong MySQL CLI thay cho chuyển hướng `<`. Cấu hình `.env` theo host/port/user thật và tạo SESSION_SECRET bằng hướng dẫn trong `.env.example`. `CREATE TABLE IF NOT EXISTS` không phải công cụ migration: không import bộ này lên database khác cấu trúc đã có dữ liệu.

## Cấu trúc và dữ liệu mẫu

| Bảng | Vai trò | Số hàng khi khởi tạo |
| --- | --- | ---: |
| users | Tài khoản ADMIN/USER, mật khẩu bcrypt, trạng thái | 3 |
| stations | Bến và điểm dừng | 19 |
| routes | Tuyến một chiều, bến đầu/cuối, giờ hoạt động | 6 |
| route_stops | Thứ tự, km và phút từ đầu tuyến | 40 |
| vehicles | Mã xe, sức chứa | 6 |
| schedules | Lịch chuyến liên kết tuyến và xe | 504 |
| bookings | Một vé/một hành khách, lưu giá tại thời điểm đặt | 3 |

Bốn view: `v_route_details`, `v_schedule_details`, `v_segment_availability`, `v_booking_details`. `04-example-queries.sql` có ví dụ chỉ đọc, tính giá minh họa từ km thay cho bảng fares không còn trong mô hình ứng dụng.

- `users.phone` tùy chọn; `users.is_active` và `stations.is_active` có mặc định true; `routes.status` có mặc định ACTIVE.
- `route_stops.minutes_from_origin` cho phép NULL để tương thích dữ liệu cũ. Dữ liệu demo mới luôn có phút đầy đủ; backend chặn tạo lịch khi chưa biết thời lượng.
- `schedules.vehicle_id` liên kết `vehicles`; giữ unique `(vehicle_id, departure_at)` kể cả chuyến đã hủy.
- `bookings.passenger_name` là tên hành khách. `unit_price` là giá đã chốt, không tính lại khi dữ liệu tuyến thay đổi.
- DATETIME lưu UTC, giao diện hiển thị giờ Việt Nam. Tính chỗ trống theo từng đoạn giao nhau, không lấy sức chứa trừ toàn bộ vé của chuyến.
- TypeORM `synchronize: false`. Schema mới đối chiếu với cấu trúc database ứng dụng, không xuất dữ liệu riêng hoặc bộ đếm AUTO_INCREMENT từ máy phát triển.
- `source/CSDL.drawio.svg` giữ làm tài liệu ERD gốc; nó chưa phản ánh mô hình triển khai hiện tại có vehicles và không có fares.

### Đăng nhập demo trên database mới

| Email | Vai trò | Mật khẩu demo |
| --- | --- | --- |
| admin@gobus.local | ADMIN | GoBusAdmin2026! |
| an@gobus.local | USER | GoBusUser2026! |
| binh@gobus.local | USER | GoBusUser2026! |

Đây là tài khoản mẫu công khai dùng cho bài tập. Bộ SQL chứa hash bcrypt cost 12; không xuất hash/tài khoản trên database riêng. `.env.example` đã có các TEST_* tương ứng để chạy bộ kiểm thử trên database mới.

Dữ liệu tuyến 02, 26, BRT01 gồm các điểm tiêu biểu ở Hà Nội, mỗi tuyến có chiều DI/VE riêng. Km, phút, giờ hoạt động 05:00–22:00, xe, sức chứa và giá `ROUND(4000 + 500 × km_chặng, 0)` là dữ liệu học tập, không phải dữ liệu vận hành hay giá chính thức. Lịch demo bắt đầu từ ngày mai theo giờ Việt Nam, kéo dài 14 ngày, 6 chuyến/ngày/chiều, không chồng giờ của cùng xe. Ba vé mẫu gồm hai vé xác nhận và một vé hủy.

Seed có thể chạy lặp trên database demo chưa sửa hành trình, không ghi đè các hàng đã có; chạy vào ngày khác có thể bổ sung lịch mới. `setup-local.mjs` luôn bỏ qua seed nếu database không trống. `scripts/refresh-demo.sh` chỉ dành cho database demo của Compose, không dùng để migration hay nạp dữ liệu vào database làm việc đã sửa tuyến.

## Chẩn đoán nhanh

| Lỗi | Kiểm tra |
| --- | --- |
| Không kết nối Docker | Mở Docker Desktop, đợi engine chạy |
| ECONNREFUSED / connection refused | MySQL chưa sẵn sàng, sai DB_PORT; chạy `docker compose ps` |
| Unknown database | Sai DB_NAME hoặc database chưa được tạo trên máy này; dùng setup-local |
| Access denied | Sai DB_USER/DB_PASSWORD hoặc mật khẩu volume cũ khác `.env` |
| Thiếu vehicles/vehicle_id/passenger_name | Đang dùng schema ERD cũ; xem hướng dẫn database đã tồn tại |
| SESSION_SECRET thiếu | Chạy setup-local hoặc bổ sung secret ít nhất 32 ký tự |
| Backend chạy nhưng frontend không đăng nhập | Dùng đúng `http://localhost:5173` theo WEB_ORIGIN |

Xem log bằng `docker compose logs --tail=80 mysql`. Không gửi `.env` hoặc mật khẩu lên Git; khi nhờ hỗ trợ chỉ gửi thông báo lỗi đã bỏ thông tin bí mật.

## Kiểm chứng

Xem [báo cáo khởi tạo database mới](../docs/database-bootstrap-verification.md). Bộ kiểm thử ứng dụng: `npm run test:e2e` trong backend, yêu cầu MySQL và TEST_* đúng. Dữ liệu demo nằm trong Git; muốn các thành viên nhận thay đổi cần commit/push các file mới rồi họ pull.

## Nguồn địa danh và tuyến

Tra cứu ngày 27/09/2026. Chỉ sử dụng tên và thứ tự hành lang/điểm tiêu biểu; không lấy lịch tạm thời hay giá cũ trên trang làm dữ liệu vận hành.

1. [Transerco — Xí nghiệp xe buýt nhanh BRT Hà Nội](https://transerco.com.vn/vi/xi-nghiep-bus-nhanh-brt-ha-noi/xi-nghiep-xe-buyt-nhanh-brt-ha-noi.html): xác nhận tuyến 02, BRT01 và đầu mối Kim Mã, Yên Nghĩa.
2. [Lotrinh.vn — Tuyến 02](https://lotrinh.vn/tourl/20_Lotrinh_xe_bus_ha_noi/default.aspx): hành lang Bác Cổ, Tràng Thi, Ngã Tư Sở, Hà Đông, Yên Nghĩa.
3. [Lotrinh.vn — Tuyến 26](https://lotrinh.vn/tourl/47_Lotrinh_Xe_Bus_Ha_Noi,_Tuyen_26_Mai_Dong_SVD_Quoc_Gia.aspx): hành lang Mai Động, Thanh Nhàn, Chùa Bộc, Cầu Giấy, Sân vận động Quốc gia.
4. [Moovit — Tuyến 02, danh sách điểm dừng](https://appassets.mvtdev.com/map/176/l/2921/17099497.pdf): điểm Học viện Công nghệ Bưu chính Viễn thông trên Trần Phú.
5. [Moovit — BRT01 Kim Mã → Yên Nghĩa](https://moovitapp.com/index/vi/ph%C6%B0%C6%A1ng_ti%E1%BB%87n_c%C3%B4ng_c%E1%BB%99ng-time-brt01-H%C3%A0_N%E1%BB%99i-2921-1597502-17099457-9156357-0): thứ tự các nhà chờ BRT tiêu biểu.
