# Trang chủ người dùng GoBus

Đã triển khai trang chủ hành khách theo [Figma frame 102:3](https://www.figma.com/design/bPqt1G05XZ7b4cTDiAc0Uo/GoBus-Wireframe-Trang-Chu?node-id=102-3), kèm điều hướng theo vai trò và tra cứu tuyến bằng dữ liệu MySQL.

## Chạy và sử dụng

Từ thư mục gốc chạy `docker compose up -d`. Chạy backend bằng `npm run start:dev` trong `backend/`, frontend bằng `npm run dev` trong `frontend/`.

Mở **http://localhost:5173/login** theo WEB_ORIGIN hiện có. Dùng tài khoản USER đang hoạt động để vào `/user/home`; tài khoản ADMIN vào `/stations` hoặc đường dẫn quản trị hợp lệ đang mở. Tài khoản kiểm thử được cấu hình trong `.env`; không ghi thông tin đăng nhập vào tài liệu hoặc mã nguồn.

Trang chủ hiển thị tên thật, đăng xuất, bến và tuyến thật. Chọn hai bến khác nhau để tìm tuyến đi thẳng theo đúng chiều, hoặc chọn tuyến gợi ý / Xem tất cả tuyến. Hộp thoại kết quả có phân trang, điểm dừng và giờ hoạt động. Escape đóng hộp thoại và trả focus về nút mở.

## Các file của thay đổi này

- `frontend/src/App.jsx`: khôi phục phiên, điều hướng theo vai trò, hết phiên, đăng xuất và trang không tìm thấy.
- `frontend/src/utils/navigation.js`: đường dẫn hợp lệ, History API và chính sách điều hướng.
- `frontend/src/pages/LoginPage.jsx`: nội dung đăng nhập dùng chung.
- `frontend/src/pages/UserHomePage.jsx`, `user-home.css`: giao diện hành khách và trạng thái dữ liệu.
- `frontend/src/components/PassengerRouteResults.jsx`: kết quả tra cứu.
- `frontend/src/services/passengerApi.js`: gọi API qua request helper hiện có.
- `frontend/public/home/`: ảnh và SVG xuất từ Figma, kèm bảng nguồn layer trong README.
- `frontend/package.json`, `package-lock.json`: thêm Manrope cục bộ đúng font Figma.
- `backend/src/passenger/`, `backend/src/app.module.ts`: đăng ký module API chỉ đọc, DTO, guard và truy vấn MySQL.
- `frontend/src/App.test.jsx`, `frontend/src/pages/UserHomePage.test.jsx`, `backend/test/passenger.e2e-spec.ts`: kiểm thử mới.
- `docs/specs/0004-user-home.md`, tài liệu này và `docs/reviews/user-home/`: đặc tả và bằng chứng kiểm chứng.

Giữ nguyên cơ chế express-session, cookie gobus.sid, header X-GoBus-Request và AdminGuard. Không có migration hay thay đổi `.env` cho module này. Các thay đổi sẵn có của module tuyến/lịch trình trong working tree được giữ lại.

## So sánh với Figma

Ảnh tham chiếu: `docs/reviews/user-home/figma-desktop.png`. Ảnh thực tế: `desktop.png`, `mobile.png` (390px), `mobile-320.png` (320px), `route-results.png`. Kết quả đo trong `browser-checks.json`.

| Vùng | Figma | Trình duyệt 1440px |
| --- | --- | --- |
| Utility bar | y=0, cao 40 | y=0, cao 40 |
| Header | y=40, cao 80 | y=40, cao 80 |
| Hero | y=120, cao 520 | y=120, cao 520 |
| Ô tra cứu | x=876, y=156, rộng 484, cao 383 | x=876, y=156, rộng 484, cao 382.5 |
| Giới thiệu | y=640, cao 633 | y=640, cao 633.17 |
| Footer | y=1273, cao 414 | y=1273.17, cao 414 |

Đã xem trực tiếp ảnh thực tế và ảnh Figma. Cả 14 tài nguyên hình ảnh/SVG có file cục bộ không rỗng, được dùng đúng vùng; các icon giữ kích thước 14/18/28px của thiết kế. Không dùng screenshot làm giao diện và không tham chiếu URL Figma tạm thời trong code.

Những khác biệt có chủ đích:

- Đồng nhất chữ EGBus/VinBus trong mẫu thành GoBus; giữ nội dung giới thiệu, ảnh nền, màu và bố cục gốc.
- Tên người dùng và Đăng xuất thay Đăng ký/Đăng nhập; tên dài được rút gọn trên giao diện và có tên đầy đủ trong tooltip.
- Tuyến E01/E03 minh họa được thay bằng tuyến thật từ MySQL.
- Dùng ô chọn bến thật thay ô nhập địa chỉ tự do, vì module chưa có định vị hay tìm địa chỉ.
- Bổ sung nhãn Sắp có cho bản đồ/đặt vé và hộp thoại giải thích cho các chức năng chưa triển khai. Chưa có đặt vé, thanh toán, bản đồ, mạng xã hội, trang pháp lý hoặc tin tức.
- Chữ gợi ý trong ô chọn đậm màu hơn mẫu để dễ đọc. Kết quả tra cứu, trạng thái tải/lỗi/rỗng là phần tương tác bổ sung.
- Không có frame mobile trong section Trang chủ; responsive được xây dựng từ bố cục desktop và kiểm tra ở 390px/320px.

## Kiểm chứng ngày 01/10/2026

- Frontend: build thành công, lint không lỗi/cảnh báo, **53 tests passed** (gồm 28 kiểm thử mới).
- Backend: build và lint thành công, **1 unit test passed**, **111 integration tests passed** (gồm 8 kiểm thử mới).
- Bộ tích hợp chạy MySQL thật: xác thực, USER/ADMIN, 401/403, bến trung gian đúng chiều, phân trang, tuyến/bến ngừng hoạt động, dữ liệu đầu vào sai và tài khoản bị khóa.
- Kiểm thử chỉ tạo/xóa fixture riêng; so sánh hash toàn bộ dữ liệu gốc sau khi dọn fixture, không thay đổi dữ liệu kinh doanh sẵn có.
- Chrome thật: đăng nhập hai vai trò, giữ đường dẫn admin sau đăng nhập, URL trực tiếp, tải lại, Back sau đăng xuất, mất phiên khi quay lại cửa sổ, các API admin trả 403 cho USER, đóng dialog bằng Escape và trả focus. Không ghi nhận lỗi JavaScript.
- Desktop/mobile đã chụp ảnh và kiểm tra không tràn ngang. Báo cáo ảnh/kích thước tại `docs/reviews/user-home/browser-checks.json`.

Lệnh kiểm chứng: frontend `npm run build`, `npm run lint`, `npm test`; backend `npm run build`, `npm run lint`, `npm test`, `npm run test:e2e`. Bộ tích hợp yêu cầu MySQL và TEST_ADMIN_EMAIL/PASSWORD, TEST_USER_EMAIL/PASSWORD trong `.env` như các module hiện có.
