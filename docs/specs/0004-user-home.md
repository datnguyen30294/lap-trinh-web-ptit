# Trang chủ hành khách và điều hướng theo vai trò

## Mục tiêu

Tài khoản USER hiện đăng nhập được nhưng gặp màn hình không có quyền quản trị. Thay màn hình này bằng trang chủ hành khách `/user/home`, đồng thời bảo toàn các module ADMIN.

## Thiết kế

- Nguồn: [Figma GoBus, frame 102:3](https://www.figma.com/design/bPqt1G05XZ7b4cTDiAc0Uo/GoBus-Wireframe-Trang-Chu?node-id=102-3).
- Link ban đầu `14:2` là cả canvas; section Trang chủ là `102:2`, frame thực tế là `102:3`, kích thước 1440 × 1687.
- Đã đọc design context chi tiết và screenshot trước khi triển khai. Frame gồm utility bar 40px, header 80px, hero 520px, ba thẻ giới thiệu và footer.
- Manrope là font của frame này, được đóng gói cục bộ qua `@fontsource-variable/manrope`. Giao diện admin tiếp tục dùng Geist.
- Chỉ tìm thấy bản desktop trong section Trang chủ. Bản mobile chuyển thành một cột, giữ các khu vực và tài nguyên gốc.

## Điều hướng

| Tình huống | Kết quả |
| --- | --- |
| Chưa có phiên, truy cập trang được bảo vệ | `/login` |
| USER đăng nhập, mở `/`, `/login` hoặc trang ADMIN | `/user/home` |
| ADMIN đăng nhập từ trang quản trị hợp lệ | Giữ `/stations`, `/routes` hoặc `/schedules` tương ứng |
| ADMIN đăng nhập từ `/login`, mở `/` hoặc `/user/home` | `/stations` |
| Phiên hợp lệ, đường dẫn không tồn tại | Trang không tìm thấy và liên kết về trang chủ đúng vai trò |
| Vai trò không hợp lệ | Không cấp quyền; cho phép đăng xuất |
| Đăng xuất thành công hoặc phiên hết hạn | `/login` với thông báo |
| Đăng xuất thất bại | Giữ phiên trên giao diện và hiển thị lỗi để thử lại |

Dùng History API cho chuyển hướng thay thế và lắng nghe `popstate`, không thêm router. Các liên kết giữa trang vẫn là liên kết HTML. Kiểm tra phiên ban đầu, khi cửa sổ được focus/hiện lại và khi API phát sự kiện 401. Mã thứ tự yêu cầu ngăn phản hồi kiểm tra phiên cũ khôi phục người dùng sau đăng xuất. Chỉ render giao diện đúng vai trò sau khi xác thực.

## Tra cứu trên trang chủ

- Hai trường chọn bến lấy dữ liệu MySQL; các tuyến gợi ý lấy từ API.
- Tìm tuyến đi thẳng qua hai bến theo thứ tự `stop_order`, hỗ trợ bến trung gian; không tìm nối chuyến, vị trí GPS hoặc bản đồ.
- Kết quả trong hộp thoại có phân trang, thứ tự điểm dừng, giờ hoạt động theo giờ Việt Nam và khoảng cách toàn tuyến.
- Không suy ra chuyến đang chạy, số chỗ trống hay giá vé từ dữ liệu tuyến.
- Bản đồ, đặt vé, mạng xã hội và các trang thông tin chưa có hiển thị thông báo Sắp có. Không tạo giao dịch hay kết quả giả.

## API và bảo toàn dữ liệu

- `GET /passenger/stations`: bến thuộc tuyến khả dụng; chỉ trả id, code, name.
- `GET /passenger/routes`: tham số `from_station_id`, `to_station_id` (phải đi cùng nhau), `route_id`, `page`, `limit` (tối đa 50).
- Chỉ trả tuyến ACTIVE với bến đầu, bến cuối và tất cả điểm dừng đang hoạt động. Các ID là chuỗi để không mất độ chính xác BIGINT.
- PassengerGuard kiểm tra phiên, trạng thái tài khoản và vai trò hiện tại từ MySQL. USER và ADMIN được đọc; chưa đăng nhập nhận 401.
- Giữ nguyên AdminGuard trên các API quản trị. Không có API ghi trong module hành khách; không thay schema, session cookie hoặc cơ chế CSRF.

## Tiêu chí nghiệm thu

Đăng nhập USER/ADMIN, tải lại trang, URL trực tiếp, Back, mất phiên, lỗi đăng xuất và kiểm tra 403 phải đúng; desktop bám frame; mobile không tràn ngang; tài nguyên tải cục bộ; API trả dữ liệu thật và kiểm tra dữ liệu gốc không đổi sau bộ kiểm thử.
