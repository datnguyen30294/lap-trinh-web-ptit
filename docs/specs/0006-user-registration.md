# 0006 · Đăng ký tài khoản hành khách

**Status**: Accepted
**Date**: 2026-10-09

## Summary

Khách tạo tài khoản USER bằng họ tên, email và mật khẩu, sau đó được đăng nhập bằng session hiện có. Giao diện phải lấy từ Figma GoBus, frame `96:28` (Đăng ký — Desktop), trên page `14:2` của file `bPqt1G05XZ7b4cTDiAc0Uo`.

## Requirements

- AC-1: Khách truy cập `/register` từ trang đăng nhập và quay lại `/login`. Người đã đăng nhập truy cập `/register` được chuyển về trang theo vai trò.
- AC-2: Đăng ký hợp lệ tạo đúng một tài khoản USER đang hoạt động, lưu mật khẩu bằng bcrypt cost 12, trả thông tin công khai và tạo session mới. Giao diện chuyển đến `/user/home`.
- AC-3: Họ tên sau trim có 1 đến 120 ký tự; email hợp lệ tối đa 160 ký tự, trim và chuyển chữ thường. Mật khẩu ít nhất 8 ký tự, tối đa 72 byte UTF-8, không trim; xác nhận phải giống mật khẩu. Dữ liệu thiếu hoặc trường ngoài hợp đồng trả 400.
- AC-4: Email trùng, kể cả khác hoa thường hoặc hai yêu cầu đồng thời, trả 409; không sửa tài khoản đã có. Không cho truyền role, is_active hoặc password_hash.
- AC-5: Giao diện có trạng thái đang gửi, lỗi rõ ràng, giữ dữ liệu khi lỗi và ngăn gửi lặp. Đúng thiết kế Figma, dùng được trên màn nhỏ và bàn phím. Checkbox đồng ý điều khoản bắt buộc, API chỉ nhận terms_accepted=true.
- AC-6: Endpoint áp dụng kiểm tra origin/header hiện có và giới hạn 20 yêu cầu mỗi IP mỗi 15 phút, gồm cả thành công. Tài khoản mới không truy cập được API ADMIN. Đăng xuất và đăng nhập lại bằng mật khẩu mới hoạt động.

## Decision

Mở rộng AuthModule hiện có, dùng bảng users và session cookie của dự án. Không cần biến môi trường hoặc migration mới. Thêm font local `@fontsource/be-vietnam-pro` để khớp Figma. Người dùng yêu cầu triển khai ngay, đọc thiết kế trực tiếp trong trình duyệt và dùng subagent để xác minh.

## Feature design

### Data model

Giữ nguyên `database/01-schema.sql`. `users.id` do MySQL sinh; `full_name`, `email` lấy từ dữ liệu đã kiểm tra; `password_hash` do bcrypt tạo; server cố định `role=USER`, `is_active=true`. `phone` giữ NULL. Unique key `uq_users_email` là ràng buộc cuối cùng cho đăng ký đồng thời.

### API

`POST /auth/register`, public, JSON gồm `full_name`, `email`, `password`, `confirm_password`, `terms_accepted: true`. Trả 201 với `{ id, full_name, email, role }`; không trả hash hoặc mật khẩu. Lỗi 400 dữ liệu, 403 yêu cầu không hợp lệ, 409 email đã tồn tại, 429 quá nhiều yêu cầu, 500 lỗi nội bộ. Checkbox lấy từ thiết kế Figma; giá trị xác nhận chỉ kiểm tra khi đăng ký, không lưu lịch sử chấp thuận vào database.

Session được regenerate rồi save như đăng nhập. Tài khoản được lưu trước session; nếu tạo session thất bại, người dùng vẫn có thể đăng nhập bằng tài khoản vừa tạo. Log thành công chỉ chứa ID tài khoản, không chứa email hoặc mật khẩu.

### Value sourcing

| Giá trị | Nguồn |
| --- | --- |
| Họ tên, email | Input đã chuẩn hóa bởi RegisterDto |
| Hash mật khẩu | bcrypt cost 12 từ password nguyên bản |
| Xác nhận mật khẩu | So sánh confirm_password với password, không lưu |
| ID | MySQL AUTO_INCREMENT |
| Role, trạng thái | Server cố định USER và true |
| Cookie | express-session và SESSION_SECRET hiện có |
| Điều hướng thành công | homePath(USER) = /user/home |
| Đồng ý điều khoản | Checkbox form, chỉ chấp nhận boolean true |
| Bố cục, màu, font, nội dung và hình dạng | Figma frame 96:28, screenshot và thuộc tính lớp đọc trực tiếp trong Chrome theo yêu cầu người dùng |

### UI

Route `/register` là trang public. Dùng AppLink, authApi và callback cập nhật session của App. Trang đăng nhập có liên kết Đăng ký ngay. Người đã đăng nhập vào `/register` trở về trang theo vai trò. Callback đăng nhập và đăng ký đều bỏ qua phản hồi khi người dùng đã chuyển trang.

Nguồn trực tiếp: Figma frame 96:28, được đọc qua screenshot và panel Design trong Chrome ngày 09/10/2026. Font Be Vietnam Pro 400/600/700. Header trắng cao 80px, logo gồm hình vuông bo góc 38px và chữ GoBus. Nền `#F7FAF5`; khối giới thiệu `#1A4033`, 580×580 tại (76,160); form trắng 470×650 tại (790,122), trên canvas 1360×820. Nút `#1A694D`, input viền `#C4CFC4`, chữ phụ `#59635E`. Không có ảnh hoặc SVG cần tải trong frame này.

Tiêu đề giới thiệu 38/53px, tiêu đề form 28/39px; input 370×44px; checkbox 16px; nút 370×48px. CSS riêng `pages/register.css`. Form có label, autocomplete, lỗi aria-invalid/aria-describedby và focus tới thông báo lỗi. Desktop dùng grid, dưới 800px chuyển thành một cột; thẻ tự tăng chiều cao khi có lỗi, không dùng tọa độ tuyệt đối cho form.

Điều chỉnh phục vụ chạy thật: không bo góc toàn bộ cửa sổ như khung canvas; trạng thái validation/loading; vùng bấm liên kết ít nhất 44px; min font input 16px trên điện thoại. Dòng điều khoản giữ dạng chữ như Figma, chưa có trang pháp lý riêng.

## Build plan

1. Đã hoàn thành DTO, service, controller và rate limit, AC-2, AC-3, AC-4, AC-6.
2. Đã đọc thiết kế Figma, hoàn thiện UI và điều hướng, AC-1, AC-2, AC-5.
3. Đã đạt 18 kiểm thử API với MySQL và 36 kiểm thử form/điều hướng. Đã kiểm tra desktop 1360×820 và mobile 390×844 trong Chrome. Xem `../registration-module.md`.

## Consequences

Tài khoản tự đăng ký có thể dùng ngay. Email chưa xác minh quyền sở hữu; dự án chưa có dịch vụ gửi email. Session và bộ đếm rate limit tiếp tục dùng bộ nhớ của một tiến trình như cấu hình hiện tại.
