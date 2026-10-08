# Module Lộ trình: tìm điểm đến và gợi ý tuyến

Điểm đi hiện cho phép chọn trạm hoặc địa chỉ tự do tại Hà Nội. Xem [nhập điểm đi và geocoding](journey-origin.md) để biết cách dùng, API và giới hạn dịch vụ.

Tìm địa điểm trong database, dùng vị trí hiện tại làm điểm đi và gợi ý tuyến đi thẳng khi bấm Tìm lộ trình. Trong lúc chờ API, sidebar giữ điểm đi, điểm đến và hiện ba thẻ skeleton theo ảnh người dùng cung cấp. Khi có kết quả, hiện thời gian, tiền vé, thời gian chờ, khoảng cách và tên bến lên xe. Đã bổ sung bản đồ luôn hiển thị bằng Leaflet/OpenStreetMap và đường phố qua các bến bằng OSRM, xem [tài liệu bản đồ](journey-map.md).

## Phân chia code

| Đường dẫn | Trách nhiệm |
| --- | --- |
| `backend/src/journey-planner/journey-planner.module.ts` | Module riêng, đăng ký vào AppModule. |
| `backend/src/journey-planner/places.controller.ts` | API gợi ý địa điểm. |
| `backend/src/journey-planner/places.service.ts` | Đọc database, tìm và sắp xếp gợi ý. |
| `backend/src/journey-planner/dto/search-places.dto.ts` | Kiểm tra từ khóa, trang, số gợi ý. |
| `backend/src/journey-planner/journeys.controller.ts` | API tìm lộ trình, dùng PassengerGuard hiện có. |
| `backend/src/journey-planner/journeys.service.ts` | Đọc tuyến, thứ tự bến và lịch chuyến; chọn bến và tính giá vé. |
| `backend/src/journey-planner/journey-calculation.ts` | Khoảng cách Haversine, phút đi bộ, giờ đón và giới hạn ngày Việt Nam. |
| `backend/src/journey-planner/dto/search-journeys.dto.ts` | Kiểm tra tọa độ và ID điểm đến. |
| `frontend/src/pages/JourneyPlannerPage.jsx` | Trang `/user/journey-planner`, quản lý điểm đi và điểm đến. |
| `frontend/src/pages/journey-planner.css` | Style có tiền tố `jp-`, giới hạn trong giao diện module. |
| `frontend/src/components/journey-planner/PlaceAutocomplete.jsx` | Dropdown, debounce, chọn bằng chuột hoặc bàn phím, bỏ phản hồi cũ. |
| `frontend/src/components/journey-planner/useCurrentPosition.js` | Xin vị trí từ trình duyệt, timeout, lỗi quyền và thử lại. |
| `frontend/src/components/journey-planner/JourneySidebar.jsx` | Hai ô địa điểm, tiêu đề theo trạng thái và nút tìm/thử lại. |
| `frontend/src/components/journey-planner/JourneySearchSkeleton.jsx` | Ba thẻ chờ khi request đang chạy. |
| `frontend/src/components/journey-planner/JourneyResults.jsx` | Danh sách, trạng thái rỗng và chú thích ước tính. |
| `frontend/src/components/journey-planner/JourneyRouteCard.jsx` | Thẻ gọn theo ảnh, giá, thời gian, khoảng cách; chọn bằng chuột/bàn phím. |
| `frontend/src/components/journey-planner/JourneyDetailPanel.jsx` | Sidebar chi tiết, tổng thời gian, giá vé và các nút hành động. |
| `frontend/src/components/journey-planner/JourneyTimeline.jsx` | Bốn bước di chuyển, đánh dấu bước đang xem. |
| `frontend/src/components/journey-planner/useJourneyDetail.js` | Tải chi tiết mới mỗi lần chọn tuyến, thử lại và bỏ phản hồi cũ. |
| `frontend/src/components/journey-planner/journey-detail.css` | Style sidebar chi tiết và hover hai nút hành động. |
| `frontend/src/components/journey-planner/useJourneySearch.js` | Request tìm tuyến, hủy request và bỏ phản hồi cũ, chọn thẻ. |
| `frontend/src/services/journeyPlannerApi.js` | Gọi API riêng qua request helper dùng chung. |

Module đọc bảng `stations` đã có tọa độ. Không tạo bảng địa điểm trùng, không sao chép CRUD của `stations`, `routes`, `schedules` hay API `passenger`. Tái sử dụng `AuthModule`, `PassengerGuard`, kết nối TypeORM và request helper. Các điểm nối ngoài module chỉ là import trong AppModule, đăng ký trang trong App.jsx và liên kết Lộ trình & Bản đồ trên trang chủ. Những thay đổi tọa độ ở database và entity Station có từ công đoạn trước. API `passenger/stations` và `passenger/routes` giữ cấu trúc cũ; API `journey-planner/places` trả tọa độ cho module mới.

## API

`GET /journey-planner/places?search=trang%20thi&page=1&limit=8`

Qua Vite, frontend gọi `/api/journey-planner/places`. Backend trực tiếp không có tiền tố `/api`.

Yêu cầu phiên đăng nhập USER hoặc ADMIN như các API hành khách hiện tại. Mất phiên trả 401. Input sai trả 400 với thông báo theo ValidationPipe chung.

| Tham số | Quy tắc |
| --- | --- |
| `search` | Chuỗi tối đa 255 ký tự; trim và chuẩn hóa Unicode NFC. Bỏ trống trả danh sách rỗng. |
| `page` | Số nguyên 1 đến 1000000, mặc định 1. |
| `limit` | Số nguyên 1 đến 20, mặc định 8. |

Tìm chứa từ khóa trong `name`, `code`, `address`. Collation `utf8mb4_0900_ai_ci` không phân biệt chữ hoa/thường và dấu tiếng Việt. Ví dụ `TRÀNG THI`, `tràng thi`, `trang thi` đều tìm được Tràng Thi. `%`, `_`, `!` được escape để là ký tự thông thường. SQL dùng tham số, không ghép từ khóa vào câu lệnh.

Chỉ gợi ý bến đang hoạt động có đủ hai tọa độ. Có thể gợi ý bến chưa có tuyến; bước tìm tuyến sau sẽ xử lý trường hợp đó. Ưu tiên trùng mã/tên, rồi bắt đầu bằng từ khóa, rồi khớp một phần; tên và id làm thứ tự ổn định.

Response có cấu trúc:

```json
{
  "items": [
    {
      "id": "2",
      "code": "HN-TT",
      "name": "Tràng Thi",
      "address": "Phố Tràng Thi, Hà Nội",
      "latitude": 21.02655,
      "longitude": 105.84968
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 8,
  "totalPages": 1
}
```

ID trong ví dụ chỉ minh họa; id thật do database cấp và luôn là chuỗi BIGINT. Tọa độ ở API mới là JSON number, sẵn sàng đưa vào thư viện bản đồ. `total` là số địa điểm khớp, không phải số tuyến.

## Luồng giao diện

1. Đăng nhập rồi mở `/user/journey-planner`, hoặc chọn Lộ trình & Bản đồ ở header trang chủ.
2. Mặc định dùng tọa độ gần Ngã Tư Sở `21.004, 105.8195`, nhãn Vị trí của bạn. Chỉ xin quyền GPS khi bấm Dùng vị trí hiện tại. Lựa chọn định vị trong dropdown dùng Ngã Tư Sở nếu GPS lỗi. Chưa reverse geocode; tọa độ mặc định không phải kết quả định vị thực tế.
3. Gõ trực tiếp vào ô Điểm đến (B) trong Sidebar. Sau 250 ms ngừng gõ, gọi API và mở dropdown ngay dưới ô B. Gõ nhanh sẽ hủy request cũ; không hiển thị phản hồi trễ cho từ khóa trước. Bản đồ không còn thanh tìm kiếm nổi; cả hai ô A và B đều chỉnh sửa được.
4. Click gợi ý hoặc dùng phím lên/xuống và Enter. Lưu cả object địa điểm, điền tên vào ô Điểm đến và hiện địa chỉ, cập nhật marker B trên bản đồ. Gõ văn bản mà chưa chọn gợi ý chưa được tính là đã chọn điểm đến. Nút × xóa cả lựa chọn và marker B; tên đã chọn vẫn hiện khi quay từ chi tiết hoặc theo dõi về danh sách.
5. Chỉ khi có tọa độ hiện tại hợp lệ và địa điểm đã chọn thì nút Tìm lộ trình được bật, chuyển xanh. Sửa hoặc xóa từ khóa sẽ bỏ điểm đến đã chọn và vô hiệu hóa nút.
6. Nút định vị bên dưới giữ luồng GPS có lỗi và thử lại. Riêng lựa chọn Dùng vị trí hiện tại của tôi trong dropdown Điểm đi sẽ dùng vị trí mặc định khi GPS lỗi. Có thể chọn địa chỉ hoặc trạm làm A; sửa A bỏ kết quả tuyến cũ và yêu cầu chọn lại tọa độ. Không theo dõi GPS nền hay lưu vị trí vào database.
7. Bấm Tìm lộ trình để gửi tọa độ và ID điểm đến. Trong lúc chờ chỉ hiện hai ô địa điểm và skeleton; không thêm độ trễ giả. Request nhanh có thể khiến skeleton chỉ xuất hiện trong thời gian rất ngắn.
8. Kết quả sắp theo tổng thời gian tăng dần. Thẻ đầu có nhãn Nhanh nhất nhưng không tự chọn. Hover hoặc focus bàn phím có viền xanh. Click thẻ chuyển sidebar sang Chi tiết tuyến và tải lại dữ liệu chuyến còn đón được. Có skeleton trong lúc chờ, lỗi có nút thử lại. Chi tiết gồm tổng phút, giá vé, đi bộ tới bến, chờ xe, số điểm dừng, xuống xe và tới đích. Bấm Quay lại các tuyến giữ thẻ đã chọn với viền xanh và đường trên bản đồ. Chọn lại thẻ sẽ làm mới chi tiết; tìm lại sẽ bỏ lựa chọn cũ.
9. Lỗi request có thông báo và nút thử lại, khác với danh sách rỗng. Sửa/xóa/chọn lại điểm đến hoặc lấy lại vị trí sẽ bỏ kết quả cũ. Request cũ bị hủy; phản hồi đến muộn không ghi đè lựa chọn mới.

Trang sử dụng hình ảnh người dùng gửi cho phần header, sidebar và trạng thái nút. Figma MCP bị giới hạn lượt đọc trong lần triển khai này. Bản đồ thực dùng nền OpenStreetMap nên màu sắc và chi tiết đường phố khác bản minh họa Figma. Chọn thẻ tuyến sẽ vẽ chặng tương ứng và đưa toàn chặng vào khung nhìn.

## API tìm tuyến

```text
GET /journey-planner/journeys?latitude=21.02655&longitude=105.84968&destination_station_id=<ID từ API places>
```

Qua frontend dùng tiền tố `/api`. Giữ phiên USER/ADMIN hiện tại. Không thêm bảng, migration, thư viện hay biến môi trường cho chức năng này.

| Input | Quy tắc |
| --- | --- |
| `latitude` | Bắt buộc, số hữu hạn từ -90 đến 90. |
| `longitude` | Bắt buộc, số hữu hạn từ -180 đến 180. |
| `destination_station_id` | Bắt buộc, chuỗi BIGINT dương trong giới hạn MySQL. |

Thiếu/sai input, mảng hay tham số thừa trả 400. Điểm đến không tồn tại, đã ngừng hoạt động hoặc thiếu tọa độ trả 404. Chưa đăng nhập trả 401. Không có tuyến/chuyến phù hợp trả 200 với `items: []`; lỗi database đi qua cơ chế 500 của ứng dụng.

Response gồm `items`, `searched_at` (UTC) và `max_walking_distance_m`. Mỗi item có:

- `route_id`, `route_code`, `route_name`, `schedule_id`.
- `boarding_station`: ID, tên, địa chỉ và tọa độ bến lên xe.
- `walking_distance_m`, `walking_minutes`, `wait_minutes`, `ride_minutes`, `total_minutes`.
- `distance_km`: số km ngồi xe của chặng, `fare_vnd`: giá demo một vé.
- `pickup_at`, `dropoff_at`: thời điểm dự kiến theo lịch, UTC ISO. Frontend hiển thị giờ Việt Nam.

## API chi tiết tuyến

```text
GET /journey-planner/journeys/detail?latitude=21.004&longitude=105.8195&destination_station_id=...&route_id=...
```

Thêm `route_id` là chuỗi BIGINT dương; các tham số vị trí, điểm đến và quyền truy cập giống API tìm tuyến. DTO nằm tại `backend/src/journey-planner/dto/journey-detail.dto.ts`. Không cần đổi schema hoặc thêm migration.

Backend dùng lại phép tính tìm tuyến trong cùng transaction, lấy chuyến còn đón được tại thời điểm mở chi tiết. Không nhận giá vé, phút chờ hoặc bến lên tùy ý từ frontend. Nếu tuyến không còn phù hợp, trả 404 để người dùng tìm lại. Input sai trả 400, mất phiên trả 401.

Response có các trường của một gợi ý tuyến, thêm:

- `alighting_station`: ID, tên, địa chỉ, thứ tự bến xuống.
- `stops`: các bến từ bến lên đến bến xuống theo thứ tự database.
- `stop_count`: số điểm dừng sau bến lên, bao gồm bến xuống, bằng số bến trong chặng trừ một. Đây là số bến có trong dữ liệu dự án.
- `walking_after_m`, `walking_after_minutes`: hiện bằng 0 vì điểm đến được chọn chính là bến. Không tạo thêm 50 m như ảnh mẫu.
- `updated_at`: thời điểm tính lại, UTC ISO.

Bản đồ tải trước geometry của các phương án và vẽ ngay chặng đã cache khi chọn thẻ, trong khi chi tiết cập nhật lịch đón. Nếu bến lên thay đổi, bản đồ lấy chặng mới. API `route-map` ưu tiên geometry trong database, thiếu mới gọi OSRM và lưu lại; OSRM lỗi trả đường nối bến có chú thích tạm thời. Xem [tối ưu bản đồ](journey-map.md). Các nút Bắt đầu hành trình và Mua vé có hover và focus bàn phím.

**Bắt đầu hành trình** gọi API tạo theo dõi, rồi chuyển sidebar sang màn hình Đang theo dõi hành trình. **Xem chi tiết hành trình** mở lại sidebar chi tiết; nút Tiếp tục hành trình trở lại màn hình theo dõi. **Mua vé** chỉ hiển thị, có hover nhưng chưa xử lý click theo yêu cầu mới. Không tạo vé hoặc thanh toán. Xem [theo dõi hành trình](journey-tracking.md).

## Quy tắc tính toán và nguồn dữ liệu

Các giá trị mặc định mới của bản demo là **đi bộ 5 km/h, bán kính tìm bến 2 km và khởi hành ngay trong ngày Việt Nam hiện tại**. Hai giá trị 5 km/h và 2 km là đề xuất triển khai, không phải quy định được trích từ tài liệu nghiệp vụ. Có thể điều chỉnh tại `journey-calculation.ts`.

1. Điểm đến chính là một bến đã chọn từ database. Chỉ tìm tuyến đi thẳng, bến lên phải đứng trước điểm đến theo `stop_order`. Tuyến ACTIVE, các bến thuộc tuyến và hai bến đầu cuối đều phải đang hoạt động.
2. Tính Haversine từ tọa độ trình duyệt đến tọa độ từng bến lên hợp lệ, giữ bến trong 2.000 m. Đây là khoảng cách đường chim bay, chưa đo đường đi bộ thực. Phút đi bộ = làm tròn lên `mét / (5000 / 60)`.
3. Mỗi tuyến lấy bến gần nhất mà vẫn còn chuyến đón được. Nếu hòa khoảng cách thì lấy bến đứng trước. Đây là bến gần nhất **phù hợp để đi tới điểm đến**, không phải mọi bến gần vị trí người dùng đều đi được tới đó.
4. Giờ xe đến bến = `schedules.departure_at + boarding.minutes_from_origin`. Giờ người dùng tới bến = thời điểm tìm + phút đi bộ. Chọn chuyến sớm nhất có giờ đón lớn hơn hoặc bằng giờ người dùng tới bến, trước 00:00 ngày kế tiếp ở Việt Nam. Chỉ xét SCHEDULED/DEPARTED; xe đã xuất phát từ đầu tuyến vẫn có thể đón tại bến phía sau. Bỏ CANCELLED/COMPLETED và lịch có giờ tới đích vượt `arrival_at`.
5. Phút chờ = làm tròn lên `(giờ đón - giờ người dùng tới bến) / 60 giây`. Không tính chờ từ lúc bấm nút rồi cộng thêm đi bộ, vì như vậy sẽ bị tính hai lần.
6. Phút ngồi xe = `destination.minutes_from_origin - boarding.minutes_from_origin`. Đây là ước tính từ dữ liệu tuyến do Admin nhập theo `docs/specs/0002-routes-stops-management.md` và `0003-schedules-management.md`. Không tự suy ra vận tốc xe từ km, không sửa các mốc phút cũ. Thiếu mốc phút ở bến lên/đến thì không dùng chặng đó.
7. Km chặng = `destination.km_from_origin - boarding.km_from_origin`. Tiền vé = `ROUND(4000 + 500 × km_chặng, 0)` từ `database/README.md` và `04-example-queries.sql`. Đây là giá demo theo chặng, chưa có bảng quản lý giá vé riêng và không phải giá chính thức ngoài thực tế.
8. Tổng phút = phút đi bộ + phút chờ + phút ngồi xe. Trả một gợi ý mỗi tuyến, sắp theo tổng phút, rồi khoảng cách đi bộ, rồi mã tuyến. Nhãn Nhanh nhất chỉ so sánh các gợi ý trả về.

Ví dụ: đi bộ 200 m tương ứng 3 phút. Xe đến bến sau 6 phút tính từ lúc tìm, vậy chờ tại bến là 3 phút. Chặng xe 9 phút thì tổng là 15 phút. Nếu chặng dài 6 km, giá demo là 7.000đ. Ví dụ không được dùng làm dữ liệu mặc định trong ứng dụng.

Thời gian dựa trên lịch trong database, chưa có GPS xe hay dữ liệu tắc đường. Danh sách được tính tại `searched_at`, chi tiết được tính lại mỗi lần chọn thẻ tại `updated_at`. Chưa tính chuyển tuyến hay khả năng đặt chỗ. API không đảm bảo còn ghế, bước đặt vé sau phải kiểm tra sức chứa theo chặng.

## Chạy và kiểm tra

Database cần hai cột tọa độ từ công đoạn trước. Máy đã có database nhưng chưa nhận cột mới chạy từ root:

```bash
node database/migrations/006-station-coordinates.mjs
```

Chạy backend và frontend bằng các lệnh dev hiện có. Phần bản đồ bổ sung thư viện Leaflet ở frontend, cài bằng `npm install`. Không cần khóa API hoặc biến môi trường mới. Máy demo cần Internet để tải nền và đường đi.

Kiểm tra API với database thật từ `backend/`:

```bash
npm run test:e2e -- --run test/journey-planner.e2e-spec.ts
```

Bộ kiểm tra dùng port 3105, tạo fixture có mã riêng, xóa đúng fixture và đối chiếu checksum dữ liệu gốc của mọi bảng. Các bộ E2E dùng chung database cần chạy tuần tự.

Kiểm tra tương tác và điều hướng từ `frontend/`:

```bash
npm test -- src/pages/JourneyPlannerPage.test.jsx src/services/journeyPlannerApi.test.js src/App.test.jsx src/pages/UserHomePage.test.jsx
```

Kiểm tra công thức độc lập từ `backend/`:

```bash
npm test -- src/journey-planner/journey-calculation.spec.ts
```

### Test bằng trình duyệt

1. Mở `/user/journey-planner`, đăng nhập. Vị trí mặc định gần Ngã Tư Sở có nhãn Vị trí của bạn, không cần cho phép GPS.
2. Chọn Bến xe Yên Nghĩa từ gợi ý rồi bấm Tìm lộ trình. Khi còn lịch đón trong ngày, có thể nhận tuyến `02-DI` và `BRT01-DI`. Tổng phút và chờ phụ thuộc thời điểm test.
3. Click một thẻ: sidebar chuyển sang chi tiết, bản đồ vẽ đoạn từ bến lên tới bến xuống. Bấm Quay lại các tuyến rồi chọn tuyến khác. Để test GPS thật, bấm Dùng vị trí hiện tại; nếu ở xa các bến Hà Nội hơn 2 km thì có thể không có kết quả.
4. Để quan sát skeleton rõ hơn, bật giới hạn tốc độ mạng trong DevTools trước khi tìm. Rê chuột vào thẻ để thấy viền xanh, click thẻ để đổi lựa chọn.
5. Thử xóa điểm đến trong lúc tải: kết quả cũ phải biến mất. Thử ngắt mạng sau khi chọn điểm đến: lỗi có nút thử lại và không hiện như danh sách rỗng.

Database kiểm tra ngày 03/10/2026 có lịch đến 16/10/2026, chỉ sáu chuyến mỗi chiều mỗi ngày. Do đó có thể chờ hàng giờ; ứng dụng không tự tạo tần suất 3 đến 8 phút như ảnh thiết kế. Khi lịch hết hạn, Admin cần thêm chuyến tương lai bằng module Lịch trình. Không chạy lại seed lên database đang có dữ liệu để làm mới lịch.

## Kiểm tra phần chi tiết tuyến ngày 04/10/2026

- 17 kiểm tra API với MySQL thật đạt, gồm chi tiết chặng, giá và thời gian, xác thực, input sai và chuyến vừa bị hủy. Checksum dữ liệu gốc được giữ nguyên sau khi dọn fixture.
- 15 kiểm tra công thức và dịch vụ bản đồ đạt.
- 21 kiểm tra frontend đạt, gồm mở chi tiết, quay lại giữ lựa chọn, chọn lại để cập nhật lịch, bỏ phản hồi tuyến cũ, thử lại lỗi, hướng dẫn từng bước và thông báo mua vé.
- Build backend/frontend và lint frontend đạt.
- Chưa kiểm tra hình ảnh trực tiếp do công cụ không có phiên trình duyệt. Lần thử gọi qua Vite cuối cùng không kết nối được cổng 5173; API được xác minh qua server E2E riêng, không phải server dev đang chạy.

## Kết quả kiểm tra ngày 03/10/2026

- Backend: 11 kiểm tra API journey planner, 8 kiểm tra hồi quy passenger và 5 kiểm tra công thức đạt; checksum dữ liệu gốc được giữ nguyên. E2E cố định đồng hồ riêng của tiến trình test để không phụ thuộc giờ/ngày chạy máy.
- Frontend: 41 kiểm tra trong JourneyPlannerPage, journeyPlannerApi, App và UserHomePage đạt. Gồm skeleton, giá/thời gian, chọn thẻ, lỗi/rỗng/thử lại, hủy phản hồi cũ và hợp đồng tọa độ khi gọi API.
- Đã gọi API qua Vite với phiên USER thật: Tràng Thi đến Bến xe Yên Nghĩa trả 200, tuyến 02-DI, giá demo 13.000đ, ngồi xe 57 phút.
- Công cụ trình duyệt không có phiên khả dụng, nên chưa kiểm chứng hình thức trực tiếp trên trình duyệt. Các kiểm tra tương tác React dùng vị trí giả lập trong test; ứng dụng lấy vị trí thật qua trình duyệt khi chạy.
