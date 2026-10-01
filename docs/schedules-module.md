# Quản lý lịch trình chạy xe

Module ở `/schedules`, dùng React/Vite, NestJS và MySQL thật. Đặc tả và quy ước khóa ở [0003](specs/0003-schedules-management.md). Kết quả kiểm chứng ở [schedules-verification.md](schedules-verification.md).

## Chạy local

Giữ nguyên `.env` đang sử dụng. Cần các biến kết nối DB hiện có, `SESSION_SECRET`, `PORT` (local 3001). Không thay DB_NAME để khớp schema tài liệu. Không chạy lại seed.

Từ thư mục gốc:

```bash
docker compose up -d
```

Trong terminal tại `backend/`:

```bash
npm install
npm run start:dev
```

Trong terminal tại `frontend/`:

```bash
npm install
npm run dev
```

Mở `http://localhost:5173/schedules`, đăng nhập tài khoản ADMIN hiện có. Frontend gọi `/api` qua proxy Vite; backend kiểm tra session, quyền hiện tại và header `X-GoBus-Request` theo cơ chế chung.

## Database và dữ liệu cũ

Không có migration mới cho module lịch trình. `synchronize: false` được giữ nguyên. DB đã kiểm tra có `vehicles`, `schedules.vehicle_id`, thời gian `DATETIME(3)`, trạng thái `SCHEDULED/DEPARTED/COMPLETED/CANCELLED`; không có `fares` hoặc trạng thái xe. Module yêu cầu migration 005 của quản lý tuyến đã bổ sung cột phút nếu trước đó chưa có; xem [hướng dẫn tuyến](routes-module.md).

43 điểm dừng gốc có phút NULL được giữ nguyên. Vẫn xem được lịch trình cũ; giờ từng điểm thiếu phút hiển thị chưa có dữ liệu. Không thể tạo hoặc khởi hành trên tuyến thiếu thời lượng. Cần hiệu chỉnh hành trình bằng dữ liệu thực qua module tuyến khi quy tắc lịch sử/lịch chạy cho phép, hoặc tạo tuyến mới phù hợp. Không tự suy phút từ km.

Datetime lưu UTC; API nhận ISO có `Z`, tối đa millisecond. Giao diện nhập/hiển thị Việt Nam UTC+7 độc lập múi giờ máy. Lọc ngày dùng đầu ngày bao gồm, đầu ngày tiếp theo loại trừ.

## Sử dụng

- Tìm mã/tên tuyến hoặc mã xe, lọc tuyến, ngày và trạng thái; danh sách có phân trang.
- Chọn ID để xem xe, sức chứa, vé CONFIRMED và hành trình kèm giờ từng điểm.
- Thêm lịch: chọn tuyến có đủ phút, chọn xe, nhập giờ Việt Nam; giờ đến tự tính. Backend kiểm tra lại tuyến/bến, tương lai, giờ hoạt động và giao nhau của xe.
- Sửa chỉ áp dụng SCHEDULED chưa đến giờ và chưa có booking nào. Vé đã hủy cũng khóa lịch sử.
- Hủy chỉ khi không còn CONFIRMED, có xác nhận, không tự sửa booking. Không khôi phục lịch hủy.
- Khởi hành chỉ trong khoảng từ giờ xuất phát tới trước giờ đến; kiểm tra lại hành trình và xe. Hoàn thành chỉ từ DEPARTED khi đã tới giờ đến.

Hai khoảng tiếp giáp được phép. Unique `(vehicle_id, departure_at)` của DB vẫn giữ cả lịch CANCELLED nên không tái dùng đúng cặp xe/giờ đó; API trả 409 giải thích. Tổng vé xác nhận không được hiểu là số ghế đang bị chiếm ở mọi chặng.

## API

Tất cả endpoint yêu cầu ADMIN; ID BIGINT truyền dạng chuỗi. Pagination trả `{items,total,page,limit,totalPages}`.

| Method | Endpoint | Nội dung |
|---|---|---|
| GET | `/schedules` | page, limit, search, route_id, date_from, date_to, status |
| GET | `/schedules/vehicles` | Chọn xe thật, page/limit/search |
| GET | `/schedules/:id` | Chi tiết, stops, can_edit, edit_block_reason |
| POST | `/schedules` | route_id, vehicle_id, departure_at, arrival_at |
| PATCH | `/schedules/:id` | Cùng 4 trường tạo; không nhận status/capacity |
| PATCH | `/schedules/:id/status` | status: DEPARTED, COMPLETED hoặc CANCELLED |

400 dữ liệu sai; 401 chưa đăng nhập; 403 thiếu quyền hoặc bảo vệ request; 404 không tìm thấy; 409 xung đột nghiệp vụ/dữ liệu đồng thời. Không có DELETE.

## Transaction và tích hợp

Thứ tự khóa: stations tăng dần, routes tăng dần, route_stops, vehicles tăng dần, schedule, bookings. Đọc lại dữ liệu sau khóa; parent thay đổi so với snapshot trả 409. Khóa xe trước kiểm tra khoảng giao nhau, transaction READ COMMITTED, mọi lỗi rollback. Duplicate/FK/deadlock/timeout được chuyển thành lỗi nghiệp vụ không lộ SQL.

Booking writer trong tương lai cần khóa schedule và kiểm tra trạng thái/giờ trước ghi trong cùng transaction. SQL trực tiếp bỏ qua quy ước khóa không được bảo đảm chống trùng. Ngừng tuyến không vé vẫn có thể hợp lệ sau khi lịch đã tạo; lịch được giữ nhưng không thể khởi hành khi tuyến inactive. Session hiện dùng bộ nhớ cho local, triển khai production cần kho session bền vững theo hướng dẫn xác thực hiện có.

## File chính và kiểm thử

Backend: `src/schedules/`; `app.module.ts` đăng ký module; `routes.module.ts` xuất RoutesService và `validateJourney` dùng chung. Frontend: `src/pages/SchedulesPage.jsx`, `src/components/schedules/`, `src/services/schedulesApi.js`, `src/utils/scheduleTime.js`. App/sidebar, styles và StationDialog tích hợp giao diện.

Chạy tại từng package:

```bash
npm run build
npm run lint
npm test
```

Tại backend chạy thêm `npm run test:e2e`. Cần MySQL local và `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD`, `TEST_USER_EMAIL`, `TEST_USER_PASSWORD` trong `.env` riêng tư. E2E lịch trình chạy API port 3103 với TZ America/Los_Angeles để kiểm chứng UTC; stations/routes dùng 3101/3102. Chạy tuần tự, không chạy hai bộ E2E hoặc chỉnh DB trong lúc checksum. Fixture có prefix ngẫu nhiên, dọn đúng dữ liệu sở hữu và kiểm tra SHA256 các hàng gốc. Không reset auto increment. Suite lịch trình có timeout 30 giây cho mỗi ca nhiều request tới MySQL thật.
