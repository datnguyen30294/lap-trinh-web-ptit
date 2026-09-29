# 0001. Quản lý bến xe GoBus

**Date**: 2026-09-29
**Status**: In Progress

## Summary

Hoàn thiện module stations từ MySQL qua NestJS đến React. Quản trị viên đăng nhập bằng tài khoản users hiện có để quản lý bến. Giữ dữ liệu và các quan hệ lịch sử.

## Context

Hiện chỉ có GET /stations, entity thiếu is_active, frontend chưa có entry point. Chưa có cơ chế đăng nhập. Database cấu hình thực tế là gobus_hanoi_student, có 32 bến, khác schema ERD: thiếu stations.is_active, users.is_active, routes.status. Bổ sung migration giới hạn ba cột này, không đổi DB_NAME.

## Requirements

User story: ADMIN quản lý danh mục bến và trạng thái mà không làm mất tuyến, vé.

- **AC-1**: Danh sách từ MySQL, phân trang, tìm mã/tên/địa chỉ, lọc trạng thái, tổng số đúng.
- **AC-2**: Thêm/sửa code/name/address; trim, bắt buộc, giới hạn 20/160/255 ký tự; mã trùng trả 409, ID sai trả 400, không tồn tại trả 404.
- **AC-3**: Xác nhận trước đổi is_active; cập nhật chấm và chữ xanh “Đang hoạt động” hoặc xám “Ngừng hoạt động”, tải lại API sau mọi mutation.
- **AC-4**: Bến thuộc tuyến ACTIVE (đầu/cuối hoặc route_stops) không được ngừng, lỗi 409 nêu tuyến. Không xóa bến/tuyến/vé, giữ synchronize:false.
- **AC-5**: Đăng nhập/đăng xuất bằng users và bcrypt hiện có; API quản trị kiểm tra ADMIN hiện tại từ DB, 401 chưa đăng nhập, 403 USER; chống payload sai và CSRF.
- **AC-6**: UI tiếng Việt theo Figma, có loading/empty/error/success, form/modal truy cập bàn phím, thích nghi 390px và desktop.
- **AC-7**: Build/lint/test phù hợp và kiểm chứng luồng qua API + trình duyệt với MySQL thật, không thay đổi dữ liệu gốc.

## Options considered

1. Cho phép ngừng bến bất kể tuyến: đơn giản nhưng khiến tuyến đang khai thác tham chiếu bến đã ngừng.
2. Chặn nếu còn tuyến ACTIVE: cần xử lý tuyến trước nhưng an toàn cho khai thác. Chọn phương án này.

## Decision

Mở rộng module stations hiện có. Hoàn thiện một luồng xuyên suốt dữ liệu, API và giao diện. Bổ sung auth tối thiểu bằng express-session cookie HttpOnly, bcryptjs, users; phiên 8 giờ trong bộ nhớ phục vụ ứng dụng local một instance. Dùng class-validator/class-transformer tại HTTP boundary.

**Implementation skills**: develop (jsmastery-pro/skills, .agents/skills/develop/); figma-design-to-code; check verify (.agents/skills/check/).

## Rationale

Giữ nguyên bảng và khóa ngoại bảo toàn lịch sử. Phiên phía server hỗ trợ logout ngay, không lưu token trong localStorage. Không đưa hạ tầng Redis vào dự án học tập hiện tại; triển khai nhiều instance cần session store dùng chung.

## Feature design

### Migration triển khai

Script database/migrations/004-stations-module.mjs đọc root .env, sao lưu schema và rows mọi bảng vào .local/backups (ignored), chỉ ADD cột còn thiếu: stations.is_active/users.is_active default true; routes.status default ACTIVE. Các tuyến trước đây chưa có trạng thái được coi đang hoạt động để chặn ngừng bến an toàn. Không thay hash mật khẩu, khóa ngoại hoặc các cột hiện có. So sánh SHA256 rows theo cột gốc trước/sau. Không thay đổi các khác biệt schema ngoài module (vehicles/fares/schedules). Chạy lại không nhân đôi cột.

### Data model and invariants

stations: id bigint unsigned biểu diễn string trong JS; code varchar20 UNIQUE, name varchar160, address varchar255, is_active boolean. Không DELETE. Create mặc định active; update chỉ thông tin, trạng thái qua endpoint riêng. Unique constraint MySQL là lớp bảo vệ cuối cùng kể cả tạo đồng thời, theo collation hiện có. Trim giữ nguyên cách viết mã. Không thêm ghi chú vì schema không có.

Đổi trạng thái trong transaction khóa hàng station; kiểm tra routes ACTIVE có origin/destination hoặc route_stops. API tuyến trong tương lai phải khóa cùng station và kiểm tra active khi thêm/chuyển tuyến sang ACTIVE; sửa trực tiếp SQL nằm ngoài đảm bảo này.

### API surface

| Method/path | Input | Output | Quyền/lỗi |
|---|---|---|---|
| POST /auth/login | email, password | id, full_name, email, role | public; 400/401/429 |
| GET /auth/me | cookie | thông tin user | 401 |
| POST /auth/logout | cookie | message | hủy phiên |
| GET /stations | page=1, limit=10 (max100), search<=255, is_active=true/false | items,total,page,limit,totalPages | ADMIN; 400/401/403 |
| POST /stations | code,name,address | station | ADMIN; 400/409 |
| PATCH /stations/:id | đủ code,name,address | station | ADMIN; 400/404/409 |
| PATCH /stations/:id/status | is_active:boolean | station | ADMIN; 400/404/409 + routes |

### Value sourcing

| Giá trị | Nguồn |
|---|---|
| Các cột bến | stations trong MySQL |
| Tổng, số trang, STT | count sau lọc, ceil(total/limit), offset + vị trí |
| Search | query người dùng, LIKE escape ký tự %, _, !; so sánh theo collation DB |
| Trạng thái chữ/màu/nút | is_active từ API; true xanh, false xám |
| Tuyến chặn | routes.status ACTIVE + route_stops/origin/destination |
| Người đăng nhập/quyền | users DB hiện tại, không nhận role từ client |
| Tên/mã/địa chỉ mới | form trim và DTO validation |

### Security and configuration

Session regenerate sau đăng nhập, destroy khi logout; cookie HttpOnly/SameSite strict, secure khi production. Không trả hash. Guard đọc lại user active/role mỗi request. PORT=3001 (3000 bị container khác chiếm). SESSION_SECRET >=32 ký tự trong root .env. WEB_ORIGIN mặc định http://localhost:5173. Header X-GoBus-Request: 1 bắt buộc cho mutation và Origin nếu có phải thuộc WEB_ORIGIN; CORS chỉ cho origin đó. Login rate limit theo IP. Vite proxy /api sang localhost:3001, cookie same-origin ở frontend. Không tin client role, không cấp đăng ký ADMIN.

### UI screens and states

/ và /stations hiển thị module, auth gate đăng nhập; USER thấy thông báo thiếu quyền và nút đăng xuất. Figma file bPqt1G05XZ7b4cTDiAc0Uo: list 92:558, add 92:699, edit 92:999, confirm 92:1148, blocked 92:1287. Giữ header/sidebar, bảng nền trắng, Geist, modal. Bổ sung code/filter/pagination, thay xóa bằng đổi trạng thái, bỏ ghi chú không có schema. Các module sidebar khác chỉ nhãn chưa khả dụng, không tạo link giả. Mobile chuyển hàng thành card; modal fit màn hình. Native dialog để quản lý focus/Escape. Loading, lỗi tải có thử lại, rỗng có reset tìm kiếm, thông báo thành công, lỗi mutation giữ form.

### Critical test scenarios

- AC-1/2/3: login, search code/name/address, phân trang/lọc, thêm/sửa/ngừng/kích hoạt fixture; UI và API khớp.
- AC-2/4: whitespace, quá dài, body thừa, boolean sai, ID lỗi, mã trùng và concurrent duplicate; seeded station thuộc tuyến ACTIVE bị chặn, dữ liệu nguyên vẹn.
- AC-5: không cookie, USER, login sai, CSRF, logout invalidates session.
- AC-6/7: desktop/mobile, loading/rỗng/lỗi, bàn phím/modal; build/lint/test.

## Build plan

- [ ] Auth/config/DTO + station entity/API, AC-1/2/4/5.
- [ ] React page/components/services và CSS/Figma assets, AC-1/2/3/6.
- [ ] Regression tests và live verification, AC-1–7.
- [ ] Hướng dẫn khởi động, giới hạn triển khai, kết quả kiểm chứng, AC-7.

## Consequences

- Migration cộng thêm ba cột còn thiếu theo schema; sao lưu và kiểm tra hash các cột gốc, không xóa volume hoặc seed lại.
- GET /stations đổi từ array sang envelope phân trang và yêu cầu ADMIN.
- Restart backend làm hết phiên local. Trước production phải bổ sung session store bền vững, HTTPS và cấu hình proxy tin cậy; hiện chưa có đăng ký/quên mật khẩu/quản lý tuyến.
