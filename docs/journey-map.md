# Bản đồ module Lộ trình

## Chạy trên máy mới

Theo README, chạy `node database/scripts/setup-local.mjs`, cài npm trong `backend/` và `frontend/`, rồi chạy hai ứng dụng. Bản đồ không thêm API key hay biến môi trường riêng.

`01-schema.sql` có `routes.geometry JSON NULL`. `02-seed-hanoi.sql` đóng gói đường phố cho đủ sáu chiều: 02-DI, 02-VE, 26-DI, 26-VE, BRT01-DI, BRT01-VE. Nạp SQL là có đường đi, không cần gọi OSRM để tạo lại. Các bến được nhận diện bằng mã, tọa độ và thứ tự, không phụ thuộc ID trên máy người tạo.

Database đã tồn tại: chạy `node database/migrations/007-route-geometry.mjs` từ root sau khi cài backend. Nếu thiếu tọa độ, chạy migration 006 trước. Migration 007 tạo bản sao riêng trong `.local/backups`, chỉ thêm cột và điền geometry còn trống của tuyến demo khớp các bến. Không sửa tuyến đã được thành viên thay đổi, không ghi đè geometry có sẵn. Đã áp dụng và chạy lại thành công trên máy hiện tại.

## Nền bản đồ Google Maps

Theo yêu cầu tiếp theo của người dùng, nền bản đồ được chuyển sang `https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}`, subdomains `0,1,2,3`, attribution Google Maps. Cấu hình này không thêm key hoặc biến môi trường. URL này khác Google Map Tiles API được tài liệu chính thức hướng dẫn dùng API key và session token; không coi việc tải được URL trực tiếp là cam kết dịch vụ miễn phí hoặc ổn định lâu dài.

Zoom tối đa 20. Leaflet giữ ba hàng/cột tile ngoài khung nhìn (`keepBuffer: 3`), tải sau khi dừng kéo (`updateWhenIdle: true`), không tải từng mức zoom trung gian khi đang phóng (`updateWhenZooming: false`). Map và tile layer chỉ khởi tạo một lần, không bị tạo lại khi đổi tuyến. HTTP cache do trình duyệt và máy chủ quản lý; không tải hàng loạt tile hay làm gói offline.

Nền bản đồ vẫn cần Internet. Chưa xác minh nguyên nhân mạng OSM trên máy người dùng; thay nguồn không đảm bảo khắc phục mọi lỗi mạng, ô xám hoặc độ mờ khi zoom. Raster ở mức zoom tối đa không có độ sắc nét vô hạn trên mọi màn hình. Trước đó CARTO Voyager đã được kiểm tra ở zoom 16 và 19: HTTP 200 nhưng ảnh chỉ có chữ “API KEY REQUIRED”.

## Geometry ba tầng

API giữ nguyên:

```text
GET /journey-planner/route-map?route_id=...&from_station_id=...&to_station_id=...
```

Frontend dùng tiền tố `/api` và phiên USER/ADMIN. Backend kiểm tra tuyến ACTIVE, các bến hoạt động, bến lên đứng trước bến xuống, tọa độ đầy đủ, tối đa 100 bến toàn tuyến.

1. **Database:** đọc geometry toàn tuyến trong cùng snapshot với các bến. Kiểm tra phiên bản, tọa độ hợp lệ, snapshot mã/thứ tự/tọa độ của bến và chỉ số cắt. Trả đúng chặng ngay, `source: database`, không gọi OSRM.
2. **OSRM:** chỉ khi geometry thiếu, sai định dạng hoặc không còn khớp bến. Gọi đường toàn tuyến, dùng geometry của từng leg để ghi chính xác chỉ số bến. Lưu vào `routes.geometry` và trả chặng, `source: osrm-driving`. Không dùng phép tìm điểm gần nhất để cắt vì có thể sai tại vòng lặp/giao cắt. Không giữ transaction khi chờ mạng. Ghi có điều kiện để không đè geometry được request khác cập nhật; lỗi ghi cache không làm mất đường vừa lấy thành công.
3. **Đường nối bến:** khi OSRM lỗi, timeout hoặc quá tải, trả LineString qua tất cả bến của chặng theo thứ tự, `source: straight-line`, `approximate: true`. Frontend vẽ nét đứt, chú thích đường tạm thời và cho thử tải lại đường phố. Không hiện lỗi đỏ do OSRM và không lưu đường thẳng vào DB như đường phố thật.

Lỗi xác thực/input/tuyến không còn hợp lệ vẫn trả 401/400/404; thiếu tọa độ trả 422. Mất kết nối backend hoặc MySQL là lỗi khác với OSRM, không thể cam kết luôn có đường khi chưa đọc được các bến.

OSRM giữ giới hạn tối đa bốn request chờ, cách nhau ít nhất 1,1 giây, timeout fetch 4 giây. Cache trong bộ nhớ một giờ, tối đa 100 tuyến, gộp request trùng. Chỉ tọa độ bến công cộng được gửi ra ngoài. Tuyến mới chưa cache có thể đợi mạng và hàng đợi; sáu tuyến đóng gói đi thẳng tầng DB.

Đường đóng gói lấy từ OSRM driving qua các bến đại diện trong seed, **không phải đường chuẩn chính thức của xe buýt hoặc làn BRT**. Giá vé, phút chờ, phút ngồi xe vẫn lấy dữ liệu nghiệp vụ theo [tài liệu lộ trình](journey-planner-module.md), không lấy thời gian lái ô tô của OSRM.

## Chuyển tuyến trên frontend

- Vị trí mặc định gần Ngã Tư Sở `21.004, 105.8195`, nhãn Vị trí của bạn. Dùng vị trí hiện tại mới xin GPS.
- Khi có kết quả, tải trước geometry của tối đa sáu phương án, hai request đồng thời. Chưa chọn thẻ thì chưa vẽ đường.
- Cache nằm trong lần tìm hiện tại, giới hạn 24 chặng và bỏ khi có kết quả tìm mới. Đổi lại một tuyến đã tải vẽ từ bộ nhớ, không gọi lại API geometry và không cần đợi API chi tiết. API chi tiết vẫn cập nhật lịch đón; nếu bến lên thay đổi sẽ lấy chặng mới. Nếu chi tiết không còn hợp lệ, bỏ đường đã hiển thị.
- Tuyến 02 màu xanh dương, 26 tím, BRT nâu cam. Chú thích theo màu đang chọn. Hủy request cũ khi đổi lựa chọn để tránh vẽ nhầm tuyến.
- Quay lại danh sách giữ đường và lựa chọn; tìm lại hoặc đổi điểm đến sẽ bỏ kết quả cũ. Nền bản đồ luôn được giữ.
- Đoạn từ vị trí người dùng tới bến là nét đứt theo đường chim bay, chưa phải chỉ đường đi bộ thực.

## Phân chia code

| File | Trách nhiệm |
| --- | --- |
| `backend/src/journey-planner/route-map.service.ts` | Đọc DB, chọn ba tầng, cắt chặng và lưu cache. |
| `backend/src/journey-planner/route-geometry.ts` | Kiểm tra GeoJSON/snapshot, ghép leg và cắt theo chỉ số bến. |
| `backend/src/journey-planner/road-routing.service.ts` | Gọi OSRM, timeout, cache bộ nhớ và giới hạn request. |
| `database/migrations/007-route-geometry.mjs` | Nâng cấp an toàn database có sẵn. |
| `database/scripts/build-route-geometry.mjs` | Công cụ bảo trì, lấy lại sáu geometry và cập nhật block SQL. Máy clone không cần chạy. Cần build backend trước. |
| `frontend/src/components/journey-planner/useRouteMap.js` | Tải trước, cache theo lần tìm, hủy phản hồi cũ và thử lại. |
| `frontend/src/components/journey-planner/JourneyMap.jsx` | Tile, marker, polyline, màu, chú thích và khung nhìn. |

## Xác thực ngày 04/10/2026

- Build và lint của cả backend/frontend đạt. Tổng 66 kiểm tra liên quan đạt: 24 unit backend, 19 API với MySQL, 23 frontend. Kiểm tra nét đứt chờ effect vẽ Leaflet hoàn thành, không chỉ chờ dòng chú thích xuất hiện.

- Nạp schema, seed, views vào database trống tạm thời bằng MySQL local, không gọi OSRM. Kiểm tra đủ sáu geometry khớp bến và chỉ số; dọn đúng database tạm. Số tọa độ: 02-DI 526, 02-VE 587, 26-DI 770, 26-VE 667, BRT01-DI 567, BRT01-VE 423.
- Kiểm tra API với MySQL thật và OSRM giả lập tại ranh giới HTTP: đọc DB, lưu lại geometry, dùng lại qua request khác, sửa tọa độ làm hết hiệu lực cache, OSRM lỗi trả đủ đường nối bến. Fixture được dọn và checksum dữ liệu gốc giữ nguyên.
- Đo 12 request mỗi tuyến qua Vite và phiên USER thật, từ Ngã Tư Sở tới Yên Nghĩa. 02-DI: trung vị 5,84 ms, lớn nhất 6,49 ms; BRT01-DI: trung vị 7,29 ms, lớn nhất 9,93 ms. Cả hai trả `source: database`. Đây là phép đo local tại thời điểm kiểm tra, không phải SLA cho máy/mạng khác.
- Unit/component kiểm tra cắt tại vòng lặp, cache sai/stale, lỗi ghi DB, đổi tuyến không gọi lại geometry, màu BRT và nét đứt fallback. Test Leaflet dùng mock, không chứng minh độ mượt của trình duyệt thật.
- Chưa thực hiện thao tác zoom/click trên trình duyệt thật: công cụ không có browser và mở IAB trả `Browser is not available`. Đã kiểm tra ảnh CARTO thực tế qua HTTP ở zoom 16 và 19 để phát hiện yêu cầu key.

Lệnh kiểm tra:

```powershell
# backend/
npm run build
npm run lint
npm test -- src/journey-planner
npm run test:e2e -- --run test/journey-planner.e2e-spec.ts
# frontend/
npm run build
npm run lint
npm test -- src/components/journey-planner/JourneyMap.test.jsx src/pages/JourneyPlannerPage.test.jsx src/services/journeyPlannerApi.test.js
```

Thử tay: tìm Bến xe Yên Nghĩa từ vị trí mặc định khi còn lịch trong ngày; chọn 02, quay lại rồi chọn BRT01 và lặp lại. Đường đổi màu và lấy từ bộ nhớ sau khi đã tải. Zoom 16 đến 20, kéo bản đồ, xem attribution Google Maps. Nền phụ thuộc mạng tới Google.

## Nguồn kỹ thuật

- [Google Map Tiles API chính thức](https://developers.google.com/maps/documentation/tile/overview)

- [CARTO basemaps, yêu cầu API key và URL raster](https://github.com/CartoDB/basemap-styles#1-web-raster-basemaps)
- [Leaflet TileLayer](https://leafletjs.com/reference.html#tilelayer)
- [OSRM API](https://project-osrm.org/docs/v5.24.0/api/)
- [Giới hạn máy chủ OSRM công cộng](https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server)
- [Chính sách tile OSM](https://operations.osmfoundation.org/policies/tiles/)
- [Bản quyền dữ liệu OSM, ODbL](https://www.openstreetmap.org/copyright)
