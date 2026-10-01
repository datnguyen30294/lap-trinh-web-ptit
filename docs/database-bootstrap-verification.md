# Kiểm chứng bộ khởi tạo database — 01/10/2026

## Vấn đề đã sửa

Repo trước đây khởi tạo `gobus_hanoi_erd`, có fares và thông tin xe nằm trong schedules. Backend hiện tại dùng mô hình khác: vehicles, schedules.vehicle_id, bookings.passenger_name. Clone code không sao chép Docker volume hoặc `.env`, nên thành viên có thể gặp thiếu database/bảng/cột dù đã làm theo hướng dẫn cũ.

## Thay đổi

- `database/01-schema.sql`: cấu trúc 7 bảng đúng với ứng dụng đang chạy, bao gồm users.phone tùy chọn, route_stops.minutes_from_origin nullable, các khóa ngoại, unique và CHECK hiện có. Không xuất hàng dữ liệu, hash tài khoản hay bộ đếm AUTO_INCREMENT của máy phát triển.
- `database/02-seed-hanoi.sql` và generator: seed demo độc lập, 6 xe riêng; lịch liên kết vehicle_id; vé dùng passenger_name; giá mẫu tính theo km, không phụ thuộc bảng fares.
- Views và example queries dùng mô hình mới; truy vấn vé dựa trên session, không giả định JWT.
- SQL không cố định tên database. Compose đọc DB_NAME và DB_USER từ `.env`; `.env.example` mặc định gobus_hanoi_student và có tài khoản TEST_* khớp seed.
- Healthcheck dùng TCP để chỉ báo sẵn sàng sau khi MySQL hoàn tất giai đoạn khởi tạo tạm thời.
- `setup-local.mjs`: dùng Node built-ins, tạo cấu hình/secret cho máy mới, giữ cấu hình đã có; khởi động Docker, kiểm tra schema; chỉ nhập SQL khi database trống; hỗ trợ tạo database mới trong volume cũ và cấp quyền cho user. Không tự chuyển đổi schema ERD hoặc ghi đè database không tương thích.
- Giữ nguyên tên Compose project/volume hiện có để không tách nhầm dữ liệu đang dùng. `refresh-demo.sh` kiểm tra setup/schema trước khi nạp dữ liệu demo.
- README gốc, README database, AGENTS và hướng dẫn module được cập nhật.

## Kiểm tra thực tế

Khởi tạo MySQL 8.4 bằng chính Compose của repo trong project Docker tạm riêng, cổng host riêng và volume trống. Không dùng database đang làm việc để thử import.

| Kiểm tra | Kết quả |
| --- | --- |
| Khởi tạo từ volume trống và .env chưa có SESSION_SECRET | Thành công; secret ngẫu nhiên được tạo |
| Cấu trúc mới | 7 bảng, 4 views |
| Dữ liệu seed | 3 users, 19 stations, 6 routes, 40 route_stops, 6 vehicles, 504 schedules, 3 bookings |
| Mật khẩu demo ADMIN/USER | Khớp bcrypt hash và đăng nhập API được |
| Đọc 4 views | Thành công: 6 tuyến, 504 lịch, 2856 đoạn lịch, 3 vé |
| Toàn bộ `04-example-queries.sql` | Chạy thành công |
| Backend build + bộ tích hợp trên DB mới | **111/111 tests passed**, 5 test files |
| Chạy lại setup | Không sửa hàng dữ liệu, không thay nội dung .env đã đầy đủ |
| Chạy lại seed hai lần cùng ngày | Hash toàn bộ hàng của 7 bảng không đổi |
| Database tạo bằng schema ERD cũ | Setup từ chối trước khi sửa schema/seed; bản ghi đánh dấu và cấu trúc cũ còn nguyên |
| Chọn tên database mới trên volume cũ | Tạo/import/grant thành công; user ứng dụng kết nối được; hai DB đã có vẫn nguyên vẹn |
| Database thật của máy phát triển | SHA256 toàn bộ hàng của 7 bảng khớp trước/sau; không thay `.env` thật hoặc dữ liệu |
| Kiểm tra script | Node syntax, Bash syntax, git diff whitespace đều hợp lệ |

Các kiểm thử tích hợp bao gồm xác thực USER/ADMIN, quyền truy cập, quản lý bến/tuyến/lịch, khóa giao dịch, bảo toàn dữ liệu và API tra cứu hành khách. Dữ liệu fixture được dọn riêng. Project/volume kiểm chứng tạm được dọn sau kiểm tra; volume đang dùng không bị xóa.

## Phạm vi

Đã kiểm tra trên macOS với Docker MySQL 8.4. Lệnh setup dùng Node và Docker CLI, không phụ thuộc Bash để hỗ trợ máy Windows/Linux; chưa chạy trực tiếp trên hai hệ điều hành đó. Không tự chuyển dữ liệu riêng của schema ERD cũ sang mô hình mới. Người có database cũ cần giữ nó và chọn database mới theo [hướng dẫn](../database/README.md).

Nhóm chỉ nhận được bộ khởi tạo mới sau khi các thay đổi được commit/push và thành viên pull. Không đưa `.env`, volume hoặc `.local` lên Git.
