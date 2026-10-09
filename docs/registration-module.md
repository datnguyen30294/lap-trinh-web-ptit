# Đăng ký tài khoản

## Trạng thái

Đã triển khai giao diện `/register`, liên kết Đăng ký ngay từ `/login` và API đăng ký với MySQL local. Thiết kế lấy từ [Đăng ký — Desktop, frame 96:28](https://www.figma.com/design/bPqt1G05XZ7b4cTDiAc0Uo/GoBus-Wireframe-Trang-Chu?node-id=96-28), đọc trực tiếp screenshot và thuộc tính lớp trong trình duyệt Chrome theo yêu cầu người dùng.

Trang dùng font Be Vietnam Pro đóng gói local, CSS riêng `frontend/src/pages/register.css`. Thành công tự đăng nhập và mở `/user/home`. Người đã đăng nhập vào `/register` được chuyển về trang theo vai trò. Form báo lỗi email trùng, xác nhận sai, giới hạn mật khẩu; giữ dữ liệu khi API lỗi, khóa lúc đang gửi và bỏ callback cũ sau khi chuyển trang.

Thiết kế và tiêu chí: [0006-user-registration.md](specs/0006-user-registration.md).

## API

`POST /auth/register` (qua Vite: `POST /api/auth/register`). Gửi header `X-GoBus-Request: 1`, JSON gồm `full_name`, `email`, `password`, `confirm_password`, `terms_accepted: true`. Origin nếu có phải khớp `WEB_ORIGIN`.

Họ tên được trim, email được trim và chuyển chữ thường. Mật khẩu ít nhất 8 ký tự và tối đa 72 byte UTF-8, không trim. Xác nhận phải giống mật khẩu. Role luôn là USER, trạng thái luôn hoạt động. Email trùng trả 409, kể cả khi hai yêu cầu đến đồng thời.

Thành công trả HTTP 201, thông tin `{ id, full_name, email, role }` và cookie session. Không trả mật khẩu hoặc hash. Nếu tài khoản đã tạo nhưng phản hồi hoặc việc lưu session thất bại, có thể đăng nhập bằng email và mật khẩu vừa đăng ký. Giới hạn 20 lần đăng ký mỗi IP trong 15 phút tính cả thành công.

Không cần migration hay biến môi trường mới. Email chưa xác minh quyền sở hữu. Checkbox theo Figma được kiểm tra ở UI và API, chưa lưu lịch sử đồng ý hoặc cung cấp trang pháp lý riêng.

## Kiểm chứng

Chạy từ `backend/`, với MySQL local và `.env` của dự án:

```bash
npm run build
npm run lint
npm test
npx vitest run --config ./vitest.config.e2e.ts test/registration.e2e-spec.ts
```

Ngày 09/10/2026: build và lint đạt, 33 unit test backend đạt, 18 kiểm thử đăng ký với MySQL thật đạt; 36 kiểm thử frontend trong App.test.jsx và RegisterPage.test.jsx đạt. Subagent độc lập xác minh backend và rà soát UI; lỗi callback đăng nhập cũ sau khi chuyển trang đã được sửa và có regression test. Kiểm thử API dùng server riêng cổng 3107, tạo email ngẫu nhiên riêng, dọn đúng các tài khoản đó và kiểm tra toàn bộ bản ghi users ban đầu vẫn giữ nguyên.

Kiểm tra cuối: toàn bộ 145 kiểm thử frontend trong 16 file và production build đều đạt. Build còn cảnh báo bundle trên 500 kB; môi trường test có thông báo JSDOM chưa triển khai `window.scrollTo`, không gây test thất bại.

Chạy kiểm thử frontend từ `frontend/`:

```bash
npm test
npm run build
npm run lint
```

Đã kiểm tra trực tiếp Chrome ở 1360×820 và 390×844: bố cục desktop đúng vị trí/kích thước hai khối chính; mobile một cột, không tràn ngang; form trống được chặn và focus vào Họ và tên; liên kết qua lại đăng nhập/đăng ký hoạt động. Ảnh: [desktop](screenshots/registration/desktop.jpg), [mobile](screenshots/registration/mobile.jpg). Luồng tạo tài khoản thành công được kiểm tra bằng UI test với API mock và E2E API với MySQL, không tạo tài khoản thủ công bằng trình duyệt.

Các trường hợp đã kiểm tra: tạo tài khoản và cookie, hash cost 12, giữ nguyên khoảng trắng trong mật khẩu, khôi phục session, đăng xuất và đăng nhập lại, chặn API ADMIN, email trùng khác hoa thường, đăng ký đồng thời, dữ liệu sai, mật khẩu Unicode quá dài, xác nhận sai, chèn role/trạng thái/hash, thiếu header, sai origin và rate limit.
