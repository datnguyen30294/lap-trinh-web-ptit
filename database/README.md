# CSDL GoBus — ERD và dữ liệu Hà Nội

CSDL đã được tạo từ `source/CSDL.drawio.svg`, theo yêu cầu ngày 27/09/2026. Phạm vi hiện tại **chỉ là CSDL**; chưa khôi phục frontend/backend và chưa chạy bộ test.

## Mở và kết nối

MySQL 8.4 đang chạy bằng Docker Compose:

| Thông số | Giá trị mặc định local |
|---|---|
| Host | `127.0.0.1` |
| Port | `3309` |
| Database | `gobus_hanoi_erd` |
| Username | `gobus` |
| Password | `gobus-local-2026` — cấu hình tại `.env` |
| Charset | `utf8mb4`, hỗ trợ tiếng Việt |
| Thời gian lưu | UTC; khi hiển thị đổi sang `+07:00` |

Có thể dùng DBeaver, MySQL Workbench hoặc CLI. Cấu hình này chỉ bind cổng MySQL trên loopback của máy.

```bash
cd /Users/endgame/lap-trinh-web-ptit
# Máy mới: sao chép .env.example thành .env rồi chỉnh cấu hình nếu cần.
docker compose up -d
```

Mở MySQL trong container:

```bash
docker compose exec mysql mysql -u gobus -p gobus_hanoi_erd
```

Docker tự import `01-schema.sql`, `02-seed-hanoi.sql`, `03-views.sql` khi volume được khởi tạo lần đầu. Lần khởi động sau giữ nguyên dữ liệu. Không cần xóa volume.

Nếu đã có MySQL 8.0.16+ / 8.4 bên ngoài Docker, mở và chạy ba file SQL theo đúng thứ tự trong Workbench, hoặc:

```bash
mysql -u root -p < database/01-schema.sql
mysql -u root -p < database/02-seed-hanoi.sql
mysql -u root -p < database/03-views.sql
```

Các file tạo schema/seed không có `DROP DATABASE`, `DROP TABLE`, `TRUNCATE` hay thao tác xóa dữ liệu. `CREATE TABLE IF NOT EXISTS` dành cho khởi tạo; không tự sửa một schema khác đã tồn tại cùng tên.

## Bảy bảng theo ERD

| Thực thể ERD | Bảng MySQL | Vai trò |
|---|---|---|
| USER | `users` | Tài khoản, mật khẩu băm, vai trò ADMIN/USER |
| STATION | `stations` | Bến và điểm dừng |
| ROUTES | `routes` | Tuyến một chiều, đầu/cuối, giờ hoạt động, chiều dài |
| Route_stop | `route_stops` | Các bến trên tuyến theo thứ tự |
| schedule | `schedules` | Chuyến cụ thể, mã xe, sức chứa, ngày giờ |
| fares | `fares` | Giá cho cặp bến thuộc một tuyến |
| booking | `bookings` | Một vé cho một hành khách trong một lần đặt |

Không thêm bảng `admin`: quản trị viên là `users.role = 'ADMIN'`. Không thêm bảng `vehicles`: ERD gốc đặt `vehicle_code` và `capacity` ở `schedules`. Đây là lựa chọn theo yêu cầu bám ERD; báo cáo `GoBus_Bao_cao_CSDL_hoan_chinh.docx` có mô hình 8 bảng khác với sơ đồ này.

Các quan hệ HAS, APPEARS_IN, HAS_SCHEDULES, HAS_FARES, MAKES, HAS_BOOKINGS được chuyển thành khóa ngoại. Hai vai trò điểm đón/trả được giữ riêng tại `from_station_id` và `to_station_id`.

Các hiệu chỉnh khi chuyển mô hình khái niệm sang CSDL chạy được:

- Chuẩn hóa tên bảng số nhiều, cột dùng `snake_case`, PK/FK dùng `BIGINT UNSIGNED` thống nhất.
- Sửa lỗi gõ `ccontact_phone` thành `contact_phone`; giữ `contact_name` như ERD.
- ERD lặp thuộc tính `booked_at`: CSDL chỉ lưu một cột; bổ sung `cancelled_at` cho nghiệp vụ hủy vé.
- Bổ sung `routes.name`, `stations.code`, `is_active` của bến/tài khoản và cặp bến đầu/cuối theo đặc tả.
- Bổ sung `route_stops.km_from_origin` để tính giá từng chặng theo công thức đề tài.
- `bookings` không có số ghế, số lượng khách hay tổng tiền: mỗi hàng tương ứng đúng một vé, giá giữ tại `unit_price`.

## Dữ liệu mẫu đã nạp

| Nội dung | Số lượng khi khởi tạo |
|---|---:|
| Tài khoản demo | 3 |
| Bến/địa điểm dừng chọn lọc ở Hà Nội | 19 |
| Tuyến theo chiều | 6 |
| Quan hệ tuyến–điểm dừng | 40 |
| Giá vé chặng | 130 |
| Chuyến demo | 504 |
| Vé demo | 3 |

Ba tuyến tham chiếu: **02 Bác Cổ – Yên Nghĩa**, **26 Mai Động – Sân vận động Quốc gia**, **BRT01 Kim Mã – Yên Nghĩa**. Mỗi tuyến có bản ghi `-DI` và `-VE`; không suy diễn rằng một bản ghi tuyến tự hỗ trợ hai chiều.

Đây là **bộ dữ liệu học tập lấy địa danh và hành lang tuyến ở Hà Nội**, không phải bản sao đầy đủ dữ liệu vận hành hiện hành:

- Danh sách chỉ giữ các điểm dừng/địa danh tiêu biểu; không chứa toàn bộ nhà chờ, tọa độ, cột đỗ và phía đường thực tế.
- `km_from_origin`, `minutes_from_origin`, `distance_km`, giờ hoạt động 05:00–22:00, sức chứa, mã xe `DEMO-HN-*` và các giờ khởi hành được dựng để demo. Không dùng làm lịch đi xe ngoài thực tế.
- Chiều về sử dụng các điểm tiêu biểu theo thứ tự ngược để minh họa mô hình. Lộ trình đường một chiều và cột đỗ riêng chiều về chưa được mô hình hóa.
- Giá chặng = `ROUND(4000 + 500 × (km_đến − km_đi), 0)` theo yêu cầu tài liệu dự án. **Đây không phải biểu giá chính thức của xe buýt Hà Nội.**
- Tài khoản, họ tên, số điện thoại và vé mẫu đều là dữ liệu giả lập. Không nhập thông tin khách hàng thật.
- 504 chuyến được tạo cho 14 ngày, bắt đầu ngày kế tiếp theo giờ Hà Nội, lúc 06:00, 09:00, 12:00, 15:00, 18:00, 21:00. Mỗi chiều có một mã xe demo riêng; thời gian giữa các chuyến không chồng lấn.

Có thể chạy lại seed để bổ sung cửa sổ 14 ngày mới; các bản ghi đã tồn tại không bị cập nhật, không đặt lại mật khẩu hay giá do bạn đã sửa. Tổng chuyến có thể tăng theo thời gian khi bổ sung ngày mới.

### Tài khoản ứng dụng mẫu

| Email | Vai trò | Mật khẩu demo |
|---|---|---|
| `admin@gobus.local` | ADMIN | `GoBusAdmin2026!` |
| `an@gobus.local` | USER | `GoBusUser2026!` |
| `binh@gobus.local` | USER | `GoBusUser2026!` |

Trong bảng `users`, mật khẩu là bcrypt có salt, cost 12. Các tài khoản này phục vụ frontend/backend nối vào sau; hiện chỉ CSDL đang chạy.

## Ràng buộc và giới hạn

Đã có PK, FK, UNIQUE, CHECK, chỉ mục tìm kiếm và `ON DELETE RESTRICT`. Khóa ngoại kép của `fares` đảm bảo cả hai bến thuộc cùng tuyến. CHECK chặn bến đầu/cuối trùng, quãng đường âm, giá âm, sức chứa không hợp lệ, giờ đến trước giờ đi và thời điểm hủy không hợp lệ.

Các điều kiện nhiều hàng cần transaction ở backend hoặc stored procedure khi bổ sung phần ứng dụng: điểm dừng liên tục và tăng dần; đầu/cuối trùng điểm dừng; đúng chiều chặng; bến của vé thuộc tuyến của chuyến; giá hiện hành; xe không trùng khoảng chạy; bảo toàn lịch sử; kiểm soát quyền và sức chứa. File schema không tuyên bố các quy tắc đó đã được cưỡng chế hoàn toàn chỉ bằng FK/CHECK.

Đặt/hủy vé cần khóa cùng hàng `schedules` bằng `SELECT ... FOR UPDATE`, kiểm tra lại giá, giờ chạy và số vé trên **từng đoạn**, rồi ghi vé trong cùng transaction. Không lấy `capacity - tổng mọi vé của chuyến`, vì các vé trên hai đoạn không giao nhau có thể sử dụng cùng một chỗ. Mọi thao tác sửa/hủy lịch trình và thay đổi dữ liệu liên quan phải tham gia quy ước khóa này.

Bốn view hỗ trợ nối ứng dụng:

- `v_route_details`: tuyến với tên hai bến đầu/cuối.
- `v_schedule_details`: chuyến, kèm giờ hiển thị tại Hà Nội.
- `v_segment_availability`: số khách và chỗ còn lại trên từng đoạn liên tiếp.
- `v_booking_details`: chi tiết vé và giờ đón/trả theo offset điểm dừng.

`04-example-queries.sql` chứa ví dụ tra cứu tuyến, tìm chuyến Tràng Thi → PTIT, đọc vé cá nhân và xem giá chặng; chỉ thực hiện SELECT/SET, không tạo hoặc hủy vé.

## Nguồn địa danh và tuyến

Tra cứu ngày 27/09/2026. Chỉ sử dụng tên và thứ tự hành lang/điểm tiêu biểu; không lấy lịch tạm thời hay giá cũ trên trang làm dữ liệu vận hành.

1. [Transerco — Xí nghiệp xe buýt nhanh BRT Hà Nội](https://transerco.com.vn/vi/xi-nghiep-bus-nhanh-brt-ha-noi/xi-nghiep-xe-buyt-nhanh-brt-ha-noi.html): xác nhận tuyến 02, BRT01 và đầu mối Kim Mã, Yên Nghĩa.
2. [Lotrinh.vn — Tuyến 02](https://lotrinh.vn/tourl/20_Lotrinh_xe_bus_ha_noi/default.aspx): hành lang Bác Cổ, Tràng Thi, Ngã Tư Sở, Hà Đông, Yên Nghĩa.
3. [Lotrinh.vn — Tuyến 26](https://lotrinh.vn/tourl/47_Lotrinh_Xe_Bus_Ha_Noi,_Tuyen_26_Mai_Dong_SVD_Quoc_Gia.aspx): hành lang Mai Động, Thanh Nhàn, Chùa Bộc, Cầu Giấy, Sân vận động Quốc gia.
4. [Moovit — Tuyến 02, danh sách điểm dừng](https://appassets.mvtdev.com/map/176/l/2921/17099497.pdf): điểm Học viện Công nghệ Bưu chính Viễn thông trên Trần Phú.
5. [Moovit — BRT01 Kim Mã → Yên Nghĩa](https://moovitapp.com/index/vi/ph%C6%B0%C6%A1ng_ti%E1%BB%87n_c%C3%B4ng_c%E1%BB%99ng-time-brt01-H%C3%A0_N%E1%BB%99i-2921-1597502-17099457-9156357-0): thứ tự các nhà chờ BRT tiêu biểu.

## Các file

- `01-schema.sql`: tạo database và 7 bảng.
- `02-seed-hanoi.sql`: dữ liệu mẫu, import trực tiếp được.
- `03-views.sql`: các view hỗ trợ đọc dữ liệu.
- `04-example-queries.sql`: truy vấn tham khảo.
- `source/CSDL.drawio.svg`: bản sao ERD gốc, không chỉnh sửa.
- `scripts/generate_seed.py`: tái tạo seed SQL từ danh sách nguồn và hai bcrypt hash truyền vào qua JSON; không bắt buộc chạy script này để import CSDL.

Đã xác nhận MySQL khởi động, các file SQL import thành công và đọc được bảng/view. Chưa chạy bộ test hoặc kiểm thử tải theo yêu cầu của bạn.

## Module stations và database đã tồn tại

Schema local được chọn trong root `.env` có thể khác bản ERD trên. Xem [hướng dẫn migration bảo toàn dữ liệu](../docs/stations-module.md#database-thực-tế-và-migration). `migrations/004-stations-module.mjs` bổ sung ba cột trạng thái khi thiếu; không import lại seed hoặc xóa volume.
