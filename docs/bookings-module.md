# Luồng đặt vé GoBus

Phần đặt vé dùng React JSX và CSS thuần, NestJS và MySQL đang chạy trong Docker. Mỗi hành khách có một vé riêng. Không đổi schema, seed SQL hoặc volume Docker. Thiết kế và quyết định ở [spec 0005](specs/0005-passenger-bookings.md).

## Mở và chạy

Từ trang chủ, chọn **Mua vé** hoặc **Đặt vé ngay**. Trang tìm chuyến ở http://localhost:5173/user/bookings, vé của tôi ở http://localhost:5173/user/tickets. Cần đăng nhập tài khoản USER hoặc ADMIN đang hoạt động. Tài khoản và cấu hình kết nối nằm trong root `.env` bị Git bỏ qua.

Chạy từ thư mục gốc:

```powershell
docker compose up -d
```

Mở hai terminal riêng, mỗi terminal bắt đầu từ thư mục gốc:

```powershell
cd backend
npm install
npm run start:dev
```

```powershell
cd frontend
npm install
npm run dev
```

Backend dùng PORT trong `.env`, hiện là 3001. Frontend chuyển `/api` tới backend. Chỉ database cần Docker; hai ứng dụng chạy bằng npm theo cấu trúc hiện tại.

## Sử dụng

1. Gõ tên hoặc mã bến ở Điểm đi và Điểm đến, rồi chọn một gợi ý và ngày đi. Có thể gõ không dấu, ví dụ `yen nghia`, hoặc dùng phím lên/xuống và Enter. Gợi ý lấy từ các bến thuộc tuyến hoạt động trong MySQL qua API, không phải dữ liệu Google Maps. Chuyến phải chưa khởi hành, tuyến và các bến đang hoạt động.
2. Chọn chuyến, tăng hoặc giảm số vé. Nhập tên và số điện thoại riêng cho từng hành khách.
3. Xác nhận đặt vé. Trang thành công đọc lại toàn bộ vé từ MySQL bằng mã lần đặt, hiển thị tổng tiền và từng liên kết vé.
4. Mở Vé của tôi để lọc trạng thái và xem chi tiết. QR được tạo tại backend, chỉ chứa mã vé.
5. Hủy từng vé trước giờ đón. Xác nhận trong hộp thoại, vé được giữ lại với trạng thái Đã hủy và thời gian hủy. Chỗ trống được hoàn lại.

Giá áp dụng công thức bài tập trong `database/04-example-queries.sql`: 4.000 đ cộng 500 đ cho mỗi km trên chặng. Đây là dữ liệu mô phỏng của dự án. Chưa thu tiền, gửi email, hoàn tiền hay xây hệ thống soát vé. Mục Email trên chi tiết là email tài khoản đặt vé.

Nếu không có chuyến trong ngày, chọn một ngày còn lịch hoặc thêm lịch bằng module quản trị hiện có. Seed tạo lịch cho 14 ngày tại thời điểm khởi tạo, không tự tạo lịch mới mỗi khi mở ứng dụng. Không xóa volume hoặc nhập lại SQL để thử đặt vé.

## Code chính

| File | Trách nhiệm |
| --- | --- |
| `backend/src/bookings/booking.dto.ts` | Kiểm tra dữ liệu đầu vào |
| `backend/src/bookings/bookings.controller.ts` | Các API đặt vé |
| `backend/src/bookings/bookings.service.ts` | Đọc MySQL, tính giá và chỗ, transaction đặt và hủy |
| `frontend/src/pages/BookingSearchPage.jsx` | Tìm chuyến |
| `frontend/src/components/bookings/StationAutocomplete.jsx` | Gợi ý bến theo tên hoặc mã, hỗ trợ không dấu và bàn phím |
| `frontend/src/pages/BookingPage.jsx` | Form hành khách và tổng tiền |
| `frontend/src/pages/BookingSuccessPage.jsx` | Kết quả lần đặt |
| `frontend/src/pages/MyTicketsPage.jsx` | Danh sách và bộ lọc |
| `frontend/src/pages/TicketDetailPage.jsx` | Chi tiết vé và QR |
| `frontend/src/components/bookings/` | Header, trạng thái, hộp thoại dùng chung |
| `frontend/src/pages/bookings.css` | Bố cục Figma và responsive |
| `frontend/src/services/bookingsApi.js` | Gọi API bằng session hiện có |

Các điểm nối vào phần có sẵn chỉ gồm routing trong App, liên kết mua vé trên trang chủ và liên kết chọn chuyến trong kết quả tìm tuyến. Nội dung “đặt vé sắp có” trong spec 0004 là trạng thái trước khi có module này, được thay bằng luồng thật trong spec 0005.

Theo yêu cầu đồng bộ giao diện với trang chủ, BookingLayout dùng lại các class home-brand, home-logo và home-account từ user-home.css. Header hiển thị logo GoBus cùng dòng DI CHUYỂN XANH, tên tài khoản, Vé của tôi và nút Đăng xuất theo mẫu trang chủ. Header xuống hàng trên màn hình nhỏ để các mục không bị ép hẹp.

Chuyển trang hành khách dùng AppLink và history.pushState để giữ ứng dụng cùng phiên đăng nhập trong bộ nhớ. App theo dõi cả đường dẫn và query để chọn đúng chuyến khi URL đổi. Nút Back và liên kết mở tab mới vẫn dùng được. Bộ lọc vé giữ danh sách cũ trong lúc tải, làm mờ và khóa các thao tác trên danh sách đó. Kết quả của yêu cầu đã hủy không được ghi đè bộ lọc mới. Hiệu ứng hiện trang và đổi màu nút chỉ kéo dài khoảng 0,2 giây, tắt khi người dùng chọn giảm chuyển động.

## Kiểm thử

Chạy trong `backend/`:

```powershell
npm run build
npm run lint
npm test
npm run test:e2e
```

Chạy trong `frontend/`:

```powershell
npm run build
npm run lint
npm test
```

`backend/test/bookings.e2e-spec.ts` chạy API riêng ở port 3105, tạo dữ liệu riêng và dọn đúng dữ liệu của kiểm thử. So sánh checksum tất cả hàng gốc sau khi dọn. Bao gồm cạnh tranh chỗ, chặng không giao nhau, từng hành khách, gửi lại request, giá cũ, dữ liệu lỗi, phân quyền và hủy vé. Các suite MySQL chạy tuần tự.

`frontend/src/pages/Bookings.test.jsx` kiểm tra số form, tổng tiền, giữ input khi lỗi, UUID khi thử lại, bộ lọc, QR, modal và trạng thái lỗi. Kiểm tra trình duyệt dùng native dialog thật cho Escape và trả focus.

### Bằng chứng kiểm tra ngày 02/10/2026

Build và lint cả frontend/backend đã qua. Backend unit: 1 kiểm tra; MySQL E2E toàn dự án: 119 kiểm tra trong 6 suite; frontend: 61 kiểm tra trong 7 suite. Riêng đặt vé có 8 kiểm tra MySQL và 8 kiểm tra giao diện. `git diff --check` không báo lỗi whitespace. Không tạo commit hoặc đẩy GitHub.

Lượt kiểm tra trước khi push đã tái hiện và sửa lỗi hủy vé cuối cùng trên trang 2 của bộ lọc Đã đặt: danh sách cũ báo trống dù trang 1 còn vé. Sau khi hủy thành công, danh sách trở về trang 1 và tải lại dữ liệu. Kiểm thử mới thất bại trước bản sửa và qua sau bản sửa. Đã cập nhật thông tin remote bằng `git fetch`; nhánh huyphan không thiếu commit nào từ origin/main tại thời điểm kiểm tra.

Trong lượt kiểm tra lại này, công cụ trình duyệt bị timeout khi kết nối tab, nên không thử lại thao tác hoặc đối chiếu ảnh Figma. Bằng chứng thao tác web và kích thước bên dưới thuộc lượt kiểm tra trước, còn build, lint và các kiểm thử tự động đã chạy lại trên code hiện tại.

Đã đặt hai vé trên web cho chặng Yên Nghĩa → Bác Cổ, chuyến 416, đơn giá 14.000 đ, tổng 28.000 đ. Thành công trả hai vé 39 và 40 với tên và điện thoại riêng. Đã xem QR, hủy từ chi tiết và danh sách, thấy trạng thái Đã hủy và thông báo hoàn lại chỗ. Vé thử 41 dùng để kiểm tra lại hộp thoại. Cả ba vé kiểm thử được dọn riêng sau kiểm tra, checksum hàng gốc trong cả 7 bảng không đổi.

Tại viewport desktop 1440, header 88px, cột trái 760px tại x=80 và cột phải 380px tại x=872. Hộp thoại rộng 440px, padding 32px, radius 20px. Tại viewport mobile 375, form và tóm tắt xếp dọc, thẻ thành công vừa màn hình, không tràn ngang. Font Manrope và nền #f3faf6 được kiểm tra trên trang đang chạy. Tab và Shift+Tab giữ focus trong hộp thoại; Escape đóng hộp thoại và trả focus về nút Hủy vé này. Console không ghi nhận lỗi khi kiểm tra luồng.

Công cụ trình duyệt trả lỗi `Unable to capture screenshot`, nên chưa có ảnh để xác nhận mức giống Figma từng pixel. Bố cục và thao tác đã được kiểm tra trên trang chạy thật; cần một lượt nhìn trực tiếp để chốt những chi tiết thị giác còn lại.

### Kiểm tra chuyển động ngày 03/10/2026

Frontend build và lint đã qua, 65 kiểm tra trong 8 suite đều qua. Kiểm thử tải chậm tái hiện danh sách bị xóa trước bản sửa, sau bản sửa giữ nguyên danh sách và bỏ qua phản hồi của bộ lọc cũ. Kiểm thử App xác nhận từ trang chủ sang Mua vé, giữa các trang vé, đổi query chuyến và hiển thị kết quả đặt vé mà không tải lại phiên đăng nhập.

Đã kiểm tra trên Edge với dữ liệu thật: danh sách Tất cả, đổi sang Đã đặt, Hoàn thành và Đã hủy, sau đó chuyển về trang chủ. Trong lúc tải, khung vé cũ vẫn hiện cùng thông báo cập nhật; vị trí tiêu đề và bộ lọc giữ nguyên. Không đo FPS. Không tạo hoặc hủy vé trong lượt kiểm tra chuyển động này.

### Kiểm tra gợi ý bến ngày 07/10/2026

Frontend build và lint đã qua, 71 kiểm tra trong 9 suite đều qua. `StationAutocomplete.test.jsx` kiểm tra tìm không dấu, tên và mã bến, chọn bằng chuột hoặc bàn phím, đóng danh sách, sửa lựa chọn và nhận ID có sẵn khi API tải xong. `Bookings.test.jsx` xác nhận tìm chuyến bằng ID đã chọn, không gọi API thêm mỗi lần gõ và không gửi tên tự nhập chưa được chọn.

Đã thử trên Edge với MySQL thật: gõ `yen nghia` và `nga tu so`, chọn gợi ý, tìm thấy chuyến 470 cho ngày 07/10/2026 lúc 21:00, còn 60 chỗ, giá 10.500 đ. Danh sách vừa chiều rộng màn hình CSS 375px và cuộn đến mục cuối khi dùng phím lên. Console không có lỗi trong lượt kiểm tra. Chỉ tìm chuyến, không tạo hoặc hủy vé, không đổi dữ liệu hay volume Docker.
