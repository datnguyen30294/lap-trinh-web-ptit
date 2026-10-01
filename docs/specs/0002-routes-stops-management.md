# Quản lý tuyến xe và điểm dừng

**Status**: Accepted
**Date**: 2026-09-29

## Summary
Triển khai tuyến một chiều, hành trình có thứ tự và đổi trạng thái trong kiến trúc quản trị hiện tại. Giữ dữ liệu thật, dùng session ADMIN, transaction và khóa phối hợp với module bến. Không xóa tuyến hay tự sửa lịch trình, hủy vé.

## Context
Đã đọc AGENTS ở root, backend, backend/src, frontend và database, module stations, schema SQL và migration 004. SHOW CREATE TABLE trên DB được .env chọn xác nhận routes có code VARCHAR(20), name VARCHAR(180), TIME, DECIMAL(8,2), status ACTIVE/INACTIVE. route_stops hiện có id, route_id, station_id, stop_order SMALLINT UNSIGNED, km_from_origin DECIMAL(8,2), thiếu minutes_from_origin. schedules dùng vehicle_id, bookings dùng passenger_name. Có vehicles, không có fares. Không chuyển DB sang schema tài liệu.

## Requirements
- AC-1: Danh sách phân trang, tìm mã/tên, lọc trạng thái; đủ mã, tên, đầu/cuối, giờ, km, số điểm, trạng thái, thao tác. Chi tiết có hành trình đúng thứ tự.
- AC-2: Tạo và sửa mã/tên được trim, giới hạn schema, mã duy nhất. Ít nhất hai bến khác nhau, không lặp, thứ tự liên tục từ 1, đầu/cuối khớp danh sách. Phút/km đầu bằng 0, sau tăng nghiêm ngặt; km cuối bằng tổng km dương. Giờ bắt đầu trước kết thúc trong ngày.
- AC-3: ACTIVE chỉ dùng bến hoạt động; tạo/sửa/kích hoạt khóa các bến cùng cơ chế stations. Tuyến và điểm dừng lưu nguyên tử, lỗi rollback.
- AC-4: Bất kỳ booking nào, kể cả CANCELLED, khóa mã/tên và toàn bộ cấu trúc, km, phút. Kiểm tra schedules trước đổi giờ hoặc thời lượng. Chặn ngừng khi có vé CONFIRMED trên chuyến chưa khởi hành, không tự hủy vé. Kiểm tra fares nếu bảng tồn tại trước thay hành trình.
- AC-5: Mọi API yêu cầu ADMIN tại backend; validate params/query/body, trả 400/401/403/404/409 phù hợp. Giữ cookie, CSRF và pagination của stations.
- AC-6: Giao diện theo Figma, form thêm/bỏ/di chuyển điểm và chọn dữ liệu bến thật, thông báo cụ thể, giữ dữ liệu lỗi, đủ loading/empty/error/success và responsive. Kiểm chứng browser và hồi quy stations.
- AC-7: Migration nhỏ, có backup riêng tư, chạy lại an toàn, không reset hoặc seed. Test dùng fixture riêng và checksum dữ liệu gốc.

## Decision
Dùng module NestJS Routes, TypeORM EntityManager trong transaction cho truy vấn quan hệ và khóa; không thêm thư viện. React dùng fetch helper, dialog/status/styles hiện có. Backend là nơi thực thi nghiệp vụ.
**Implementation skills**: figma-design-to-code, theo design.md và styles.css hiện có.

## Feature design
### Dữ liệu và nguồn giá trị
| Giá trị | Nguồn |
|---|---|
| id/code/name/status/hours/distance | routes; input form cho ghi |
| tên bến đầu/cuối | JOIN stations qua hai FK routes |
| stops và count | route_stops ORDER BY stop_order; COUNT theo route_id |
| phút mỗi điểm | minutes_from_origin, nhập bởi admin, không suy từ km |
| thời lượng | minutes_from_origin của điểm cuối |
| liên kết lịch sử | bookings JOIN schedules theo route_id, mọi trạng thái |
| giờ lịch trình | departure_at/arrival_at UTC đổi +07:00 để so với giờ tuyến |
| phân trang | page mặc định 1, limit 10, max 100; total/count, totalPages=ceil(total/limit) |
| bến lựa chọn | API stations phân trang, bao gồm bến ngừng để hiển thị dữ liệu cũ |

Migration 005 thêm minutes_from_origin SMALLINT UNSIGNED NULL nếu thiếu. Không backfill dữ liệu chưa biết, kể cả điểm đầu, để giữ nguyên dữ liệu cũ. Backup tất cả bảng dưới .local/backups (ignored, mode 600), checksum cột gốc trước/sau. Schema khởi tạo tiếp tục yêu cầu NOT NULL vì tuyến mới phải đủ phút. UI hiển thị “Chưa có dữ liệu” cho NULL. Sửa không thay hành trình được giữ NULL; tạo/thay hành trình/kích hoạt lại yêu cầu đủ phút hợp lệ. Tuyến cũ có booking không được tự điền phút mới vì sẽ thay lịch sử; cần quy trình hiệu chỉnh riêng ngoài phạm vi. Không tự ngừng các tuyến cũ ACTIVE.

### API
| Method | Path | Input/output |
|---|---|---|
| GET | /routes | page,limit,search,status; {items,total,page,limit,totalPages} |
| GET | /routes/:id | route + stops + has_bookings, schedule_count |
| POST | /routes | code,name,operating_start/end,distance_km,status,origin_station_id,destination_station_id,stops[]; detail |
| PATCH | /routes/:id | đầy đủ thông tin chỉnh sửa như POST nhưng không status; detail |
| PATCH | /routes/:id/status | {status: ACTIVE/INACTIVE}; detail |

ID là chuỗi số BIGINT unsigned chuẩn, không ép thành Number. stop_order/phút là số nguyên; km là JSON number tối đa 2 chữ số thập phân và 999999.99. Giờ nhận HH:mm hoặc HH:mm:ss, lưu HH:mm:ss. Backend kiểm tra độ dài, null, trường thừa và nested DTO với lỗi tiếng Việt.

### Transaction và liên kết
Đọc trước hành trình để tập hợp bến cũ/mới; khóa bến theo ID tăng dần, rồi khóa route và đọc lại hành trình. Nếu hành trình đổi sang bến ngoài tập khóa, trả 409 yêu cầu tải lại. Stations giữ khóa bến trước khi kiểm tra ACTIVE routes. Tiếp theo khóa schedules theo id và bookings liên quan bằng current read. Writers lịch trình/đặt vé tương lai phải khóa route/schedule theo cùng thứ tự. Deadlock/lock timeout trả 409, không lộ SQL.

Có booking: mọi thay code/name/endpoints/distance/station/order/km/minutes bị 409, kể cả vé hủy. Có fares: chặn mọi thay hành trình để không làm sai đoạn/giá, kể cả giá ngừng. Không đổi hành trình thì không xóa/tạo lại stops. Khi thay đổi được phép, kiểm tra FK tham chiếu route_stops và chặn liên kết khác trước thay thế; lỗi FK trả 409 và rollback.

Đổi giờ: tất cả schedules hiện hữu phải khởi hành/đến cùng ngày Việt Nam, nằm trọn trong giờ mới. Đổi thời lượng: tất cả schedules phải có arrival_at-departure_at đúng phút cuối mới. Không thay schedules. Ngừng tuyến: departure_at >= UTC_TIMESTAMP và booking CONFIRMED thì 409, kể cả lịch trình đã bị đánh dấu CANCELLED không nhất quán.

### Giao diện
Đã đọc design context và screenshot của 84:7 (list), 84:126 (thêm), 84:234 (sửa có lỗi), 84:346 (dialog bị chặn) trong file bPqt1G05XZ7b4cTDiAc0Uo. Metadata không có frame chi tiết tuyến riêng. Chi tiết bổ sung card thông tin và danh sách hành trình theo cùng phong cách.

Giữ shell header/sidebar 240px và Geist của module bến để quản trị thống nhất, thay vì sidebar 260px có footer user riêng của frame tuyến. Nội dung dùng breadcrumb, nút xanh, card trắng, form hai cột và khoảng cách 24/28/32px từ frame. Thay nhập bến phân cách dấu phẩy bằng danh sách bến thật với phút/km; thay tần suất (không có cột DB) bằng tổng khoảng cách. Thay xóa bằng ngừng/kích hoạt và bỏ lời hứa tự hủy lịch trình trong Figma theo nghiệp vụ người dùng. Bổ sung trạng thái, phân trang và chi tiết. Tái sử dụng icon từ Figma và thành phần stations khi phù hợp.

## Build plan
1. [x] Migration và API list/detail tích hợp DB thật, AC-1/5/7.
2. [x] Transaction create/update/status, validation và bảo vệ liên kết, AC-2/3/4/5.
3. [x] UI list/form/detail/dialog nối API thật, AC-1/2/6.
4. [x] Test MySQL, concurrency, rollback, quyền; build/lint/UI tests và browser; hướng dẫn bàn giao, AC-1 tới AC-7.

## Options considered
Giữ schema thiếu phút sẽ không đáp ứng quản lý thời lượng. Suy phút từ km hoặc lịch trình cho dữ liệu cũ tạo dữ liệu không có căn cứ. Thêm cột nullable giữ rõ phần chưa biết, đổi lại dữ liệu cũ cần admin bổ sung trước khi kích hoạt lại.

## Rationale
Kế thừa module bến giảm thay đổi xác thực và giao diện. Khóa bến trước route phối hợp với stations để tránh ACTIVE tham chiếu bến vừa ngừng. Kiểm tra lịch sử trước ghi và transaction bảo toàn dữ liệu.

## Consequences
Không có xóa vật lý. Không quản lý lịch trình hay giá. Dữ liệu cũ thiếu phút vẫn đọc được nhưng không mặc nhiên đạt validation mới. Session in memory giữ giới hạn triển khai hiện tại.

## Follow-up
Khi xây module schedules/bookings, áp dụng khóa route rồi schedules và kiểm tra trạng thái trong transaction; hiệu chỉnh phút lịch sử phải là quy trình được duyệt riêng.

## Verification
Đã triển khai và kiểm chứng với MySQL, Chrome desktop/mobile, build/lint và test. Bằng chứng và giới hạn: [routes-verification.md](../routes-verification.md). Hướng dẫn chạy: [routes-module.md](../routes-module.md).
