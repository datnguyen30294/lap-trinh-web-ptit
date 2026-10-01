# Quản lý lịch trình chạy xe

**Date**: 2026-09-30
**Status**: Implemented

## Summary
Quản trị lịch trình đơn lẻ với tuyến, xe và thời gian thật. Dùng chung session ADMIN, kiểm tra hành trình và khóa dữ liệu để tránh trùng xe, sai lịch sử hoặc hủy chuyến còn vé. Không tạo lịch lặp, xóa vật lý hay thay đổi booking.

## Context
Đã đọc AGENTS, modules stations/routes, spec 0002, tài liệu chạy, schema và migration. SHOW CREATE TABLE xác nhận schedules có BIGINT id/route_id/vehicle_id, DATETIME(3) departure_at/arrival_at, enum SCHEDULED/DEPARTED/COMPLETED/CANCELLED, unique(vehicle_id,departure_at), index(vehicle_id,departure_at,arrival_at). Vehicles có id, vehicle_code VARCHAR(30), capacity SMALLINT UNSIGNED, không có trạng thái. Bookings dùng passenger_name; không có fares. Route stops có minutes_from_origin nullable. Không cần migration. Baseline riêng tư lưu trong .local/backups/schedules-baseline.json để đối chiếu toàn bộ hàng gốc.

## Requirements
- AC-1: List phân trang, tìm mã/tên tuyến hoặc mã xe, lọc tuyến, ngày Việt Nam và trạng thái; detail có endpoints, xe, sức chứa, số vé CONFIRMED, hành trình và giờ tại từng điểm.
- AC-2: Tạo/sửa phải có tuyến ACTIVE, mọi bến hoạt động, hành trình hợp lệ và đủ phút, xe tồn tại. Giờ mới trong tương lai, cùng ngày Việt Nam, nằm trong giờ tuyến và đúng thời lượng. Không suy phút từ km.
- AC-3: Không giao nhau trên cùng xe với lịch không CANCELLED, dùng khoảng [departure,arrival). Khóa xe và kiểm tra current read trong transaction. Hai chuyến tiếp giáp được phép.
- AC-4: Chỉ sửa SCHEDULED chưa khởi hành và chưa có bất kỳ booking nào. CONFIRMED/CANCELLED đều khóa thông tin lịch sử. Hủy chỉ khi không còn vé CONFIRMED. State machine kiểm tra hiện trạng và giờ backend, không tự sửa booking.
- AC-5: API ADMIN, validate params/query/body và trường thừa; BIGINT dạng chuỗi; 400/401/403/404/409 cụ thể; transaction rollback, deadlock/timeout trả 409. Phối hợp với tuyến/bến.
- AC-6: Figma list/form/error, mọi thao tác dùng API thật, giữ input khi lỗi, đầy đủ loading/empty/error/retry/success, accessible dialog và mobile.
- AC-7: Build/lint/test hai package, MySQL concurrency/rollback/quyền/timezone, browser desktop/mobile và hồi quy stations/routes; checksum hàng gốc không đổi, fixture được dọn chính xác.

## Decision
NestJS SchedulesModule với TypeORM parameterized SQL theo routes; React JavaScript với fetch helper và dialog hiện có. Không thêm thư viện, secret hoặc schema. Implementation skills: architect, develop, figma-design-to-code, test, sync.

## Options considered
Chỉ dùng unique(vehicle,departure) đơn giản nhưng bỏ lọt chuyến giao nhau. Khóa hàng vehicle rồi kiểm tra giao nhau trong transaction dùng được index sẵn có, cần các writer tuân thủ cùng thứ tự khóa. Thêm bảng khóa hoặc dịch vụ phân lịch riêng làm tăng schema/phụ thuộc không cần thiết.

## Rationale
Dùng hàng xe làm điểm khóa ngăn hai tuyến khác nhau cấp cùng xe. Dùng UTC rõ ràng cho API và múi giờ Việt Nam tại UI tránh phụ thuộc cấu hình máy. Giữ schema thật giúp bảo toàn dữ liệu đang có.

## Feature design
### Nguồn dữ liệu
| Giá trị | Nguồn |
|---|---|
| ID/trạng thái/tuyến/xe/giờ | schedules |
| mã/tên/endpoints/giờ tuyến | routes JOIN stations |
| mã xe/sức chứa | vehicles, chỉ đọc, không sửa capacity từ lịch trình |
| tổng vé xác nhận | COUNT bookings WHERE status=CONFIRMED, không gọi là số ghế đang chiếm |
| đã có lịch sử | EXISTS bookings, mọi trạng thái |
| giờ điểm dừng | departure_at + minutes_from_origin; NULL hiển thị chưa có dữ liệu |
| thời lượng | phút cuối hành trình, UI tính arrival nhưng backend kiểm tra lại |
| đồng hồ/điều kiện sửa | UTC_TIMESTAMP(3) backend, status và bookings |

### API
Tất cả endpoint yêu cầu AdminGuard. Mutation dùng CSRF/header/session có sẵn.
| Method | Path | Input và output |
|---|---|---|
| GET | /schedules | page,limit,search,route_id,date_from,date_to,status; {items,total,page,limit,totalPages} |
| GET | /schedules/vehicles | page,limit,search; danh sách xe có phân trang |
| GET | /schedules/:id | detail + stops + has_bookings + can_edit/edit_block_reason |
| POST | /schedules | route_id,vehicle_id,departure_at,arrival_at; tạo SCHEDULED |
| PATCH | /schedules/:id | đầy đủ 4 trường như POST, không nhận status/capacity |
| PATCH | /schedules/:id/status | status trong DEPARTED/COMPLETED/CANCELLED |

ID unsigned BIGINT chuẩn dạng chuỗi. Page 1..1000000, limit 1..100, search tối đa 255. Ngày query YYYY-MM-DD hợp lệ, date_from<=date_to. Hai đầu ngày người dùng bao gồm; SQL đổi thành đầu ngày từ và đầu ngày sau date_to tại UTC. Datetime API chỉ nhận ISO UTC với Z, chính xác tới millisecond; từ năm 1000 tới 9998. UI dùng datetime-local theo Việt Nam và chuyển bằng offset +07:00 rõ ràng, không dùng timezone mặc định. Trả ISO UTC từ SQL DATE_FORMAT để không phụ thuộc driver/local timezone.

### State machine
- POST luôn SCHEDULED.
- SCHEDULED -> DEPARTED khi departure<=UTC now<arrival; kiểm tra lại route ACTIVE, bến, hành trình, giờ và trùng xe. Không cần chuyến chưa có vé.
- DEPARTED -> COMPLETED khi now>=arrival; giữ nguyên thông tin lịch sử, không yêu cầu tuyến còn ACTIVE.
- SCHEDULED -> CANCELLED khi không có vé CONFIRMED, kể cả chuyến cũ chưa được xử lý. Không tự hủy booking.
- CANCELLED và COMPLETED là trạng thái cuối. Không khôi phục. Chuyển lặp, nhảy bước, khởi hành/hoàn thành sớm trả 409.
- PATCH chỉ SCHEDULED với departure hiện tại và mới trong tương lai, không có booking nào. Gửi không đổi thông tin trên lịch bị khóa vẫn trả 409 rõ lý do.

### Khóa và nguyên tử
Snapshot IDs trước transaction. Thứ tự: tất cả stations theo ID, routes theo ID, route_stops theo route/order, vehicles theo ID, schedule mục tiêu, bookings. Chụp cả tuyến/xe cũ và mới khi sửa. Sau khóa đọc lại schedule, nếu route/vehicle đã đổi ngoài snapshot trả 409 tải lại. Route locks ngăn thay giờ/hành trình/ngừng tuyến trong validation. Stations theo cùng thứ tự với routes/stations.

Mutation schedules dùng READ COMMITTED và locking reads. Khóa xe trước query giao nhau; query chỉ schedules, không join ngược để khóa route khác. Một route writer chỉ đi từ route đến schedules/bookings, không khóa vehicle, nên không có chiều ngược vehicle->route. Writer vehicle tương lai chỉ khóa xe và không đi ngược về route. Booking writer phải khóa schedule rồi kiểm tra state/time trước ghi.

Ngừng tuyến hiện cho phép khi không có vé tương lai: tạo lịch trước rồi ngừng tuyến là thứ tự hợp lệ; lịch giữ nguyên, sẽ không được khởi hành trên tuyến inactive. Không thêm quy tắc chặn ngừng tuyến chỉ vì có lịch không vé. Unique(vehicle,departure) vẫn áp dụng cả chuyến CANCELLED, nên không tái sử dụng chính xác cặp này, trả 409 giải thích; không xóa hàng để né constraint. Các khoảng khác của lịch CANCELLED không chiếm xe.

### UI và Figma
Đã đọc context và screenshot 89:2 list, 89:209 tạo/sửa, 89:436 lỗi, file bPqt1G05XZ7b4cTDiAc0Uo. Không có frame detail/hủy riêng. Giữ shell 240px và Geist của stations/routes. List card trắng bo 12px, padding24, filter16/gap16, CTA xanh; panel phải rộng480, padding24, bo16, backdrop nhạt, cuộn nội dung. Dùng StationDialog với class tùy chọn để cung cấp native modal/focus/Escape và vị trí panel. Mobile panel toàn chiều rộng, table thành card.

Thay mã chuyến mẫu bằng #id. Thêm xe thật; capacity chỉ đọc. Bỏ thanh tỷ lệ occupancy vì tổng vé của nhiều chặng không phải số ghế bị chiếm; hiển thị hai giá trị riêng cùng giải thích. Bỏ thông báo cấp phép/tài xế không có dữ liệu; chỉ hiển thị dữ liệu kiểm tra được. Ngày giờ dùng Việt Nam, arrival read only tính từ phút cuối. Form có trạng thái lỗi và giữ dữ liệu. Chặn sửa history thể hiện trước khi gửi. Thay xóa bằng hủy có xác nhận và kiểm tra vé. Detail dùng card thông tin/timeline của routes.

## Build plan
1. [x] API list/detail/vehicles và datetime/query validation (AC-1/5).
2. [x] Transaction create/update/status, khóa xe/tuyến/bến và guards lịch sử (AC-2/3/4/5).
3. [x] List, panel form, detail, status dialog, sidebar, timezone UI (AC-1/6).
4. [x] Test, browser, checksum, regression và hướng dẫn bàn giao (AC-1 tới AC-7).

## Consequences
Dữ liệu cũ thiếu phút vẫn đọc được nhưng không thể tạo/khởi hành chuyến trên hành trình đó tới khi được hiệu chỉnh theo quy trình tuyến. Không tự điền dữ liệu. DB có vehicles là schema được hỗ trợ; không tự chuyển sang schema ERD khác. Không quản lý xe/tài xế, vé hay giá, không sửa capacity và không khôi phục lịch hủy. Không có cơ chế chống lịch trùng đối với SQL trực tiếp bỏ qua khóa.

## Verification record

Implementation and automated validation completed 2026-09-30. Browser desktop/mobile, create/edit/detail, overlap/history/cancel guards, search/status/pagination and stations/routes regression exercised. The report [schedules-verification.md](../schedules-verification.md) records command counts, screenshots, original data checksums and the UI paths covered only by automated tests. No scope file exists for this feature; no independent review or user acceptance is implied by this status.
