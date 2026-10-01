# Quản lý tuyến xe và điểm dừng

Module có tại `http://localhost:5173/routes`, dùng cùng đăng nhập ADMIN với `/stations`. Danh sách hỗ trợ phân trang, tìm mã/tên, lọc trạng thái; có chi tiết, thêm, sửa, sắp xếp hành trình và xác nhận ngừng/kích hoạt lại. Không có xóa vật lý.

## Chạy ứng dụng

Từ thư mục gốc, dùng cấu hình root `.env` hiện có và giữ nguyên Docker volume:

```bash
docker compose up -d
node database/migrations/005-routes-module.mjs
```

Máy mới chưa có các cột trạng thái cần chạy migration `004-stations-module.mjs` trước. Không chạy lại seed trên DB đang có dữ liệu. Cài dependency bằng `npm install` trong từng package nếu chưa cài, rồi mở hai terminal:

```bash
cd backend
npm run start:dev
```

```bash
cd frontend
npm run dev
```

Backend local dùng cổng 3001, Vite 5173. Cấu hình DB, `SESSION_SECRET`, `WEB_ORIGIN` và tài khoản kiểm thử chỉ nằm trong `.env` được gitignore. Giữ `synchronize: false`. Sau thay đổi backend production, build và khởi động lại tiến trình. Session hiện lưu trong bộ nhớ nên cần đăng nhập lại sau restart.

## Schema đã xác minh

DB ứng dụng có `vehicles`, không có `fares`; `schedules` có `vehicle_id`, `bookings` dùng `passenger_name`. Từ 01/10/2026, bộ `database/01-schema.sql` đã đồng bộ cấu trúc này. Máy mới dùng `node database/scripts/setup-local.mjs`; máy đang có dữ liệu giữ nguyên database. Xem `database/README.md` nếu đã import bản ERD cũ.

`routes` dùng mã tối đa 20 ký tự, tên 180, giờ MySQL TIME, khoảng cách DECIMAL(8,2), trạng thái ACTIVE/INACTIVE. `route_stops` dùng thứ tự SMALLINT UNSIGNED, km DECIMAL(8,2). Migration 005 chỉ thêm `minutes_from_origin SMALLINT UNSIGNED NULL` nếu thiếu. Script sao lưu schema và dữ liệu vào `.local/backups/` với quyền file 0600, rồi so SHA256 các cột gốc. Có thể chạy lại an toàn. Thực hiện migration khi không có thao tác ghi đồng thời để bản sao lưu và phép đối chiếu nhất quán.

Phút cũ chưa biết được giữ NULL và hiển thị rõ, không suy đoán từ km. Tạo/thay hành trình/kích hoạt lại yêu cầu đủ phút. Sửa thông tin không đổi hành trình vẫn giữ NULL. Với tuyến đã có vé, hiệu chỉnh phút lịch sử cần quy trình riêng ngoài module này. Schema khởi tạo cho DB mới vẫn dùng NOT NULL. Không thay dữ liệu tuyến ACTIVE cũ một cách tự động.

## API và quy tắc ghi

Frontend gọi qua tiền tố `/api`. Tất cả endpoint dưới đây yêu cầu ADMIN tại backend. Mutation dùng cookie phiên, JSON và `X-GoBus-Request: 1`; Origin phải theo cấu hình hiện có.

| Method | Đường dẫn | Ý nghĩa |
|---|---|---|
| GET | `/routes?page=1&limit=10&search=02&status=ACTIVE` | `{items,total,page,limit,totalPages}`, limit tối đa 100 |
| GET | `/routes/:id` | Thông tin, stops theo thứ tự, `has_bookings`, `schedule_count` |
| POST | `/routes` | Tạo tuyến cùng điểm dừng |
| PATCH | `/routes/:id` | Gửi đầy đủ các trường chỉnh sửa, không nhận status |
| PATCH | `/routes/:id/status` | `{status:"ACTIVE"}` hoặc `{status:"INACTIVE"}` |

Payload tạo gồm `code`, `name`, `origin_station_id`, `destination_station_id`, `operating_start`, `operating_end`, `distance_km`, `status` và `stops`. Mỗi stop gồm `station_id`, `stop_order`, `minutes_from_origin`, `km_from_origin`. ID là chuỗi BIGINT, phút/thứ tự là số nguyên, km là number tối đa hai chữ số thập phân. Nhận giờ HH:mm hoặc HH:mm:ss.

- Mã/tên được trim và kiểm tra độ dài; mã duy nhất theo collation MySQL.
- Một tuyến biểu diễn một chiều, ít nhất hai bến khác nhau, không lặp; thứ tự liên tục từ 1. Hai đầu khớp endpoints. Phút/km đầu bằng 0, sau tăng nghiêm ngặt; km cuối bằng tổng km dương. Không hỗ trợ giờ qua đêm.
- Transaction khóa bến cũ/mới theo ID tăng dần trước route, đọc lại hành trình, rồi khóa schedules và bookings. Cơ chế này phối hợp với khóa của stations. Không giữ thêm connection cho một transaction lồng nhau.
- ACTIVE chỉ dùng bến đang hoạt động. Khi kích hoạt, kiểm tra lại toàn bộ hành trình và lịch trình.
- Có bất kỳ booking nào, kể cả CANCELLED: chặn sửa mã/tên/hành trình/khoảng cách/phút để bảo vệ lịch sử.
- Đổi giờ: tất cả lịch trình phải nằm trong khoảng giờ mới và cùng ngày Việt Nam (UTC+7). Đổi thời lượng: giờ đến trừ giờ đi phải bằng phút cuối mới. Không sửa lịch trình tự động.
- Chặn ngừng nếu chuyến có giờ khởi hành tương lai còn booking CONFIRMED. Không tự hủy vé.
- Nếu DB có fares, chặn thay hành trình có giá liên kết; kiểm tra cả FK khác tham chiếu route_stops. Không thay hành trình thì giữ nguyên ID stops.
- Lỗi rollback toàn bộ. Trả 400 dữ liệu sai, 401 chưa đăng nhập, 403 thiếu quyền/request protection, 404 không tồn tại, 409 trùng mã/liên kết/lịch sử/xung đột khóa. Frontend giữ dữ liệu form và hiển thị thông báo backend.

Các module schedules/bookings được bổ sung sau phải tham gia cùng quy ước khóa route rồi schedule và kiểm tra lại trạng thái trong transaction. SQL trực tiếp không đi qua validation của API.

## Thiết kế và file chính

Đã đọc Figma file `bPqt1G05XZ7b4cTDiAc0Uo`, các frame 84:7, 84:126, 84:234, 84:346. Giữ shell và Geist của module bến, dùng card trắng, CTA xanh, form hai cột. Thay tần suất không có trong DB bằng khoảng cách; thay chuỗi bến bằng editor chọn bến thật; thay xóa bằng trạng thái. Figma chưa có chi tiết tuyến nên bổ sung theo phong cách hiện có. Chi tiết quyết định trong [đặc tả](specs/0002-routes-stops-management.md) và [design.md](../frontend/design.md).

| File | Trách nhiệm |
|---|---|
| `backend/src/routes/` | DTO, controller ADMIN và service transaction/khóa/liên kết |
| `backend/src/setup-app.ts` | Giữ cơ chế session/CSRF, bổ sung thu thập lỗi DTO lồng nhau |
| `frontend/src/pages/RoutesPage.jsx` | Danh sách, bộ lọc, phân trang, điều hướng các view |
| `frontend/src/components/routes/` | Form hành trình, chi tiết và dialog trạng thái |
| `frontend/src/services/routesApi.js` | Dùng lại fetch helper có session và xử lý lỗi |
| `frontend/src/App.jsx`, `styles.css` | Tích hợp sidebar và responsive |
| `database/migrations/005-routes-module.mjs` | Thêm phút, backup và checksum |
| `backend/test/routes.e2e-spec.ts` | Kiểm thử API/MySQL, concurrent writes và bảo toàn dữ liệu |
| `frontend/src/pages/RoutesPage.test.jsx` | Tương tác form, list, detail, dialog và trạng thái UI |

## Kiểm thử

Từ `backend/`:

```bash
npm run build
npm run lint
npm test
npm run test:e2e
```

Từ `frontend/`:

```bash
npm run build
npm run lint
npm test
```

E2E tự build; dùng MySQL local đã chọn trong `.env`, tài khoản `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD`, `TEST_USER_EMAIL`, `TEST_USER_PASSWORD` hiện có. API test stations dùng 3101, routes dùng 3102. Các suite chạy tuần tự vì cùng đối chiếu dữ liệu gốc. Fixture mã ngẫu nhiên được dọn riêng; auto increment có thể tăng, không reset lại bộ đếm. Suite routes hiện dùng schema local có vehicles, không dành cho production hoặc DB khác chưa đối chiếu.

Xem [báo cáo kiểm chứng và ảnh](routes-verification.md). Nhánh xử lý fares được triển khai nhưng DB local không có bảng này nên chưa có kiểm thử tích hợp với fares thật. Không bổ sung bảng chỉ để làm sai khác DB đang sử dụng.

Module lịch trình hiện dùng chung validation hành trình và thứ tự khóa này. Xem [quản lý lịch trình](schedules-module.md) cho bước khóa vehicle, kiểm tra giao nhau và quy ước booking writer.
