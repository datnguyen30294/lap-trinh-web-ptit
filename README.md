# lap-trinh-web-ptit
tất cả về môn lâoj trình web thầy Trần Quý Nam
# Bo-stack
Front-end: React + TypeScript
Back-end: Node.js + NestJS (có thể học Express trước)
Database: MySQL
Kèm theo: REST API, JWT, Git và Docker
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
=======


## CSDL GoBus theo ERD — dữ liệu Hà Nội

CSDL MySQL gồm **7 bảng theo `CSDL.drawio.svg`**. Có dữ liệu mẫu tuyến 02, 26 và BRT01 ở Hà Nội; lịch chạy, số km và giá theo công thức đề tài là dữ liệu demo.

- [Hướng dẫn kết nối, cấu trúc và nguồn dữ liệu](database/README.md)
- [SQL tạo CSDL](database/01-schema.sql)
- [SQL dữ liệu mẫu Hà Nội](database/02-seed-hanoi.sql)
- [ERD gốc](database/source/CSDL.drawio.svg)

Chạy MySQL: sao chép `.env.example` thành `.env` nếu chưa có, rồi `docker compose up -d`.
Kết nối mặc định: `127.0.0.1:3309`, database `gobus_hanoi_erd`, tài khoản `gobus` (mật khẩu trong `.env`).

Phạm vi hiện tại chỉ làm CSDL; chưa triển khai lại ứng dụng và chưa chạy bộ test.
