# Điểm đi tự chọn tại Hà Nội

## Cách dùng

1. Mở `/user/journey-planner`. Điểm đi mặc định vẫn là Vị trí của bạn tại Ngã Tư Sở.
2. Nhập vào Điểm đi. Trạm trong database được gợi ý sau 400 ms ngừng gõ.
3. Với địa chỉ tự do, nhấn Enter hoặc Tìm địa chỉ tại Hà Nội. Chọn một kết quả để xác nhận tọa độ. Chỉ gõ chữ chưa được coi là đã chọn điểm đi.
4. Nhập trực tiếp vào ô Điểm đến (B) trên Sidebar. Chọn trạm trong dropdown bằng chuột hoặc phím mũi tên và Enter; nút × xóa điểm đến. Khi đã chọn cả A và B, bấm Tìm lộ trình, rồi chọn một tuyến. Bản đồ không còn thanh tìm kiếm nổi.
5. Dropdown điểm đi luôn có Dùng vị trí hiện tại của tôi ở đầu. Xin GPS; nếu lỗi hoặc không được cấp quyền thì dùng vị trí mặc định Ngã Tư Sở. Nút định vị bên dưới cho phép thử lại GPS. Không còn nút Dùng vị trí mặc định hoặc đoạn hướng dẫn dưới tìm địa chỉ; nguồn OpenStreetMap được hiển thị cùng attribution ở góc bản đồ.

Khi sửa A, kết quả tuyến và tọa độ A cũ bị bỏ ngay. B được giữ lại. Phản hồi tìm kiếm hoặc GPS đến muộn không ghi đè lựa chọn mới. Map đặt marker A theo tọa độ đã chọn, fitBounds cả A và B trước khi có tuyến, rồi bao cả đường xe khi chọn tuyến. Đường nối từ A tới bến vẫn là khoảng cách chim bay ước tính như module trước.

## Nominatim và giới hạn

[Chính sách Nominatim công cộng](https://operations.osmfoundation.org/policies/nominatim/) cấm autocomplete địa chỉ khi gõ, kể cả debounce. Vì vậy chỉ tìm địa chỉ khi người dùng bấm nút hoặc Enter. Debounce 400 ms áp dụng cho tìm trạm trong database.

Không cần API key, package mới hoặc migration. Backend mặc định gọi `https://nominatim.openstreetmap.org/search`, thêm Hà Nội, `countrycodes=vn`, `bounded=1`, `limit=5` và viewbox `105.65,21.15,105.95,20.90`. Đây là hình chữ nhật bao vùng nội đô theo yêu cầu, không phải toàn bộ địa giới hành chính Hà Nội. Số nhà hoặc tên địa danh chưa có trên OpenStreetMap có thể không tìm được.

Backend dùng User-Agent nhận diện GoBus, thực hiện tuần tự cách nhau ít nhất 1.1 giây, timeout 8 giây, gộp request trùng và cache tối đa 200 từ khóa trong 24 giờ. Cache ở bộ nhớ, không ghi địa chỉ vào database. Giới hạn này phù hợp chạy một backend cho demo; nhiều backend dùng chung dịch vụ công cộng cần bộ giới hạn và cache dùng chung. Không gửi dữ liệu bí mật vào tìm kiếm địa chỉ.

Có thể thay máy chủ tương thích bằng biến tùy chọn `NOMINATIM_SEARCH_URL` trong root `.env`, khởi động lại backend. Mặc định không cần cấu hình. Dịch vụ bên ngoài vẫn cần Internet; không cam kết truy cập được từ mọi nhà mạng.

## API và chia code

`GET /journey-planner/geocoding?search=...` yêu cầu phiên USER/ADMIN. Query là chuỗi sau trim dài 2 đến 255 ký tự. Trả `{ items: [{ name, latitude, longitude }] }`. Lọc bỏ tọa độ không hợp lệ hoặc ngoài viewbox. Lỗi query 400, quá tải 429, dịch vụ ngoài lỗi 503. Kết quả rỗng là 200 với items rỗng.

| File | Vai trò |
| --- | --- |
| `backend/src/journey-planner/geocoding.controller.ts` | Guard và validation query |
| `backend/src/journey-planner/geocoding.service.ts` | Gọi Nominatim, cache, giới hạn tần suất và chuẩn hóa kết quả |
| `frontend/src/services/geocodingService.js` | Gọi API qua request helper có phiên và AbortSignal |
| `frontend/src/components/journey-planner/OriginAutocomplete.jsx` | Gợi ý A, bàn phím, tìm địa chỉ chủ động và bỏ phản hồi cũ |
| `frontend/src/components/journey-planner/useCurrentPosition.js` | Trạng thái tọa độ chọn tay, GPS và mặc định |
| `frontend/src/pages/JourneyPlannerPage.jsx` | Đồng bộ A, B, tìm tuyến, chi tiết và theo dõi |

API journeys tiếp tục nhận latitude, longitude và destination_station_id như trước. API bắt đầu tracking nhận thêm `origin_label` tùy chọn, chuỗi tối đa 1000 ký tự, để giữ tên điểm đi trong phiên và sau khi kết thúc hành trình. Backend vẫn tự tính các thông tin chuyến từ tọa độ và database.

## Xác thực ngày 04/10/2026

Frontend: lint, build và toàn bộ 91 test đạt. Backend: build, lint và 32 unit test Journey Planner đạt. Test bao gồm debounce 400 ms, chọn trạm bằng bàn phím, địa chỉ tự do, bỏ kết quả cũ, GPS lỗi và đến muộn, cập nhật A/B trên map, giới hạn vùng và tần suất Nominatim.

23 test API Journey Planner với MySQL thật đạt, gồm validation geocoding, phiên đăng nhập, lỗi nhà cung cấp và giữ origin_label khi tải lại tracking. Dịch vụ Nominatim/OSRM được mô phỏng trong suite; checksum xác nhận dữ liệu có sẵn không đổi. Sau điều chỉnh tránh chọn nhầm bằng bàn phím khi danh sách vừa cập nhật, chạy lại 23 test frontend liên quan và lint cả hai package đều đạt.

Gọi API qua Vite với phiên thật: query không hợp lệ trả 400. Mạng của môi trường thực thi từ chối kết nối tới Nominatim (`ECONNREFUSED`), API trả 503 có xử lý. Chưa xác nhận được kết quả địa chỉ từ dịch vụ thật, chưa kiểm tra trực quan bằng trình duyệt. Các test geocoding dùng phản hồi mô phỏng, không gọi hàng loạt dịch vụ công cộng.
