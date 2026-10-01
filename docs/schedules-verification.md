# Kiểm chứng quản lý lịch trình

Ngày 30/09/2026, local MySQL thật theo `.env`, Chrome tại `http://localhost:5173/schedules`. Đặc tả [0003](specs/0003-schedules-management.md).

## Kết quả tự động

| Lệnh | Kết quả |
|---|---|
| backend `npm run build` | Đạt |
| backend `npm run lint` | Đạt |
| backend `npm test` | 1/1 đạt |
| backend `npm run test:e2e` | 103/103 đạt, 4 suite, 64.46 giây |
| frontend `npm run build` | Đạt |
| frontend `npm run lint` | Đạt |
| frontend `npm test` | 25/25 đạt, 4 file |

31 ca lịch trình trong `backend/test/schedules.e2e-spec.ts` kiểm tra AC-1 tới AC-5/7: list/search/pagination/vehicles/detail, biên ngày Việt Nam, UTC khi server chạy TZ America/Los_Angeles, ID/DTO/query sai, tuyến/xe không tồn tại, giờ quá khứ/qua đêm/sai thời lượng/ngoài giờ, thiếu phút, tuyến/bến inactive, 4 dạng giao nhau, tiếp giáp, đổi xe/tuyến, unique của chuyến hủy, lịch sử CONFIRMED/CANCELLED, state machine cả khởi hành và hoàn thành hợp lệ, đồng thời tạo/sửa/đổi trạng thái, tranh chấp với giờ/trạng thái tuyến/bến, rollback và 401/403/400/404/409. 72 ca app/routes/stations hồi quy cũng đạt.

10 ca frontend mới gồm 8 ca page và 2 ca thời gian; 15 ca stations/routes cũ tiếp tục đạt. Kiểm tra tải/lỗi/retry/rỗng/thành công, form giữ input, phút NULL, khóa history, dialog lỗi, detail, chọn tuyến/xe và chuyển UTC.

Lần chạy đầu có 3 ca nhiều request vượt timeout mặc định 5 giây sau Docker khởi động. Chạy riêng state machine với giới hạn 20 giây đạt trong 13.53 giây; không có query chờ khóa trong PROCESSLIST lúc khảo sát. Suite lịch trình dùng timeout 30 giây; chạy toàn bộ sau đó đạt. Không bỏ ca hoặc vô hiệu hóa assertion.

## Bằng chứng trình duyệt và Figma

Đã đọc context và ảnh Figma file `bPqt1G05XZ7b4cTDiAc0Uo`: [list 89:2](https://www.figma.com/design/bPqt1G05XZ7b4cTDiAc0Uo?node-id=89-2), [form 89:209](https://www.figma.com/design/bPqt1G05XZ7b4cTDiAc0Uo?node-id=89-209), [error 89:436](https://www.figma.com/design/bPqt1G05XZ7b4cTDiAc0Uo?node-id=89-436). Không có frame detail/hủy riêng trong nhóm thiết kế.

Giữ shell 240px, card trắng bo12, khoảng cách24/16, panel phải480 bo16, màu xanh và icon Figma. Tái sử dụng Geist/shell stations. Thêm chọn xe thật; capacity chỉ đọc; dùng #ID; bỏ tỷ lệ ghế không đúng theo chặng và thông báo tài xế/cấp phép không có dữ liệu. Thay xóa bằng hủy có xác nhận. Detail theo card/timeline chung. Mobile chuyển bảng thành thẻ và panel vừa màn hình.

| Luồng đã quan sát | Bằng chứng |
|---|---|
| Tạo lịch với tuyến 3 điểm, phút 0/10/20, xe 30 chỗ, giờ đến tự tính | [Panel tạo](reviews/schedules/create-panel.png); thông báo tạo thành công, ID thử 138 |
| Chi tiết giờ 09:00, 09:10, 09:20 đúng thứ tự | [Chi tiết](reviews/schedules/detail.png) |
| Sửa giờ 09:00 thành 10:00, đến 10:20 | UI thông báo cập nhật; SQL fixture đọc `03:00:00.000` và `03:20:00.000` UTC |
| Tạo giao nhau 10:10–10:30 bị chặn và giữ input | [Lỗi trùng xe](reviews/schedules/overlap-error.png), thông báo lịch #138 |
| Tuyến gốc thiếu phút được giải thích, không lưu | [Thiếu thời lượng](reviews/schedules/legacy-minutes.png) |
| Chèn booking CONFIRMED riêng sau khi mở dialog, hủy bị chặn bởi dữ liệu mới nhất | [Chặn hủy](reviews/schedules/cancel-blocked.png) |
| Mở sửa sau có booking, trường và nút lưu disabled | [Khóa lịch sử](reviews/schedules/history-locked.png) |
| Chuyển riêng booking thử sang CANCELLED, UI hủy thành công; lọc search + trạng thái còn 1 hàng | [Kết quả hủy](reviews/schedules/desktop-list.png); SQL xác nhận schedule/booking đều CANCELLED |
| Phân trang sang 2/7; tìm chuỗi không tồn tại về 0 kết quả | [Rỗng](reviews/schedules/empty.png) |
| Mobile 390×844, không tràn ngang (scrollWidth=innerWidth=390), form đủ nút | [Panel mobile](reviews/schedules/mobile-panel.png), [Danh sách cuối](reviews/schedules/mobile-list-final.png) |
| Bến: list thật và dialog thêm mở đúng; tuyến: list thật | [Bến](reviews/schedules/stations-regression.png), [Tuyến](reviews/schedules/routes-regression.png) |
| Sau dọn fixture, danh sách về 60 lịch gốc, không có console error/warn | [Giao diện bàn giao](reviews/schedules/desktop-final.png) |

Ô ngày native của công cụ Chrome đôi lúc không phát sự kiện nhập như người dùng; luồng datetime đã xác nhận bằng bàn phím ArrowUp/Tab và lưu thật. Bộ lọc ngày được kiểm chứng tự động bằng API MySQL tại biên ngày; chưa xác nhận trọn luồng nhập bộ lọc ngày bằng công cụ trình duyệt. Loading/retry/lỗi mạng được kiểm tra ở component test; không giả lập mất mạng trên trình duyệt. Khởi hành/hoàn thành được kiểm chứng bằng API với fixture riêng và đồng hồ thật, chưa thao tác hai trạng thái này qua UI. Không tuyên bố các phần này đã được thử thủ công.

## Bảo toàn dữ liệu

Không migration mới, seed, reset DB/volume, đổi DB_NAME hoặc reset bộ đếm. Snapshot riêng tư `.local/backups/schedules-baseline.json` lấy trước thay đổi, không đưa vào Git. E2E và UI dùng fixture riêng; fixture UI gồm một tuyến, ba bến, một xe, lịch #138 và booking riêng, đã dọn theo ID/prefix chính xác trong transaction.

SHA256 toàn bộ hàng sau dọn khớp baseline ở cả 7 bảng:

| Bảng | Số hàng | Checksum |
|---|---:|---|
| bookings | 5 | Khớp |
| route_stops | 43 | Khớp |
| routes | 10 | Khớp |
| schedules | 60 | Khớp |
| stations | 33 | Khớp |
| users | 3 | Khớp |
| vehicles | 10 | Khớp |

Giới hạn: dữ liệu phút NULL giữ nguyên; không có UI quản lý xe/tài xế, giá vé, đặt vé, lịch lặp hay khôi phục chuyến hủy. Unique xe/giờ vẫn giữ lịch hủy. DB khác schema vehicles đã khảo sát cần đánh giá riêng. Chưa có review độc lập bởi người/model khác.
