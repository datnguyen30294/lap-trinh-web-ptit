# Theo dõi hành trình

## Luồng giao diện

1. Tìm lộ trình, chọn tuyến rồi bấm Bắt đầu hành trình. Nút có trạng thái đang gửi. Backend tính lại chuyến còn đón được bằng dữ liệu database trước khi bắt đầu.
2. Sidebar chuyển sang Đang theo dõi hành trình, gồm tên tuyến/đích, bước hiện tại, hướng dẫn, phút tới giờ đón và giờ tới nơi theo giờ Việt Nam. Nền bản đồ và đoạn đường vẫn được giữ.
3. Xem chi tiết hành trình trở về giao diện chi tiết của chính chuyến đang theo dõi. Tiếp tục hành trình hoặc Quay lại theo dõi mở lại sidebar theo dõi, không khởi tạo chuyến khác.
4. Mua vé vẫn có hình thức và hover, `aria-disabled`, không có xử lý click ở cả hai màn hình.
5. Kết thúc hành trình mở hộp thoại với tuyến, bến lên và đích. Tiếp tục hành trình, nút đóng hoặc Escape chỉ đóng hộp thoại. Hộp thoại tái sử dụng `StationDialog` hiện có để giữ focus và khóa tương tác nền.
6. Xác nhận Kết thúc gọi backend. Thành công mới rời màn hình theo dõi, giữ tọa độ gốc/đích và tìm lại các chuyến còn phù hợp lúc này. Tuyến trước đó còn trong kết quả thì giữ thẻ được chọn, sidebar vẫn ở danh sách. Nếu không còn chuyến thì hiện trạng thái rỗng. Lỗi kết thúc giữ hộp thoại và cho thử lại.

Trong lúc theo dõi, ô tìm kiếm được thay bằng tên đích đang theo dõi để tránh đổi điểm đến giữa chuyến. Có thể tải lại trang trong cùng phiên để khôi phục theo dõi.

## Backend và API

Không thêm bảng, migration, dependency hoặc biến môi trường. Tận dụng `express-session` và PassengerGuard của dự án. Mỗi phiên có tối đa một `activeJourney`. Các API chỉ đọc/ghi phiên hiện tại, không nhận user ID từ client.

| API | Input | Kết quả |
| --- | --- | --- |
| `POST /journey-planner/tracking` | `latitude`, `longitude`, `destination_station_id`, `route_id`, DTO như chi tiết tuyến | `{ active }`, HTTP 200 |
| `GET /journey-planner/tracking` | Cookie phiên | `{ active }` hoặc `{ active: null }` |
| `POST /journey-planner/tracking/:id/end` | UUID trả về khi bắt đầu | `{ ended: true }`, HTTP 200 |

Frontend gọi qua `/api`, giữ cookie. POST cần header `X-GoBus-Request: 1` như các API hiện có. Chưa đăng nhập 401, thiếu header 403, input sai 400, tuyến không còn đón được 404. Đang theo dõi hành trình khác hoặc kết thúc bằng ID không khớp trả 409. Gửi lại start cùng tuyến/đích/tọa độ trả hành trình hiện tại; end khi không còn hành trình vẫn thành công.

`active` gồm UUID `id`, `started_at`, `origin`, dữ liệu chi tiết `journey`, `step`, `simulated: true`, `server_time`, `pickup_in_seconds`, `arrival_in_seconds`, `arrival_at`. Giá, giờ đón và giờ xuống đều do backend tính, không nhận từ client. Chi tiết bến xuống bổ sung latitude/longitude để khôi phục bản đồ khi tải lại trang.

Trạng thái nằm trong session server hiện có. Reload trình duyệt giữ được khi phiên còn sống; logout, phiên hết hạn hoặc backend khởi động lại sẽ mất do dự án dùng session trong bộ nhớ. Chưa tạo lịch sử chuyến đi lâu dài.

## Quy tắc mô phỏng

Màn hình mẫu ghi thông tin đang mô phỏng. Triển khai tự chuyển bốn bước theo đồng hồ server, frontend hỏi lại sau mỗi 15 giây, không dùng GPS xe hoặc theo dõi di chuyển thật:

1. **Đi đến điểm dừng:** từ lúc bắt đầu đến `started_at + walking_minutes`.
2. **Chờ xe tại bến:** từ mốc đi bộ xong đến `pickup_at`.
3. **Di chuyển trên xe:** từ `pickup_at` đến `dropoff_at`.
4. **Đến điểm đến:** đã tới `dropoff_at`, giữ màn hình để người dùng chủ động kết thúc.

Số phút đợi xe trên màn hình theo dõi là làm tròn lên `(pickup_at - giờ server) / 60 giây`, bao gồm thời gian đi bộ còn lại. Nó khác số phút chờ tại bến trong màn hình chi tiết. Khi đang đi xe, thẻ đổi thành số phút dự kiến còn lại đến bến xuống. Không hiển thị số âm. Giờ tới đích là `dropoff_at`, hiển thị Asia/Ho_Chi_Minh.

Chuyến và lịch dự kiến được chụp lại khi bắt đầu. Polling cập nhật tiến trình theo snapshot này, không chuyển sang chuyến xe kế tiếp và không cập nhật hủy/đổi lịch từ Admin sau khi bắt đầu. Thông tin chỉ phục vụ mô phỏng, không có thông báo nền, GPS xe, hay thông báo hệ điều hành. Dữ liệu bản đồ không bị tải/vẽ lại vì polling; hook giữ các object tọa độ/chuyến ổn định.

## Phân chia code

| File | Trách nhiệm |
| --- | --- |
| `backend/src/journey-planner/tracking.controller.ts` | Start/current/end, lưu session, xác thực và kiểm tra hành trình đang hoạt động. |
| `backend/src/journey-planner/tracking-state.ts` | Kiểu dữ liệu và tính bước, thời gian còn lại. |
| `frontend/src/components/journey-planner/useJourneyTracking.js` | Khôi phục, polling, start/end, lỗi và hủy phản hồi cũ. |
| `frontend/src/components/journey-planner/JourneyTrackingPanel.jsx` | Sidebar theo dõi. |
| `frontend/src/components/journey-planner/EndJourneyDialog.jsx` | Nội dung hộp thoại kết thúc, dùng lại dialog hiện có. |
| `frontend/src/components/journey-planner/journey-tracking.css` | Style sidebar và hộp thoại có tiền tố jp. |

## Xác thực ngày 04/10/2026

- Backend: 29 unit và 21 kiểm tra API với MySQL đạt. Gồm ranh giới bốn bước, không đếm âm, start từ dữ liệu DB, quyền truy cập, CSRF, khôi phục phiên, không đọc/kết thúc được hành trình phiên khác, start/end lặp. Dữ liệu nghiệp vụ gốc được đối chiếu checksum.
- Frontend: 28 kiểm tra liên quan đạt. Gồm toàn bộ luồng start, chi tiết, tiếp tục, mở/đóng/xác nhận kết thúc, quay lại kết quả, lỗi start/end, reload, polling và bỏ phản hồi đến muộn. Mua vé không mở hộp thoại hoặc gọi API.
- Build backend/frontend và lint đạt. Đã gọi API qua Vite với phiên USER riêng, chọn BRT01 tới Yên Nghĩa, bắt đầu, đọc lại cùng ID và kết thúc thành công.
- Chưa kiểm chứng hình thức trực tiếp: công cụ không có phiên trình duyệt. Test UI dùng jsdom và mock Leaflet.

Test tay: tìm Yên Nghĩa từ Vị trí của bạn, chọn tuyến còn lịch, bấm Bắt đầu hành trình. Xem chi tiết rồi Tiếp tục. Mở Kết thúc, thử Tiếp tục và nút đóng, sau đó xác nhận Kết thúc. Sidebar phải về gợi ý mới, giữ điểm đi/đến. Thử reload khi đang theo dõi để kiểm tra khôi phục.
