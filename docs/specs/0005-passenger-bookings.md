# 0005 · Đặt vé hành khách

**Status**: In Progress
**Date**: 2026-10-02

## Summary

Xây luồng chọn chuyến, nhập từng hành khách, đặt thành công, vé của tôi, chi tiết và hủy vé bằng MySQL thật. Dùng Figma đã được người dùng chọn, giữ các module quản trị và trang chủ của thành viên khác. Không thanh toán hay gửi email, theo câu trả lời của người dùng.

## Context

React JSX và CSS thuần, NestJS với TypeORM, MySQL hiện tại có một hàng bookings cho mỗi vé. Session và PassengerGuard đã có. Không cần migration. Người dùng chọn toàn bộ luồng và yêu cầu mỗi vé có hành khách riêng. Chưa có scope; triển khai theo lát cắt đầy đủ từ API tới UI.

## Requirements

- AC-1: USER gõ tên hoặc mã bến để chọn điểm đi, điểm đến từ gợi ý trong database và chọn ngày Việt Nam để xem chuyến thật, giá và số chỗ trên chặng. Hỗ trợ chữ không dấu, bàn phím và kiểm tra bến đã chọn. Có loading, lỗi, trống và phân trang.
- AC-2: Trang xác nhận theo Figma 96:149. Số vé điều khiển số form hành khách, mỗi form có tên và điện thoại riêng. Đơn hàng tính đúng giá backend nhân số vé.
- AC-3: Đặt nhiều vé là một transaction. Tạo mỗi hành khách một hàng bookings. Không vượt sức chứa trên bất kỳ đoạn con nào. Gửi lại cùng request không tạo thêm vé.
- AC-4: Thành công theo 105:237, có tổng tiền đặt, từng mã vé và liên kết xem vé. Không nói đã thanh toán hoặc gửi email.
- AC-5: Vé của tôi theo 105:291, lọc tất cả, đã đặt, hoàn thành, đã hủy. Chỉ trả vé của user trong session, có phân trang.
- AC-6: Chi tiết theo 118:2, hiển thị dữ liệu thật và QR chứa booking_code, không chứa thông tin cá nhân. QR không phải hệ thống soát vé mới.
- AC-7: Hủy từng vé với modal theo 118:189 và 119:573. Giữ hàng lịch sử, cập nhật CANCELLED và cancelled_at. Hủy lại trả cùng trạng thái. Vé đã lên xe hoặc chuyến hoàn thành không được hủy.
- AC-8: Giữ dữ liệu và volume gốc. Kiểm thử cạnh tranh chỗ, dữ liệu riêng, CSRF, validation và mobile; module có sẵn vẫn qua build và test.

## Decision

Thêm BookingsModule độc lập. Tái sử dụng PassengerGuard, AuthModule, request helper và dialog hiện tại. Chỉ đổi các điểm nối App, nút mua vé của trang chủ và nút chọn chuyến từ kết quả tuyến. CSS booking có phạm vi riêng, dùng Manrope đã cài. QR dùng thư viện qrcode, tạo cục bộ tại backend; không gọi dịch vụ ảnh bên ngoài.

## Feature design

### Data model và nguồn giá trị

| Giá trị | Nguồn |
| --- | --- |
| Chủ vé | req.session.userId, guard kiểm tra users.is_active |
| Tuyến, bến, xe | routes, route_stops, stations, vehicles qua schedules |
| Ngày tìm | input YYYY-MM-DD, chuyển đầu/cuối ngày Việt Nam sang UTC |
| Giờ đón/trả | schedules.departure_at cộng minutes_from_origin của bến |
| Chặng và giá mới | stop_order tăng; ROUND(4000 + 500 × (km đến − km đi), 0), theo 04-example-queries.sql |
| Giá lịch sử | bookings.unit_price, không tính lại |
| Chỗ trên chặng | capacity trừ số vé CONFIRMED giao nhau trên mỗi đoạn con, lấy giá trị thấp nhất |
| Hành khách | mảng passengers từ form; mỗi phần tử tạo một vé |
| Email hiển thị | users.email của chủ vé, không lưu email hành khách mới |
| Mã vé | GB + SHA256(userId:request UUID) lấy 16 hex + số thứ tự 5 chữ số, tổng 24 ký tự |
| Idempotency | tiền tố mã vé xác định từ request_id; retry đối chiếu toàn bộ payload với hàng đã có |
| Tổng | đơn giá nhân số hành khách của lần đặt; mỗi vé lịch sử có số lượng 1 |
| Hoàn thành | schedule.status=COMPLETED hoặc giờ trả đã qua; CANCELLED ưu tiên |
| Có thể hủy | CONFIRMED, chưa tới giờ đón, schedule chưa COMPLETED/CANCELLED |
| Đồng hồ | UTC_TIMESTAMP(3) MySQL, hiển thị Asia/Ho_Chi_Minh |
| QR | booking_code, 200 × 200 px, màu #122e22 và trắng |

Giữ nguyên quan hệ users 1:N bookings; schedules 1:N bookings; bến đi và đến đều thuộc tuyến của chuyến. Không thêm bảng hoặc cột. Vé nhiều hành khách hiển thị riêng trong danh sách, có tên để phân biệt.

### API

Mọi endpoint cần PassengerGuard, USER hoặc ADMIN. Admin chỉ xem vé của chính mình trong module này. Không nhận user_id từ client.

| Method | Path | Input và output |
| --- | --- | --- |
| GET | /bookings/trips | from_station_id, to_station_id, date, route_id tùy chọn, page, limit; chuyến phù hợp và phân trang |
| GET | /bookings/trips/:id | from_station_id, to_station_id; báo giá và chỗ hiện tại |
| POST | /bookings | schedule_id, from_station_id, to_station_id, unit_price đã xem, request_id UUID, passengers[{passenger_name,contact_phone}]; các id đã tạo |
| GET | /bookings | filter, page, limit; danh sách vé của session |
| GET | /bookings/:id | chi tiết thuộc session và QR data URL |
| PATCH | /bookings/:id/cancel | không cần payload; trạng thái sau hủy |

400 cho input không hợp lệ; 401/403 từ guard; 404 khi không tồn tại hoặc không thuộc user; 409 khi giá/chỗ/trạng thái đổi, hành trình thiếu phút hoặc khóa xung đột. Không lộ SQL và thông tin cá nhân qua lỗi.

### Transaction và kiểm tra

Booking create chụp route/vehicle/stop IDs, khóa stations tăng dần, route, route_stops, vehicle, schedule, rồi bookings. Đọc lại IDs dưới khóa; snapshot đổi thì 409. Giữ cùng thứ tự với module schedules và routes. READ COMMITTED tránh snapshot cũ khi đọc chỗ. Khóa schedule để tuần tự hóa đặt/hủy. Không khóa cha sau schedule.

Chỉ chào chuyến SCHEDULED chưa khởi hành và tuyến ACTIVE, mọi bến đang hoạt động, hành trình phút/km hợp lệ. Đọc chỗ theo giao nhau: vé a→b chiếm đoạn s khi a.order<=s.order và b.order>s.order. Thiếu phút thì báo không thể đặt. Mỗi hành khách có tên trimmed 1..120, điện thoại 8..20 ký tự chứa số, khoảng trắng, +, dấu ngoặc hoặc dấu gạch. Số hành khách không vượt chỗ và tối đa sức chứa của xe.

Cancel khóa schedule rồi booking, không khóa lại cha, không xóa vé. Current read kiểm tra owner, giờ đón và trạng thái. Timestamp hủy từ DB. Lỗi SQL khóa/duplicate/FK được chuyển thành 409. Không gọi email/thanh toán hoặc tự thay dữ liệu tuyến/lịch.

### UI và routing

- /user/bookings: tìm chuyến; tận dụng cấu trúc thẻ trắng và bộ lọc hiện có.
- Bổ sung ngày 07/10/2026 theo yêu cầu người dùng: hai ô bến dùng StationAutocomplete, nhận danh sách từ GET /passenger/stations. Lọc tại frontend theo các từ trong tên hoặc mã bến, không phân biệt dấu và chữ hoa. Chọn gợi ý bằng chuột hoặc phím lên/xuống và Enter; Escape hoặc rời ô đóng danh sách. Khi sửa chữ, xóa ID đã chọn và yêu cầu chọn lại bến hợp lệ. Danh sách cuộn trong khung, dùng được trên mobile. Giữ nguyên backend và schema; không gọi Google Maps.
- /user/bookings/new?trip=...&from=...&to=...: header 88px, lề desktop 80px, quay lại tìm chuyến, tiêu đề, cột 760px và 380px, gap 32px; thẻ 32px padding, radius 20px.
- /user/bookings/success?request=...: xác nhận ở giữa, thẻ 520px, các mã vé riêng, nút vé của tôi và trang chủ. GET /bookings/receipt/:requestId đọc toàn bộ vé của lần đặt thuộc user trong một truy vấn.
- /user/tickets và /user/tickets/:id: danh sách và chi tiết, toàn bộ trạng thái Figma đã chọn.
- Mobile xếp cột dọc, không tràn ngang. Modal tái sử dụng native dialog, giữ focus, Escape và trạng thái đang hủy.

Figma file bPqt1G05XZ7b4cTDiAc0Uo, nodes 96:149, 105:237, 105:291, 118:2, 118:189, 119:573, 119:660, 118:385. Không có static image asset trong các frame này. Logo, avatar và dấu thành công là chữ/CSS; QR là dữ liệu động.

## Options considered

Giao diện giả ít thay đổi nhưng không đáp ứng MySQL thật. Đổi schema để lưu đơn hàng gom nhiều vé làm rộng phạm vi và ảnh hưởng module khác. Dùng một hàng cho từng vé khớp mô hình hiện tại và câu trả lời của người dùng.

## Rationale

Module độc lập dễ đọc và phân chia trách nhiệm nhóm. Giữ mô hình một vé cho mỗi hành khách tránh migration. Khóa theo thứ tự hiện tại ngăn deadlock do đảo thứ tự và kiểm tra chỗ dưới transaction ngăn bán vượt chỗ. QR chỉ chứa mã vé giúp tránh đưa tên/điện thoại vào hình.

## Build plan

- [x] AC-1, AC-3, AC-7: API đọc chuyến, báo giá, transaction đặt/hủy và danh sách sở hữu.
- [x] AC-2, AC-4: form từng hành khách và màn hình thành công.
- [x] AC-5, AC-6, AC-7: vé của tôi, chi tiết, QR và modal.
- [x] AC-1, AC-8: nối navigation, build, lint, kiểm thử thật và kiểm tra desktop/mobile.

Kiểm tra chức năng và kích thước trên trình duyệt đã hoàn tất, xem `../bookings-module.md`. Chưa đối chiếu bằng ảnh do công cụ chụp ảnh báo lỗi; cần nhìn trực tiếp để chốt chi tiết thị giác. Không có scope row để đổi trạng thái Accepted.

## Consequences

Giá chỉ là công thức bài tập hiện tại. Chưa có thu tiền, hoàn tiền, gửi email hoặc API soát vé. Vé theo từng hành khách nên hai hành khách tạo hai thẻ trong danh sách. Schema lịch sử thiếu minutes_from_origin có thể xem vé nhưng chưa thể đặt chuyến mới cho hành trình đó.
