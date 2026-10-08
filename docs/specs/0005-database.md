# Đặc tả cơ sở dữ liệu GoBus

**Ngày cập nhật**: 2026-10-08  
**Trạng thái**: Mô tả schema đã triển khai trên nhánh feature/routes-management.

## Phạm vi

Nguồn đối chiếu là [01-schema.sql](../../database/01-schema.sql), [03-views.sql](../../database/03-views.sql), seed, migration và backend hiện tại. MySQL 8.4 dùng InnoDB, utf8mb4, collation utf8mb4_0900_ai_ci. Database mặc định gobus_hanoi_student; cấu hình thực tế lấy từ root .env. NestJS truy cập database, React gọi API; TypeORM đặt synchronize: false.

Mô hình có bảy bảng, có vehicles, schedules.vehicle_id và bookings.passenger_name, không có fares. [ERD gốc](../../database/source/CSDL.drawio.svg) chưa phản ánh đầy đủ schema ứng dụng hiện tại.

## Thay đổi so với main

| Thành phần | Thay đổi | Ý nghĩa |
| --- | --- | --- |
| stations.latitude, stations.longitude | Thêm DECIMAL(10,7) NULL | Tọa độ WGS84 để tìm bến và đặt marker |
| chk_stations_coordinates | Thêm CHECK | Hai tọa độ cùng NULL hoặc cùng có giá trị; vĩ độ từ −90 đến 90, kinh độ từ −180 đến 180 |
| routes.geometry | Thêm JSON NULL | Đường phố toàn tuyến kèm snapshot các bến |
| Seed | Tọa độ 19 bến, geometry sáu chiều tuyến | Máy mới nhận dữ liệu bản đồ khi khởi tạo |
| Migration 006, 007 | Thêm cột và dữ liệu còn thiếu có kiểm tra | Nâng cấp database đang dùng, giữ dữ liệu hiện có |

Các quan hệ và bảng nghiệp vụ giữ nguyên. Không tính lại km hoặc phút từ tọa độ/geometry.

## Từ điển dữ liệu

Mỗi id là BIGINT UNSIGNED, khóa chính và AUTO_INCREMENT. Định nghĩa dưới đây trích trực tiếp từ schema, gồm kiểu dữ liệu, NULL và DEFAULT.

### users

| Cột | Định nghĩa SQL |
| --- | --- |
| `id` | `bigint unsigned NOT NULL AUTO_INCREMENT` |
| `full_name` | `varchar(120) NOT NULL` |
| `email` | `varchar(160) NOT NULL` |
| `phone` | `varchar(20) DEFAULT NULL` |
| `password_hash` | `varchar(255) NOT NULL` |
| `role` | `enum('ADMIN','USER') NOT NULL DEFAULT 'USER'` |
| `is_active` | `tinyint(1) NOT NULL DEFAULT '1'` |

### stations

| Cột | Định nghĩa SQL |
| --- | --- |
| `id` | `bigint unsigned NOT NULL AUTO_INCREMENT` |
| `code` | `varchar(20) NOT NULL` |
| `name` | `varchar(160) NOT NULL` |
| `address` | `varchar(255) NOT NULL` |
| `latitude` | `decimal(10,7) DEFAULT NULL` |
| `longitude` | `decimal(10,7) DEFAULT NULL` |
| `is_active` | `tinyint(1) NOT NULL DEFAULT '1'` |

### routes

| Cột | Định nghĩa SQL |
| --- | --- |
| `id` | `bigint unsigned NOT NULL AUTO_INCREMENT` |
| `code` | `varchar(20) NOT NULL` |
| `name` | `varchar(180) NOT NULL` |
| `origin_station_id` | `bigint unsigned NOT NULL` |
| `destination_station_id` | `bigint unsigned NOT NULL` |
| `operating_start` | `time NOT NULL` |
| `operating_end` | `time NOT NULL` |
| `distance_km` | `decimal(8,2) NOT NULL` |
| `status` | `enum('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE'` |
| `geometry` | `json DEFAULT NULL` |

### route_stops

| Cột | Định nghĩa SQL |
| --- | --- |
| `id` | `bigint unsigned NOT NULL AUTO_INCREMENT` |
| `route_id` | `bigint unsigned NOT NULL` |
| `station_id` | `bigint unsigned NOT NULL` |
| `stop_order` | `smallint unsigned NOT NULL` |
| `km_from_origin` | `decimal(8,2) NOT NULL` |
| `minutes_from_origin` | `smallint unsigned DEFAULT NULL` |

### vehicles

| Cột | Định nghĩa SQL |
| --- | --- |
| `id` | `bigint unsigned NOT NULL AUTO_INCREMENT` |
| `vehicle_code` | `varchar(30) NOT NULL` |
| `capacity` | `smallint unsigned NOT NULL` |

### schedules

| Cột | Định nghĩa SQL |
| --- | --- |
| `id` | `bigint unsigned NOT NULL AUTO_INCREMENT` |
| `route_id` | `bigint unsigned NOT NULL` |
| `departure_at` | `datetime(3) NOT NULL` |
| `arrival_at` | `datetime(3) NOT NULL` |
| `vehicle_id` | `bigint unsigned NOT NULL` |
| `status` | `enum('SCHEDULED','DEPARTED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'SCHEDULED'` |

### bookings

| Cột | Định nghĩa SQL |
| --- | --- |
| `id` | `bigint unsigned NOT NULL AUTO_INCREMENT` |
| `booking_code` | `varchar(24) NOT NULL` |
| `user_id` | `bigint unsigned NOT NULL` |
| `schedule_id` | `bigint unsigned NOT NULL` |
| `from_station_id` | `bigint unsigned NOT NULL` |
| `to_station_id` | `bigint unsigned NOT NULL` |
| `passenger_name` | `varchar(120) NOT NULL` |
| `contact_phone` | `varchar(20) NOT NULL` |
| `unit_price` | `decimal(10,2) NOT NULL` |
| `status` | `enum('CONFIRMED','CANCELLED') NOT NULL DEFAULT 'CONFIRMED'` |
| `booked_at` | `datetime(3) NOT NULL DEFAULT (utc_timestamp(3))` |
| `cancelled_at` | `datetime(3) DEFAULT NULL` |

## Quan hệ, khóa và chỉ mục

| Bảng nguồn | Khóa ngoại | Bảng đích |
| --- | --- | --- |
| routes | origin_station_id, destination_station_id | stations.id |
| route_stops | route_id | routes.id |
| route_stops | station_id | stations.id |
| schedules | route_id | routes.id |
| schedules | vehicle_id | vehicles.id |
| bookings | user_id | users.id |
| bookings | schedule_id | schedules.id |
| bookings | from_station_id, to_station_id | stations.id |

Mỗi khóa ngoại tạo quan hệ nhiều bản ghi nguồn tới một bản ghi đích. route_stops biểu diễn quan hệ nhiều tuyến với nhiều bến và thứ tự trên từng tuyến. Tất cả khóa ngoại có ON DELETE RESTRICT. ON UPDATE RESTRICT được khai báo cho các khóa ngoại ngoài fk_schedules_vehicle, khóa này dùng mặc định NO ACTION.

UNIQUE gồm users.email, stations.code, routes.code, vehicles.vehicle_code, bookings.booking_code, route_stops(route_id, stop_order), route_stops(route_id, station_id) và schedules(vehicle_id, departure_at). UNIQUE lịch vẫn áp dụng cho chuyến CANCELLED.

Chỉ mục tìm kiếm gồm stations(name), routes(origin_station_id, destination_station_id), route_stops(station_id, route_id, stop_order), schedules(route_id, departure_at, status), schedules(vehicle_id, departure_at, arrival_at), bookings(user_id, booked_at), bookings(schedule_id, status, from_station_id, to_station_id). Schema còn có chỉ mục hỗ trợ khóa ngoại bến cuối tuyến và bến lên/xuống vé.

## Ràng buộc

SQL CHECK kiểm tra tên/email/mã/địa chỉ không rỗng, is_active thuộc 0 hoặc 1, tọa độ hợp lệ, khoảng cách tuyến và sức chứa xe dương. Bến đầu/cuối tuyến khác nhau. Giờ tuyến thỏa 00:00:00 ≤ operating_start < operating_end < 24:00:00. Điểm dừng có thứ tự dương; điểm đầu có km bằng 0, điểm sau có km dương. Lịch có arrival_at > departure_at. Vé có giá không âm, hai bến khác nhau, tên hành khách và điện thoại không rỗng. Vé CONFIRMED có cancelled_at NULL; vé CANCELLED có thời điểm hủy không trước booked_at.

Backend kiểm tra quy tắc nhiều hàng trong transaction: thứ tự bến liên tục, km và phút tăng theo hành trình, đầu/cuối khớp tuyến, bến lên/xuống đúng tuyến và chiều, lịch cùng xe không giao nhau, số vé không vượt sức chứa trên từng đoạn. CHECK không tự bảo đảm các quy tắc này. minutes_from_origin cho phép NULL để giữ dữ liệu cũ, backend chặn tạo lịch khi thiếu thời lượng. Lịch và hành trình có vé được bảo vệ theo [đặc tả tuyến](0002-routes-stops-management.md) và [đặc tả lịch](0003-schedules-management.md).

Một hàng bookings là một vé cho một hành khách. unit_price lưu giá đã chốt, không tính lại khi tuyến đổi. Chỗ trống tính theo vé CONFIRMED giao nhau trên từng đoạn, không trừ tổng số vé cả chuyến. DATETIME(3) lưu UTC, giao diện hiển thị giờ Việt Nam UTC+07:00.

## Hợp đồng routes.geometry

Backend kiểm tra bằng [route-geometry.ts](../../backend/src/journey-planner/route-geometry.ts). MySQL chỉ bảo đảm JSON hợp lệ về cú pháp.

| Trường | Nội dung |
| --- | --- |
| version | Số 1 |
| source | osrm-driving |
| geometry | GeoJSON LineString, coordinates gồm các cặp [longitude, latitude] |
| stops | Snapshot toàn tuyến theo thứ tự, mỗi mục có code, latitude, longitude, stop_order |
| stop_indices | Chỉ số điểm tương ứng bến trong geometry, tăng nghiêm ngặt, đầu bằng 0, cuối bằng số điểm trừ 1 |

LineString có 2 đến 100000 điểm, mỗi điểm là hai số hữu hạn trong khoảng tọa độ hợp lệ. stops và stop_indices phải khớp số bến. Snapshot phải khớp mã, tọa độ và thứ tự bến hiện tại; nếu khác, backend bỏ qua cache. Transaction đọc kết thúc trước khi gọi OSRM. Backend ghi cache bằng cập nhật có điều kiện so với geometry đã đọc để tránh ghi đè cache mới từ yêu cầu khác.

Khi OSRM lỗi, API trả đường nối thẳng với source straight-line và approximate true, không lưu đường này vào database. OSRM driving qua bến đại diện phục vụ demo, chưa phải đường vận hành xe buýt chính thức.

## Views và seed

| View | Nội dung |
| --- | --- |
| v_route_details | Tuyến, bến đầu/cuối, giờ hoạt động, khoảng cách, trạng thái, số điểm dừng |
| v_schedule_details | Chuyến, tuyến, xe, sức chứa, trạng thái, giờ UTC và giờ Việt Nam |
| v_segment_availability | Từng đoạn giữa hai bến liên tiếp, sức chứa, số vé chiếm chỗ, chỗ còn lại |
| v_booking_details | Vé, người đặt, hành khách, tuyến, xe, bến lên/xuống, giờ dự kiến theo phút từ đầu tuyến |

Views chưa bổ sung tọa độ hoặc geometry; module lộ trình đọc trực tiếp qua backend. Seed mới có 3 tài khoản, 19 bến, 6 tuyến một chiều, 40 điểm dừng tuyến, 6 xe, 504 lịch, 3 vé. Lịch bắt đầu từ ngày mai theo giờ Việt Nam, kéo dài 14 ngày, 6 chuyến mỗi ngày mỗi chiều. Km, phút, giá, tọa độ và đường đi là dữ liệu học tập.

## Khởi tạo và nâng cấp

Máy mới chạy từ root:

```bash
node database/scripts/setup-local.mjs
```

Database tương thích đã có dữ liệu không được setup-local nạp lại seed. Sau khi cài dependency backend, kiểm tra .env chọn đúng database rồi chạy theo thứ tự:

```bash
node database/migrations/006-station-coordinates.mjs
node database/migrations/007-route-geometry.mjs
```

Migration 006 sao lưu riêng vào .local/backups, thêm cột còn thiếu, dừng nếu tọa độ hiện có không hợp lệ. Chỉ điền bến demo theo code khi cả hai tọa độ đều NULL, thêm CHECK còn thiếu, kiểm tra checksum các cột nghiệp vụ gốc.

Migration 007 yêu cầu có tọa độ, sao lưu riêng, thêm geometry nếu thiếu. Chỉ điền geometry NULL cho tuyến demo có mã bến, tọa độ và thứ tự khớp snapshot trong seed. Bỏ qua tuyến đã sửa hoặc geometry có sẵn. Kiểm tra dữ liệu gốc trước khi commit cập nhật. Cả hai script có thể chạy lại. MySQL DDL có implicit commit, transaction không rollback toàn bộ việc thêm cột; bản sao dùng để đối chiếu và phục hồi.

Hai migration không chuyển schema ERD cũ thiếu vehicles/vehicle_id/passenger_name. Xem [hướng dẫn database](../../database/README.md) để tạo database ứng dụng riêng và giữ dữ liệu cũ. Không xóa volume hoặc import lại schema/seed vào database đang dùng. Không đưa .env hoặc bản sao riêng lên Git.

## Kiểm tra sau nâng cấp

Các truy vấn chỉ đọc:

```sql
SHOW CREATE TABLE stations;
SHOW CREATE TABLE routes;
SELECT code, latitude, longitude FROM stations ORDER BY code;
SELECT code, geometry IS NOT NULL AS has_geometry FROM routes ORDER BY code;
SELECT code FROM stations WHERE
  (latitude IS NULL AND longitude IS NOT NULL) OR
  (latitude IS NOT NULL AND longitude IS NULL) OR
  latitude NOT BETWEEN -90 AND 90 OR longitude NOT BETWEEN -180 AND 180;
```

Truy vấn cuối phải không có hàng. Database demo chưa sửa có tọa độ 19 bến và geometry 6 chiều tuyến. Database tùy chỉnh có thể ít hơn vì migration giữ dữ liệu đã có. Xem [tọa độ bến](../../database/station-coordinates.md), [bản đồ và cache](../journey-map.md), [kiểm chứng bootstrap](../database-bootstrap-verification.md).
