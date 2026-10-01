# GoBus — Lập trình web PTIT

Ứng dụng quản lý xe buýt: React 19 + Vite (JavaScript/JSX), NestJS + TypeORM (TypeScript), MySQL 8.4. Xác thực dùng session cookie, phân quyền ADMIN/USER.

## Chạy sau khi clone

Cài Node.js 24+ và Docker Desktop, mở Docker Desktop, rồi chạy từ thư mục gốc:

```bash
node database/scripts/setup-local.mjs
```

Lệnh tạo `.env` nếu chưa có, tạo session secret, khởi động MySQL và chuẩn bị database đúng phiên bản. Không xóa volume hoặc nạp đè database đã có dữ liệu. Hướng dẫn Windows/macOS/Linux, kết nối Workbench/DBeaver và xử lý database cũ: [database/README.md](database/README.md).

Mở hai terminal:

```bash
cd backend
npm ci
npm run start:dev
```

```bash
cd frontend
npm ci
npm run dev
```

Mở [GoBus](http://localhost:5173/login). Database mặc định: `127.0.0.1:3309`, `gobus_hanoi_student`, user `gobus`, mật khẩu trong `.env`.

Tài khoản demo trên database mới: `admin@gobus.local` / `GoBusAdmin2026!` và `an@gobus.local` / `GoBusUser2026!`. Không dùng những tài khoản mẫu này cho triển khai thật.

## Các module hiện có

- [Trang chủ USER theo Figma và tra cứu tuyến](docs/user-home-module.md): `/user/home`.
- [Quản lý bến xe](docs/stations-module.md): `/stations`.
- [Quản lý tuyến và điểm dừng](docs/routes-module.md): `/routes`.
- [Quản lý lịch trình](docs/schedules-module.md): `/schedules`.

Database gồm users, stations, routes, route_stops, vehicles, schedules và bookings. Bộ SQL trong `database/` đồng bộ với cấu trúc ứng dụng. Đặt vé, thanh toán và bản đồ chưa triển khai đầy đủ.

## Kiểm tra

Frontend: `npm run build`, `npm run lint`, `npm test`. Backend: `npm run build`, `npm run lint`, `npm test`, `npm run test:e2e` (MySQL và TEST_* trong `.env`).

# yeu-cau-de-bai
I. Yêu cầu chung cho tất cả các đề tài (mỗi nhóm có <= 3 sinh viên):
- Front-end: HTML, CSS, JavaScript (có thể dùng framework cơ bản như React,
Vue.js,…).
- Back-end: Node.js (Express /NestJS) hoặc PHP (Laravel) hoặc Python (Django/Flask)
hoặc Java (Spring Boot).
- Database: MySQL, PostgreSQL, SQL Server, Oracle hoặc MongoDB.
- API: Xây dựng RESTful API cho các chức năng chính.
- Xác thực và phân quyền: Đăng nhập/đăng ký, phân quyền người dùng cơ bản.
- Giao diện: Thân thiện, dễ sử dụng.
20. Hệ thống quản lý xe bus (tuyến xe, lịch trình)
Mô tả: Theo dõi thông tin tuyến xe bus.
Yêu cầu chức năng:
- Quản lý tuyến xe (điểm đi, điểm đến, giờ hoạt động).
- Quản lý lịch trình chạy xe.
- Tìm kiếm tuyến xe theo điểm đi/đến.
- Đặt vé xe bus trực tuyến.
- Quản lý bến xe, giá vé.
- Phân quyền: Admin, Người dùng.
III. Sản phẩm kết quả:
- Slides trình chiếu, thuyết trình báo cáo bài tập lớn (file MS PowerPoint) tại buổi học
của lớp khoảng nửa cuối học kỳ. Slides nêu rõ cách lập trình, phát triển frontend,
backend, cơ sở dữ liệu, xây dựng các APIs,...
- Demo sản phẩm website chạy tốt, demo toàn bộ các chức năng theo đúng yêu cầu.
- Điểm sẽ có căn cứ theo tỷ lệ % đóng góp của các thành viên (do nhóm sinh viên tự
thống nhất) để đảm bảo công bằng (không cào bằng).
