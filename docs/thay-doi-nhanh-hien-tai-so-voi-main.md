# Các cập nhật hiện tại của GoBus so với main

Ngày đối chiếu: 07/10/2026. Tài liệu giải thích theo thứ tự chuẩn bị dữ liệu, mở trang, chọn địa điểm, tìm tuyến, xem bản đồ, theo dõi và kết thúc hành trình. Đây là thứ tự chạy chức năng, không phải thứ tự lịch sử commit.

## 1. Trạng thái Git và phạm vi so sánh

| Nội dung | Kết quả tại thời điểm kiểm tra |
| --- | --- |
| Nhánh đang đứng | `feature/routes-management` |
| Nhánh chính trên máy | `main` |
| Commit của cả hai nhánh | `73ed1c7`, Merge pull request #10 from datnguyen30294/module-của-NTD |
| Commit riêng so với main | 0 commit phía main, 0 commit phía HEAD |
| File đã được Git theo dõi và đang sửa | 14 |
| File mới chưa được Git theo dõi | 66 |
| Tổng file cập nhật trước khi viết báo cáo | 80 |

**Các cập nhật mới chưa nằm trong commit của nhánh.** `main` và `HEAD` trỏ đến cùng commit, nhưng thư mục làm việc có 80 file sửa hoặc thêm mới. Vì vậy chỉ chạy `git diff main...HEAD` sẽ không thấy phần công việc này. Báo cáo đối chiếu `main` với nội dung hiện có trên ổ đĩa, bao gồm file chưa được Git theo dõi.

`origin/main` đang lưu trên máy cũng trỏ đến `73ed1c7`. Phiên đọc này không fetch, nên kết quả không xác nhận GitHub có cập nhật mới hơn hay không. Không đưa nhánh `backup-route-map` vào phạm vi so sánh.

14 file đã theo dõi có tổng 98 dòng thêm và 26 dòng bỏ theo `git diff --stat main`. Số này **chưa tính 66 file mới**, và không phản ánh đầy đủ dung lượng dữ liệu geometry được viết trên các dòng JSON dài. Báo cáo này được thêm sau khi chốt số liệu, nên không nằm trong 80 file nói trên.

Bạn có thể đối chiếu lại bằng:

```powershell
git branch --show-current
git rev-list --left-right --count main...HEAD
git diff --stat main
git diff --name-status main
git ls-files --others --exclude-standard
```

## 2. Trước và sau, chức năng nào mới?

| Phần | Trong main tại commit đối chiếu | Trong thư mục làm việc hiện tại |
| --- | --- | --- |
| Điều hướng hành khách | Nút Lộ trình & Bản đồ gọi thao tác tìm tuyến ở trang chủ, ghi bản đồ sắp có | Liên kết mở trang riêng `/user/journey-planner` |
| Vị trí bến | Schema và entity Station chưa có tọa độ | Có latitude, longitude và quy tắc kiểm tra cặp tọa độ |
| Đường đi | Schema routes chưa có geometry | Có geometry JSON, dữ liệu đường đi cho sáu chiều tuyến demo |
| Chọn điểm đi | Chưa có module journey planner mới | Chọn bến, tìm địa chỉ trong vùng Hà Nội hoặc lấy vị trí trình duyệt |
| Tìm hành trình | Đã có chức năng tra tuyến ở module passenger | Thêm module tính bến lên gần điểm đi, chuyến còn đón được, phút đi bộ, chờ, ngồi xe và tiền vé |
| Chi tiết | Chưa có màn hình chi tiết mới này | Thêm timeline, bến lên, bến xuống và các bến trong chặng |
| Bản đồ | Chưa có trang bản đồ mới này | Leaflet, nền Google Maps, marker và đường tuyến có cache |
| Theo dõi | Chưa có API tracking mới này | Lưu hành trình trong session, mô phỏng bốn bước theo giờ máy chủ |
| Mua vé | Chưa được hoàn thiện trong luồng mới | Nút vẫn chưa có nghiệp vụ mua vé |

Module mới dùng dữ liệu `stations`, `routes`, `route_stops`, `schedules` hiện có. Không thêm bảng địa điểm, bảng theo dõi hoặc bản sao module quản trị. Các API mới tiếp tục dùng phiên đăng nhập và `PassengerGuard` của dự án.

## 3. Luồng tổng thể để bạn đọc code

```text
Schema + seed hoặc migration 006 rồi 007
  -> AppModule đăng ký JourneyPlannerModule
  -> App.jsx mở JourneyPlannerPage
  -> JourneySidebar cho chọn A và B
  -> journeyPlannerApi gọi backend qua request helper
  -> Controller kiểm tra phiên, DTO kiểm tra dữ liệu
  -> JourneysService đọc MySQL và tính hành trình
  -> JourneyResults hiển thị các phương án
  -> Chọn thẻ: tải chi tiết và geometry của chặng
  -> JourneyMap vẽ marker và đường đi
  -> Bắt đầu: backend tính lại chi tiết rồi lưu session
  -> Polling: cập nhật bước mô phỏng mỗi 15 giây
  -> Kết thúc: xóa activeJourney, tìm lại chuyến phù hợp
```

Frontend gọi URL có `/api`. Vite chuyển tiếp tới backend, nơi controller khai báo URL không có tiền tố `/api`. Database chỉ được đọc hoặc ghi từ backend và các script quản trị dữ liệu.

## 4. Bước chuẩn bị: bổ sung tọa độ và đường tuyến

### 4.1. Tọa độ bến

Trong [01-schema.sql](../database/01-schema.sql), bảng `stations` thêm hai cột `decimal(10,7)` cho vĩ độ và kinh độ. Hai cột được phép cùng NULL. Nếu có dữ liệu thì phải có đủ cả hai, vĩ độ trong khoảng -90 đến 90, kinh độ trong khoảng -180 đến 180. Constraint `chk_stations_coordinates` kiểm tra điều này.

[station.entity.ts](../backend/src/stations/station.entity.ts) khai báo thêm hai thuộc tính tương ứng. Kiểu TypeScript là `string | null`, phù hợp cách driver trả giá trị DECIMAL. Các API journey planner chuyển sang `Number` trước khi trả tọa độ cho giao diện. TypeORM vẫn không tự đồng bộ schema.

[02-seed-hanoi.sql](../database/02-seed-hanoi.sql) bổ sung tọa độ vào dữ liệu bến demo. [hanoi-station-coordinates.json](../database/hanoi-station-coordinates.json) là danh sách tọa độ theo mã bến để migration nhận diện bến, không dựa vào ID cố định giữa các máy.

[006-station-coordinates.mjs](../database/migrations/006-station-coordinates.mjs) dành cho database đã tồn tại. Script đọc `.env`, tạo bản sao riêng trong `.local/backups`, thêm cột thiếu, kiểm tra tọa độ hiện có, chỉ điền bến demo có cả hai tọa độ NULL và bổ sung constraint. Script so checksum các cột nghiệp vụ cũ để phát hiện thay đổi ngoài phạm vi. Nó không chạy lại toàn bộ seed.

### 4.2. Geometry của tuyến

`routes.geometry` là JSON cho đường đi đầy đủ của tuyến. Dữ liệu đóng gói gồm phiên bản, nguồn, snapshot các bến, LineString và `stop_indices`. Snapshot là bản ghi mã bến, tọa độ và thứ tự tại lúc tạo đường. Nó giúp phát hiện đường cũ không còn khớp sau khi sửa bến.

Seed chứa sáu chiều `02-DI`, `02-VE`, `26-DI`, `26-VE`, `BRT01-DI`, `BRT01-VE`. Đường được lấy từ OSRM driving qua các bến demo, chưa phải dữ liệu đường xe buýt chính thức.

[007-route-geometry.mjs](../database/migrations/007-route-geometry.mjs) đọc các geometry đóng gói từ seed, sao lưu database, thêm cột thiếu và chỉ điền geometry đang NULL khi mã bến, tọa độ, thứ tự của tuyến khớp snapshot. Geometry có sẵn được giữ. Tuyến demo đã sửa không khớp sẽ bị bỏ qua. Script kiểm tra dữ liệu nghiệp vụ cũ trước khi commit phần cập nhật dữ liệu.

[build-route-geometry.mjs](../database/scripts/build-route-geometry.mjs) là công cụ bảo trì: đọc seed, gọi RoadRoutingService để dựng lại geometry và thay block SQL đóng gói. Đây là script có sửa seed, không phải bước bắt buộc mỗi lần khởi động ứng dụng.

[setup-local.mjs](../database/scripts/setup-local.mjs) thêm thông báo nâng cấp khi database tương thích đang thiếu `routes.geometry`. Thông báo này không tự chạy migration. Máy mới lấy schema và seed; máy có dữ liệu dùng migration theo [station-coordinates.md](../database/station-coordinates.md) và [database/README.md](../database/README.md).

## 5. Bước mở trang: nối module mới vào ứng dụng

[app.module.ts](../backend/src/app.module.ts) import và đăng ký `JourneyPlannerModule`. File [journey-planner.module.ts](../backend/src/journey-planner/journey-planner.module.ts) tập hợp các controller và service mới để NestJS nhận diện và cung cấp dependency.

[App.jsx](../frontend/src/App.jsx) thêm đường dẫn hợp lệ `/user/journey-planner`, import trang mới và truyền user cùng các trạng thái đăng xuất. Trang này được mở sau luồng kiểm tra đăng nhập hiện có. Test bổ sung kiểm tra cả USER và ADMIN mở trang riêng, không render thanh điều hướng quản trị.

[UserHomePage.jsx](../frontend/src/pages/UserHomePage.jsx) đổi nút Lộ trình & Bản đồ thành thẻ liên kết tới trang mới. [JourneyPlannerPage.jsx](../frontend/src/pages/JourneyPlannerPage.jsx) điều phối lựa chọn điểm đến, vị trí, kết quả tìm kiếm, chi tiết và tracking. Khi đang theo dõi, vị trí và điểm đến lấy từ hành trình trong session để khôi phục đúng chuyến.

Chú thích đoạn code thực tế trong `JourneyPlannerPage.jsx`:

```jsx
// Khi có hành trình đang theo dõi, ưu tiên bến xuống của chuyến đó.
// Nếu chưa theo dõi, dùng điểm đến vừa được người dùng chọn.
const destination =
  tracking.data?.journey.alighting_station || selectedDestination;

// Giữ điểm xuất phát của hành trình đã bắt đầu khi reload hoặc polling.
const position = tracking.data?.origin || current.position;
```

Các chú thích trong báo cáo giúp bạn đọc code tại chỗ; những đoạn trích được thêm lời giải thích tiếng Việt nhưng không thay đổi thuật toán trong source.

## 6. Bước chọn A và B: biến tên địa điểm thành tọa độ hợp lệ

### 6.1. Điểm đi A

[OriginAutocomplete.jsx](../frontend/src/components/journey-planner/OriginAutocomplete.jsx) có ba cách chọn: bến trong database, địa chỉ tự do, hoặc vị trí hiện tại. Gợi ý bến chờ 400 ms sau khi ngừng gõ rồi gọi `places`. Địa chỉ tự do chỉ gọi geocoding khi nhấn Enter hoặc nút Tìm địa chỉ tại Hà Nội. Gõ chữ chưa đủ để có điểm đi hợp lệ, bạn cần chọn một kết quả có tọa độ.

Khi sửa ô A, `change()` hủy tìm địa chỉ đang chờ, xóa kết quả địa chỉ, gọi `onClear()` và mở lại gợi ý. Callback trong page xóa tọa độ điểm đi và kết quả hành trình trước đó. Nhờ vậy tên vừa sửa không bị dùng chung với tọa độ của lựa chọn cũ.

[useCurrentPosition.js](../frontend/src/components/journey-planner/useCurrentPosition.js) quản lý các chế độ demo, thiết bị và chọn thủ công. Mặc định dùng [demoLocation.js](../frontend/src/components/journey-planner/demoLocation.js), gần Ngã Tư Sở, `21.004, 105.8195`. Đây là điểm demo, không chứng minh thiết bị đang ở đó. Khi người dùng yêu cầu định vị mới gọi `navigator.geolocation`, timeout 12 giây, chấp nhận cache vị trí 30 giây. Chế độ `device-fallback` dùng điểm demo nếu định vị thất bại; chế độ `device` hiển thị lỗi để thử lại.

[geocodingService.js](../frontend/src/services/geocodingService.js) gọi backend. [geocoding.controller.ts](../backend/src/journey-planner/geocoding.controller.ts) kiểm tra phiên và từ khóa từ 2 đến 255 ký tự. [geocoding.service.ts](../backend/src/journey-planner/geocoding.service.ts) chuyển từ khóa thành tọa độ bằng Nominatim, giới hạn một vùng Hà Nội, tối đa năm kết quả, timeout 8 giây. Cache 24 giờ, tối đa 200 từ khóa; gộp request trùng, giới hạn năm công việc chờ và giãn request 1,1 giây. `NOMINATIM_SEARCH_URL` là cấu hình tùy chọn đọc từ môi trường.

### 6.2. Điểm đến B

[PlaceAutocomplete.jsx](../frontend/src/components/journey-planner/PlaceAutocomplete.jsx) gợi ý bến trong database, chờ 250 ms sau khi ngừng gõ. Điểm đến hiện vẫn là **một bến**, chưa phải địa chỉ tự do. Chọn bằng chuột hoặc phím lên, xuống, Enter. Xóa hoặc sửa lựa chọn làm mất điểm đến hợp lệ và kết quả cũ.

[places.service.ts](../backend/src/journey-planner/places.service.ts) chỉ trả bến hoạt động có đủ tọa độ. Tìm trong tên, mã và địa chỉ, dùng collation không phân biệt hoa thường và dấu. Ưu tiên khớp hoàn toàn rồi khớp đầu chuỗi và khớp một phần. ID BIGINT trả dưới dạng chuỗi để không mất độ chính xác JavaScript.

Chú thích ý nghĩa của đoạn SQL trong service:

```ts
// Biến %, _ và ! do người dùng nhập thành ký tự thường trong LIKE.
const escaped = search.replace(/[!%_]/g, (character) => `!${character}`);
const contains = `%${escaped}%`;

// Dấu ? được truyền bằng mảng tham số, không ghép từ khóa vào SQL.
// Lọc bến có is_active=1 và có đủ latitude, longitude trước khi gợi ý.
```

`AbortController` trong các component và hook hủy request cũ, kết hợp kiểm tra signal trước khi ghi state. Khi bạn gõ nhanh hoặc đổi lựa chọn, kết quả trả muộn không được ghi đè lựa chọn mới.

## 7. Bước tìm tuyến: chọn chuyến có thể đón được

[useJourneySearch.js](../frontend/src/components/journey-planner/useJourneySearch.js) quản lý idle, loading, success, error, tuyến đang chọn và việc mở chi tiết. Mỗi lượt tìm hủy lượt trước. [JourneySearchSkeleton.jsx](../frontend/src/components/journey-planner/JourneySearchSkeleton.jsx) hiển thị trạng thái chờ; [JourneyResults.jsx](../frontend/src/components/journey-planner/JourneyResults.jsx) hiển thị danh sách hoặc kết quả rỗng; [JourneyRouteCard.jsx](../frontend/src/components/journey-planner/JourneyRouteCard.jsx) trình bày phương án và cho chọn tuyến.

[journeyPlannerApi.js](../frontend/src/services/journeyPlannerApi.js) đóng gói request. [journeys.controller.ts](../backend/src/journey-planner/journeys.controller.ts) nhận query qua DTO và gọi [journeys.service.ts](../backend/src/journey-planner/journeys.service.ts).

Backend thực hiện lần lượt:

1. Kiểm tra điểm đến đang hoạt động và có tọa độ.
2. Tìm tuyến ACTIVE đi qua bến đích. Bến lên phải đứng trước bến đích theo `stop_order`, kilomet và phút hành trình phải hợp lệ. Tuyến có bến ngừng hoạt động bị loại.
3. Tính khoảng cách từ A đến bến lên bằng Haversine. Chỉ giữ bến trong 2.000 m và xét bến gần trước.
4. Đọc lịch SCHEDULED hoặc DEPARTED còn phù hợp. Tính giờ xe tới bến bằng giờ xuất phát cộng phút từ đầu tuyến.
5. Bỏ chuyến tới trước khi người dùng đi bộ đến bến. Một chuyến đã rời đầu tuyến vẫn có thể được chọn nếu chưa tới bến lên.
6. Lấy một phương án cho mỗi tuyến, ở bến gần đầu tiên có chuyến đón được. Đây chưa phải thuật toán tối ưu mọi bến lên theo tổng thời gian.
7. Sắp xếp các tuyến theo tổng phút tăng dần, rồi khoảng cách đi bộ, rồi mã tuyến.

[journey-calculation.ts](../backend/src/journey-planner/journey-calculation.ts) chứa các hàm tính thuần, không truy vấn database. Quy tắc hiện có:

| Đại lượng | Cách tính |
| --- | --- |
| Khoảng cách đi bộ | Khoảng cách chim bay giữa A và bến lên |
| Tốc độ đi bộ | 5 km/h |
| Phút đi bộ | Làm tròn lên theo khoảng cách và tốc độ |
| Phút chờ tại bến | Giờ đón trừ giờ đi bộ tới bến, làm tròn lên |
| Phút ngồi xe | minutes_from_origin của bến xuống trừ bến lên |
| Tổng phút | Đi bộ + chờ + ngồi xe |
| Giá vé | ROUND(4000 + 500 × số km của chặng, 0) |
| Giới hạn giờ đón | Trước nửa đêm kết thúc ngày hiện tại tại Việt Nam |

Chú thích đoạn tính trong `nextPickup()`:

```ts
// Mốc sớm nhất người dùng có thể có mặt tại bến.
const atStation = now + walkMinutes * MINUTE_MS;

// Xe đến bến lên và bến xuống sau thời điểm xuất phát các phút tương ứng.
const pickup = departure + boardingOffset * MINUTE_MS;
const dropoff = departure + destinationOffset * MINUTE_MS;

// Nếu xe đến trước người đi bộ, bỏ chuyến và xét chuyến tiếp theo.
// Code còn kiểm tra giới hạn ngày Việt Nam và thời gian arrival_at của lịch.
```

Kết quả là tuyến trực tiếp tới bến đích, chưa tìm chuyển tuyến. Không có lịch phù hợp thì trả danh sách rỗng, không tự tạo thời gian chờ giả.

## 8. Bước chọn phương án: tải lại chi tiết và dựng timeline

[useJourneyDetail.js](../frontend/src/components/journey-planner/useJourneyDetail.js) tải chi tiết mỗi lần chọn tuyến. Khóa request gồm tuyến, đích, tọa độ, phiên bản lựa chọn và lần thử lại, giúp phân biệt lựa chọn mới với response cũ.

`JourneysService.detail()` tìm lại hành trình theo dữ liệu hiện tại, rồi đọc các bến từ bến lên đến bến xuống. Nếu tuyến không còn chuyến đón được, trả 404 để người dùng tìm lại. Response có bến xuống, danh sách bến, số chặng giữa bến và thời điểm cập nhật.

[JourneyDetailPanel.jsx](../frontend/src/components/journey-planner/JourneyDetailPanel.jsx) hiển thị tổng thời gian, giá và hành động. [JourneyTimeline.jsx](../frontend/src/components/journey-planner/JourneyTimeline.jsx) biểu diễn các bước. Do đích là một bến nên backend hiện đặt `walking_after_m = 0` và `walking_after_minutes = 0`, chưa tính đoạn đi bộ từ bến xuống đến địa chỉ khác.

Nút Bắt đầu hành trình có nghiệp vụ ở bước tracking. Nút Mua vé chưa có thao tác mua hoặc thanh toán.

## 9. Bước vẽ bản đồ: nền, marker và geometry là các phần riêng

[JourneyMap.jsx](../frontend/src/components/journey-planner/JourneyMap.jsx) dùng Leaflet. Nền tile hiện là URL Google Maps `https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}`, khác với mô tả Leaflet/OpenStreetMap ở đoạn mở đầu của tài liệu module cũ. OSRM cung cấp đường đi; Nominatim cung cấp tọa độ địa chỉ. Vì vậy không nên gọi toàn bộ chức năng này là Google Maps API.

Map và tile layer được giữ khi đổi tuyến. Marker A và B thay đổi theo lựa chọn. Geometry GeoJSON lưu điểm dưới dạng `[longitude, latitude]`, Leaflet vẽ bằng `[latitude, longitude]`; đảo sai thứ tự sẽ đặt đường sai vị trí. Màu tuyến 02 là xanh, 26 là tím, BRT là nâu cam. Đoạn từ A đến bến lên là nét đứt theo đường chim bay.

[useRouteMap.js](../frontend/src/components/journey-planner/useRouteMap.js) tải trước tối đa sáu phương án, hai request đồng thời, cache tối đa 24 chặng trong lượt tìm hiện tại. Khóa chặng gồm route ID, bến lên và bến xuống. Tìm mới thay nhóm kết quả thì bỏ cache cũ; đổi lại tuyến đã tải có thể dùng cache.

[route-map.service.ts](../backend/src/journey-planner/route-map.service.ts) xử lý ba tầng:

1. **Database:** đọc tuyến và các bến trong cùng snapshot, kiểm tra geometry còn khớp, cắt đúng chặng và trả `source: database`.
2. **OSRM:** nếu geometry thiếu hoặc không hợp lệ, lấy đường toàn tuyến, ghi cache có điều kiện rồi trả phần chặng với `source: osrm-driving`.
3. **Đường nối bến:** nếu dịch vụ đường đi lỗi, trả LineString đi qua các bến của chặng, `source: straight-line`, `approximate: true`. Giao diện vẽ nét đứt và cho thử lại; đường tạm không được lưu thành geometry đường phố.

[route-geometry.ts](../backend/src/journey-planner/route-geometry.ts) kiểm tra cấu trúc, snapshot, tọa độ và chỉ số bến, ghép các leg rồi cắt theo `stop_indices`. Cách này tránh cắt nhầm ở tuyến có vòng hoặc giao cắt như khi chỉ chọn điểm gần nhất.

[road-routing.service.ts](../backend/src/journey-planner/road-routing.service.ts) gọi OSRM, giãn lượt 1,1 giây, timeout fetch 4 giây, giới hạn bốn request chờ, gộp request trùng và cache một giờ cho tối đa 100 tuyến. Cache tính theo tọa độ có thứ tự, nên hai chiều tuyến không bị dùng chung sai.

Chú thích thao tác lưu trong `RouteMapService`:

```ts
// Chỉ ghi nếu giá trị geometry vẫn bằng giá trị đã đọc.
// Tránh ghi đè cache mới do một request khác vừa cập nhật.
await this.db.query(
  'UPDATE routes SET geometry=? WHERE id=? AND geometry <=> CAST(? AS JSON)',
  [/* geometry mới, ID tuyến, geometry lúc đọc */],
);
```

Transaction đọc database kết thúc trước khi chờ OSRM. Nếu ghi cache thất bại, backend vẫn có thể trả đường vừa lấy được. Nếu MySQL hoặc backend không đọc được bến thì đó là lỗi khác, không thể dùng tầng đường nối bến để thay thế mọi lỗi.

## 10. Bước bắt đầu, theo dõi và kết thúc

[tracking.controller.ts](../backend/src/journey-planner/tracking.controller.ts) tính lại chi tiết khi bắt đầu, tạo UUID và lưu `activeJourney` vào session. Client gửi tọa độ, ID đích, ID tuyến, nhãn điểm đi tùy chọn; giá và thời gian do backend tính. Mỗi phiên có tối đa một hành trình.

Gửi lại yêu cầu bắt đầu cùng tuyến, đích và tọa độ trả hành trình đang có. Bắt đầu chuyến khác khi đang theo dõi trả 409. Bộ `starting` chặn thao tác bắt đầu đồng thời trên cùng session trong lúc đang khởi tạo.

[tracking-state.ts](../backend/src/journey-planner/tracking-state.ts) tính bốn bước từ snapshot và giờ máy chủ:

1. Đi bộ tới bến, trước `started_at + walking_minutes`.
2. Chờ xe, sau khi đến bến và trước `pickup_at`.
3. Di chuyển trên xe, từ `pickup_at` tới `dropoff_at`.
4. Đến điểm đến, từ `dropoff_at` trở đi.

Chú thích đoạn chọn bước thực tế:

```ts
// Kiểm tra mốc xa nhất trước để trả bước hiện tại của hành trình.
const step =
  now >= dropoff ? 4 : now >= pickup ? 3 : now >= reachedStop ? 2 : 1;

// Cắt về 0 để giao diện không đếm ngược thành số âm.
pickup_in_seconds: Math.max(0, Math.ceil((pickup - now) / 1000));
```

[useJourneyTracking.js](../frontend/src/components/journey-planner/useJourneyTracking.js) đọc session lúc mở trang và hỏi lại sau mỗi 15 giây khi có hành trình. Hook giữ object vị trí và chi tiết ổn định để polling không gây tải lại geometry. Biến `revision` cùng cờ thao tác giúp bỏ response polling đến muộn sau khi đã kết thúc.

[JourneyTrackingPanel.jsx](../frontend/src/components/journey-planner/JourneyTrackingPanel.jsx) hiển thị bước hiện tại và thời gian. Xem chi tiết rồi tiếp tục chỉ đổi màn hình, không tạo chuyến khác. [EndJourneyDialog.jsx](../frontend/src/components/journey-planner/EndJourneyDialog.jsx) dùng lại StationDialog để xác nhận kết thúc.

`endJourney()` trong page chỉ chuyển khỏi tracking sau khi backend xác nhận thành công. Sau đó giữ A, B và tìm lại các chuyến còn phù hợp ở thời điểm mới; giữ tuyến cũ được chọn nếu nó còn trong danh sách. Nếu kết thúc lỗi, giữ trạng thái để thử lại.

Tracking trả `simulated: true`: đây là mô phỏng theo thời gian, không phải vị trí xe trực tiếp. Snapshot lịch được chốt khi bắt đầu, không tự lấy thay đổi hoặc hủy lịch của Admin sau đó. Reload có thể khôi phục trong cùng session; session hiện lưu trong bộ nhớ nên restart backend, logout hoặc hết phiên sẽ mất. Chưa có lịch sử chuyến đi lâu dài.

## 11. Danh sách đầy đủ 80 file và chú giải

`Sửa` nghĩa là file đã tồn tại trong main. `Mới` nghĩa là file chưa được Git theo dõi lúc kiểm tra. Đường dẫn trong bảng có thể bấm mở. Các file được nhóm theo luồng vừa giải thích.

### 11.1. Dữ liệu và khởi tạo, 11 file

| Trạng thái | File | Thay đổi hoặc vai trò |
| --- | --- | --- |
| Sửa | [database/01-schema.sql](../database/01-schema.sql) | Thêm tọa độ, constraint và routes.geometry. |
| Sửa | [database/02-seed-hanoi.sql](../database/02-seed-hanoi.sql) | Thêm tọa độ bến và geometry sáu chiều tuyến demo. |
| Mới | [database/hanoi-station-coordinates.json](../database/hanoi-station-coordinates.json) | Tọa độ demo tra theo mã bến. |
| Mới | [database/migrations/006-station-coordinates.mjs](../database/migrations/006-station-coordinates.mjs) | Nâng cấp tọa độ cho database đang dùng. |
| Mới | [database/migrations/007-route-geometry.mjs](../database/migrations/007-route-geometry.mjs) | Thêm và điền geometry còn trống cho tuyến khớp seed. |
| Mới | [database/scripts/build-route-geometry.mjs](../database/scripts/build-route-geometry.mjs) | Dựng lại block geometry trong seed. |
| Sửa | [database/scripts/setup-local.mjs](../database/scripts/setup-local.mjs) | Thông báo cần nâng cấp geometry trên database cũ. |
| Mới | [database/station-coordinates.md](../database/station-coordinates.md) | Hướng dẫn và nguồn tọa độ demo. |
| Sửa | [database/README.md](../database/README.md) | Thêm cách nâng cấp và lưu ý dữ liệu bản đồ. |
| Sửa | [backend/src/stations/station.entity.ts](../backend/src/stations/station.entity.ts) | Ánh xạ hai cột DECIMAL mới. |
| Sửa | [backend/tsconfig.build.tsbuildinfo](../backend/tsconfig.build.tsbuildinfo) | Cache build TypeScript thay đổi, không phải tính năng nghiệp vụ. |

### 11.2. Đăng ký, điều hướng và thư viện, 6 file

| Trạng thái | File | Thay đổi hoặc vai trò |
| --- | --- | --- |
| Sửa | [backend/src/app.module.ts](../backend/src/app.module.ts) | Đăng ký JourneyPlannerModule. |
| Mới | [backend/src/journey-planner/journey-planner.module.ts](../backend/src/journey-planner/journey-planner.module.ts) | Tập hợp controller và provider. |
| Sửa | [frontend/src/App.jsx](../frontend/src/App.jsx) | Nhận đường dẫn và render trang mới. |
| Sửa | [frontend/src/pages/UserHomePage.jsx](../frontend/src/pages/UserHomePage.jsx) | Đổi điều hướng sang trang hành trình. |
| Sửa | [frontend/package.json](../frontend/package.json) | Thêm leaflet ^1.9.4. |
| Sửa | [frontend/package-lock.json](../frontend/package-lock.json) | Ghi phiên bản và thông tin khóa dependency Leaflet. |

### 11.3. Địa điểm và điểm đi, 12 file

| Trạng thái | File | Thay đổi hoặc vai trò |
| --- | --- | --- |
| Mới | [backend/src/journey-planner/places.controller.ts](../backend/src/journey-planner/places.controller.ts) | Endpoint gợi ý bến. |
| Mới | [backend/src/journey-planner/places.service.ts](../backend/src/journey-planner/places.service.ts) | SQL tìm bến hoạt động có tọa độ và phân trang. |
| Mới | [backend/src/journey-planner/dto/search-places.dto.ts](../backend/src/journey-planner/dto/search-places.dto.ts) | Kiểm tra từ khóa, page và limit. |
| Mới | [backend/src/journey-planner/geocoding.controller.ts](../backend/src/journey-planner/geocoding.controller.ts) | Endpoint địa chỉ, có GeocodeQueryDto trong file. |
| Mới | [backend/src/journey-planner/geocoding.service.ts](../backend/src/journey-planner/geocoding.service.ts) | Tìm địa chỉ qua Nominatim, cache và hàng đợi. |
| Mới | [frontend/src/services/geocodingService.js](../frontend/src/services/geocodingService.js) | Gọi proxy geocoding ở backend. |
| Mới | [frontend/src/components/journey-planner/OriginAutocomplete.jsx](../frontend/src/components/journey-planner/OriginAutocomplete.jsx) | Chọn A bằng bến, địa chỉ hoặc định vị. |
| Mới | [frontend/src/components/journey-planner/PlaceAutocomplete.jsx](../frontend/src/components/journey-planner/PlaceAutocomplete.jsx) | Gợi ý và chọn bến đích B. |
| Mới | [frontend/src/components/journey-planner/useCurrentPosition.js](../frontend/src/components/journey-planner/useCurrentPosition.js) | Quản lý định vị và lựa chọn điểm đi. |
| Mới | [frontend/src/components/journey-planner/demoLocation.js](../frontend/src/components/journey-planner/demoLocation.js) | Điểm xuất phát demo. |
| Mới | [frontend/src/components/journey-planner/origin-autocomplete.css](../frontend/src/components/journey-planner/origin-autocomplete.css) | Style dropdown điểm đi. |
| Mới | [docs/journey-origin.md](journey-origin.md) | Giải thích nhập A và giới hạn geocoding. |

### 11.4. Tìm và xem chi tiết, 15 file

| Trạng thái | File | Thay đổi hoặc vai trò |
| --- | --- | --- |
| Mới | [backend/src/journey-planner/journeys.controller.ts](../backend/src/journey-planner/journeys.controller.ts) | Endpoint tìm và xem chi tiết. |
| Mới | [backend/src/journey-planner/journeys.service.ts](../backend/src/journey-planner/journeys.service.ts) | Chọn bến lên, lịch, giá, thời gian và đọc bến của chặng. |
| Mới | [backend/src/journey-planner/journey-calculation.ts](../backend/src/journey-planner/journey-calculation.ts) | Haversine, đi bộ, giới hạn ngày và giờ đón. |
| Mới | [backend/src/journey-planner/dto/search-journeys.dto.ts](../backend/src/journey-planner/dto/search-journeys.dto.ts) | Kiểm tra tọa độ và ID đích. |
| Mới | [backend/src/journey-planner/dto/journey-detail.dto.ts](../backend/src/journey-planner/dto/journey-detail.dto.ts) | Kế thừa query tìm, thêm route_id. |
| Mới | [frontend/src/services/journeyPlannerApi.js](../frontend/src/services/journeyPlannerApi.js) | Đóng gói API places, search, detail, map và tracking. |
| Mới | [frontend/src/components/journey-planner/useJourneySearch.js](../frontend/src/components/journey-planner/useJourneySearch.js) | State tìm, hủy request và tuyến chọn. |
| Mới | [frontend/src/components/journey-planner/JourneySearchSkeleton.jsx](../frontend/src/components/journey-planner/JourneySearchSkeleton.jsx) | Hiển thị ba thẻ đang tải. |
| Mới | [frontend/src/components/journey-planner/JourneyResults.jsx](../frontend/src/components/journey-planner/JourneyResults.jsx) | Danh sách phương án và trạng thái rỗng. |
| Mới | [frontend/src/components/journey-planner/JourneyRouteCard.jsx](../frontend/src/components/journey-planner/JourneyRouteCard.jsx) | Thẻ tuyến, giá và thời gian. |
| Mới | [frontend/src/components/journey-planner/useJourneyDetail.js](../frontend/src/components/journey-planner/useJourneyDetail.js) | Tải lại chi tiết và bỏ response cũ. |
| Mới | [frontend/src/components/journey-planner/JourneyDetailPanel.jsx](../frontend/src/components/journey-planner/JourneyDetailPanel.jsx) | Sidebar chi tiết và hành động. |
| Mới | [frontend/src/components/journey-planner/JourneyTimeline.jsx](../frontend/src/components/journey-planner/JourneyTimeline.jsx) | Timeline các bước di chuyển. |
| Mới | [frontend/src/components/journey-planner/journey-detail.css](../frontend/src/components/journey-planner/journey-detail.css) | Style chi tiết và nút. |
| Mới | [docs/journey-planner-module.md](journey-planner-module.md) | Hướng dẫn module, API và quy tắc tìm. |

### 11.5. Bản đồ, 8 file

| Trạng thái | File | Thay đổi hoặc vai trò |
| --- | --- | --- |
| Mới | [backend/src/journey-planner/route-map.controller.ts](../backend/src/journey-planner/route-map.controller.ts) | Endpoint geometry của chặng. |
| Mới | [backend/src/journey-planner/route-map.service.ts](../backend/src/journey-planner/route-map.service.ts) | Chọn DB, OSRM hoặc đường tạm; lưu cache. |
| Mới | [backend/src/journey-planner/route-geometry.ts](../backend/src/journey-planner/route-geometry.ts) | Kiểm tra, ghép và cắt geometry theo bến. |
| Mới | [backend/src/journey-planner/road-routing.service.ts](../backend/src/journey-planner/road-routing.service.ts) | HTTP tới OSRM và cache bộ nhớ. |
| Mới | [backend/src/journey-planner/dto/route-map.dto.ts](../backend/src/journey-planner/dto/route-map.dto.ts) | Kiểm tra ID tuyến, bến lên và bến xuống. |
| Mới | [frontend/src/components/journey-planner/useRouteMap.js](../frontend/src/components/journey-planner/useRouteMap.js) | Tải trước và cache các chặng. |
| Mới | [frontend/src/components/journey-planner/JourneyMap.jsx](../frontend/src/components/journey-planner/JourneyMap.jsx) | Leaflet, nền, marker, đường và thử lại. |
| Mới | [frontend/src/components/journey-planner/journey-map.css](../frontend/src/components/journey-planner/journey-map.css) | Style bản đồ, marker và chú giải. |

### 11.6. Tracking và trang điều phối, 10 file

| Trạng thái | File | Thay đổi hoặc vai trò |
| --- | --- | --- |
| Mới | [backend/src/journey-planner/tracking.controller.ts](../backend/src/journey-planner/tracking.controller.ts) | Start, current, end trong session. |
| Mới | [backend/src/journey-planner/tracking-state.ts](../backend/src/journey-planner/tracking-state.ts) | Kiểu activeJourney và bước mô phỏng. |
| Mới | [backend/src/journey-planner/dto/start-tracking.dto.ts](../backend/src/journey-planner/dto/start-tracking.dto.ts) | Kế thừa query chi tiết, thêm origin_label tùy chọn. |
| Mới | [frontend/src/components/journey-planner/useJourneyTracking.js](../frontend/src/components/journey-planner/useJourneyTracking.js) | Khôi phục, polling, start, end và chống response cũ. |
| Mới | [frontend/src/components/journey-planner/JourneyTrackingPanel.jsx](../frontend/src/components/journey-planner/JourneyTrackingPanel.jsx) | Màn hình theo dõi mô phỏng. |
| Mới | [frontend/src/components/journey-planner/EndJourneyDialog.jsx](../frontend/src/components/journey-planner/EndJourneyDialog.jsx) | Xác nhận kết thúc bằng dialog dùng chung. |
| Mới | [frontend/src/components/journey-planner/journey-tracking.css](../frontend/src/components/journey-planner/journey-tracking.css) | Style theo dõi và dialog. |
| Mới | [frontend/src/pages/JourneyPlannerPage.jsx](../frontend/src/pages/JourneyPlannerPage.jsx) | Điều phối toàn bộ luồng và tìm lại sau khi kết thúc. |
| Mới | [frontend/src/components/journey-planner/JourneySidebar.jsx](../frontend/src/components/journey-planner/JourneySidebar.jsx) | Ghép hai ô A/B, trạng thái tìm, danh sách và chi tiết. |
| Mới | [frontend/src/pages/journey-planner.css](../frontend/src/pages/journey-planner.css) | Bố cục trang, header và sidebar. |

### 11.7. Kiểm thử và tài liệu ngữ cảnh, 18 file

| Trạng thái | File | Nội dung |
| --- | --- | --- |
| Mới | [backend/src/journey-planner/geocoding.service.spec.ts](../backend/src/journey-planner/geocoding.service.spec.ts) | Giới hạn vùng, dữ liệu trả về, gộp request, cache lỗi. |
| Mới | [backend/src/journey-planner/journey-calculation.spec.ts](../backend/src/journey-planner/journey-calculation.spec.ts) | Khoảng cách, giờ đón, lỡ xe, ranh giới ngày Việt Nam. |
| Mới | [backend/src/journey-planner/road-routing.service.spec.ts](../backend/src/journey-planner/road-routing.service.spec.ts) | Giãn lượt, thứ tự tọa độ, cache và thử lại. |
| Mới | [backend/src/journey-planner/route-geometry.spec.ts](../backend/src/journey-planner/route-geometry.spec.ts) | Cắt đường có vòng và loại geometry không hợp lệ. |
| Mới | [backend/src/journey-planner/route-map.service.spec.ts](../backend/src/journey-planner/route-map.service.spec.ts) | Đọc DB, lưu cache, đường tạm, lỗi ghi và chặng sai. |
| Mới | [backend/src/journey-planner/tracking-state.spec.ts](../backend/src/journey-planner/tracking-state.spec.ts) | Các mốc bước và đếm ngược không âm. |
| Mới | [backend/test/journey-planner.e2e-spec.ts](../backend/test/journey-planner.e2e-spec.ts) | Tích hợp API journey planner, MySQL và phiên đăng nhập. |
| Sửa | [frontend/src/App.test.jsx](../frontend/src/App.test.jsx) | Thêm kiểm tra USER và ADMIN mở trang journey planner. |
| Mới | [frontend/src/pages/JourneyPlannerPage.test.jsx](../frontend/src/pages/JourneyPlannerPage.test.jsx) | Luồng chọn, tìm, chi tiết, tracking, lỗi và response đến muộn. |
| Mới | [frontend/src/components/journey-planner/JourneyMap.test.jsx](../frontend/src/components/journey-planner/JourneyMap.test.jsx) | Marker, cache đường, màu, nền Google và fallback. |
| Mới | [frontend/src/components/journey-planner/OriginAutocomplete.test.jsx](../frontend/src/components/journey-planner/OriginAutocomplete.test.jsx) | Debounce 400 ms, không geocode mỗi phím và thử lại lỗi. |
| Mới | [frontend/src/components/journey-planner/useJourneyTracking.test.jsx](../frontend/src/components/journey-planner/useJourneyTracking.test.jsx) | Polling không thay object map, không phục hồi chuyến đã kết thúc. |
| Mới | [frontend/src/services/geocodingService.test.js](../frontend/src/services/geocodingService.test.js) | Query địa chỉ và signal qua backend. |
| Mới | [frontend/src/services/journeyPlannerApi.test.js](../frontend/src/services/journeyPlannerApi.test.js) | Payload tọa độ, ID, start/end, không nhận giá client. |
| Sửa | [backend/AGENTS.md](../backend/AGENTS.md) | Thêm ngữ cảnh geocoding, cấu hình và nhãn A trong tracking. |
| Sửa | [frontend/AGENTS.md](../frontend/AGENTS.md) | Thêm quy tắc nhập A/B, debounce và tránh trùng ô tìm trên map. |
| Mới | [docs/journey-map.md](journey-map.md) | Geometry ba tầng, cache, nguồn nền và hướng dẫn kiểm tra. |
| Mới | [docs/journey-tracking.md](journey-tracking.md) | API, session, bốn bước và giới hạn mô phỏng. |
Tổng theo các bảng: 11 + 6 + 12 + 15 + 8 + 10 + 18 = 80 file, gồm 14 file sửa và 66 file mới.

## 12. Bảng API để lần theo frontend tới backend

| Phương thức | Backend URL | Công việc |
| --- | --- | --- |
| GET | `/journey-planner/places` | Tìm bến có tọa độ theo search, page, limit. |
| GET | `/journey-planner/geocoding` | Đổi từ khóa địa chỉ Hà Nội thành gợi ý tọa độ. |
| GET | `/journey-planner/journeys` | Tìm tuyến theo latitude, longitude, destination_station_id. |
| GET | `/journey-planner/journeys/detail` | Query tìm cộng route_id để tải lại chi tiết. |
| GET | `/journey-planner/route-map` | Lấy geometry theo route_id, from_station_id, to_station_id. |
| GET | `/journey-planner/tracking` | Đọc activeJourney của phiên hiện tại. |
| POST | `/journey-planner/tracking` | Tính lại và bắt đầu hành trình. |
| POST | `/journey-planner/tracking/:id/end` | Kết thúc hành trình có UUID tương ứng. |

Tất cả dùng PassengerGuard. Frontend giữ cookie bằng request helper hiện có. POST theo cơ chế chung cần `X-GoBus-Request: 1`. DTO chặn input sai; 401 liên quan phiên, 400 input, 404 tuyến hoặc đích không còn phù hợp, 409 xung đột tracking. API map có thể trả 422 khi thiếu tọa độ hoặc vượt 100 bến.

## 13. Phạm vi đã kiểm tra trong phiên viết báo cáo

Phiên này đọc trạng thái Git, diff, manifest, code nghiệp vụ, DTO, hook, migration và các trường hợp test. Chưa chạy lại build, lint, unit test, E2E hoặc thao tác trình duyệt, vì yêu cầu hiện tại là giải thích và ghi tài liệu. Không suy từ việc có file test rằng test đang đạt.

Các tài liệu journey có ghi kết quả kiểm tra ngày 04/10/2026. Đó là ghi nhận cũ trong repo, không phải kết quả chạy lại ngày 07/10/2026. Các test giao diện dùng mock Leaflet hoặc jsdom không chứng minh chất lượng nền bản đồ trên trình duyệt thật.

Bạn có thể kiểm tra code hiện tại bằng các lệnh sau trong đúng thư mục:

```powershell
# Chạy trong backend/
npm run build
npm run lint
npm test -- src/journey-planner
npm run test:e2e -- test/journey-planner.e2e-spec.ts

# Chạy trong frontend/
npm run build
npm run lint
npm test -- src/pages/JourneyPlannerPage.test.jsx src/components/journey-planner src/services/journeyPlannerApi.test.js src/services/geocodingService.test.js src/App.test.jsx
```

E2E cần MySQL và cấu hình tài khoản test theo hướng dẫn backend. Nếu đọc để học code, bạn có thể bắt đầu từ JourneyPlannerPage, lần tới từng hook, API wrapper, controller, service rồi các hàm tính thuần. Cách này cho thấy mỗi thao tác trên giao diện đi tới dữ liệu và quay về kết quả như thế nào.
