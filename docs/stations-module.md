# Module quản lý bến xe GoBus

## Đã triển khai

- Danh sách từ MySQL, phân trang 10/20/50 dòng, tìm mã bến/tên/địa chỉ và lọc hoạt động.
- Thêm và sửa mã, tên, địa chỉ. Kiểm tra bắt buộc, trim, giới hạn schema và mã trùng.
- Xác nhận ngừng/kích hoạt lại. Dấu chấm bên trái và chữ xanh hoặc xám theo `is_active`.
- API chỉ cho ADMIN; đăng nhập bằng bảng `users`, kiểm tra mật khẩu bcrypt hiện có.
- Giao diện tiếng Việt dựa trên Figma, bảng ở desktop và thẻ ở điện thoại; có tải, rỗng, lỗi, thử lại và thông báo thành công.

## Khởi động tại máy hiện tại

Chạy ở thư mục gốc:

```bash
docker compose up -d
```

Mở hai terminal riêng:

```bash
cd backend
npm install
npm run start:dev
```

```bash
cd frontend
npm install
npm run dev
```

Truy cập **http://localhost:5173/stations**. Backend dùng cổng **3001** vì 3000 đang được container khác dùng. Vite đọc `PORT` từ root `.env` để proxy `/api` sang backend; chỉ proxy config dùng các biến này, không đưa bí mật DB vào trình duyệt.

Tài khoản mẫu hiện có được mô tả trong [database/README.md](../database/README.md#tài-khoản-demo). Dùng tài khoản ADMIN để quản lý; USER đăng nhập được nhưng bị chặn khỏi trang quản trị. Không có mật khẩu mặc định trong mã ứng dụng.

Root `.env` đã có cấu hình session và test cho máy hiện tại. Máy mới cần điền `SESSION_SECRET` ngẫu nhiên ít nhất 32 ký tự, `WEB_ORIGIN=http://localhost:5173`, `PORT=3001` và thông tin DB đúng. Không chép đè `.env` đang có. Có thể tạo secret bằng:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Nếu đổi origin hoặc port, khởi động lại cả backend và Vite. Cookie phiên chỉ gửi trong cùng site; dùng nhất quán `localhost` khi thử bằng trình duyệt.

## Database thực tế và migration

Tại thời điểm triển khai, `.env` trỏ tới **gobus_hanoi_student** ở cổng 3309, có 32 bến, 10 tuyến, 43 điểm dừng, 60 lịch trình, 5 vé, 3 user và 10 xe. Database này khác bản ERD `gobus_hanoi_erd` trong `01-schema.sql`.

Đã bổ sung đúng ba cột bị thiếu:

| Bảng/cột | Giá trị mặc định cho hàng cũ |
|---|---|
| stations.is_active | true |
| users.is_active | true |
| routes.status | ACTIVE |

Migration ở [004-stations-module.mjs](../database/migrations/004-stations-module.mjs). Chạy từ gốc khi một database hiện có chưa có các cột này:

```bash
node database/migrations/004-stations-module.mjs
```

Script đọc database đã chọn trong `.env`, sao lưu schema và toàn bộ hàng vào `.local/backups/` với quyền file 0600, chỉ thêm cột còn thiếu, đối chiếu SHA256 các cột gốc trước/sau. Có thể chạy lại. Bản backup JSON chứa dữ liệu riêng tư và hash mật khẩu, thư mục đã được gitignore.

Không chạy lại seed, không đổi DB_NAME, không xóa volume. `synchronize: false` được giữ nguyên. Những khác biệt ngoài phạm vi module như `vehicles` và `fares` không bị thay đổi.

## Quy tắc khi bến đang thuộc tuyến

Nếu có tuyến `ACTIVE` sử dụng bến làm đầu tuyến, cuối tuyến hoặc điểm dừng trung gian, API trả **409** cùng danh sách mã/tên tuyến. Giao diện giữ hộp thoại và hiển thị danh sách đó.

Cần điều chỉnh hoặc ngừng các tuyến liên quan theo nghiệp vụ trước khi ngừng bến. Module này không tự ngừng tuyến và không xóa vé hay lịch sử. Khi bổ sung API quản lý tuyến, mọi thao tác thêm điểm dừng hoặc kích hoạt tuyến phải khóa hàng station trong transaction và kiểm tra `is_active`, dùng cùng quy ước với stations service. Việc sửa SQL trực tiếp không được bảo vệ bởi quy tắc API.

## API

Các URL bên dưới là backend. Frontend gọi với tiền tố `/api` qua Vite. Mutation cần header `X-GoBus-Request: 1`, JSON và cookie phiên. Browser Origin nếu có phải bằng WEB_ORIGIN.

| Method | URL | Nội dung |
|---|---|---|
| POST | /auth/login | `{email,password}`; trả user công khai, set cookie HttpOnly |
| GET | /auth/me | User hiện tại, 401 nếu hết phiên |
| POST | /auth/logout | Hủy phiên ngay |
| GET | /stations | `page`, `limit` (1–100), `search`, `is_active` (true/false hoặc bỏ qua) |
| POST | /stations | `{code,name,address}`, mặc định active |
| PATCH | /stations/:id | Đủ `{code,name,address}`, giữ trạng thái |
| PATCH | /stations/:id/status | `{is_active: boolean}` |

Danh sách trả `{items,total,page,limit,totalPages}`. ID được giữ dạng chuỗi để không mất chính xác bigint. Mã tối đa 20, tên 160, địa chỉ 255 ký tự. Trường thừa bị từ chối. Lỗi dùng 400 cho dữ liệu sai, 401 chưa đăng nhập, 403 thiếu quyền, 404 không có bến, 409 mã trùng hoặc tuyến đang dùng, 429 khi đăng nhập sai nhiều lần.

## Cấu trúc để học theo

| File/thư mục | Vai trò |
|---|---|
| frontend/src/main.jsx, App.jsx | Gắn React vào root; kiểm tra phiên, đăng nhập và khung quản trị |
| frontend/src/pages/StationsPage.jsx | Quản lý bộ lọc, phân trang, tải lại danh sách, mở biểu mẫu |
| frontend/src/components/stations/ | Bảng, nhãn trạng thái, form và dialog xác nhận |
| frontend/src/services/stationsApi.js | Gọi HTTP và chuẩn hóa lỗi |
| frontend/src/styles.css, design.md | CSS và cách chuyển Figma sang UI |
| backend/src/setup-app.ts | Session, CORS, chống CSRF, giới hạn login, ValidationPipe |
| backend/src/auth/ | Entity users, xác thực, kiểm tra ADMIN |
| backend/src/stations/ | Controller nhận request; DTO kiểm tra; service xử lý; entity ánh xạ MySQL |
| database/migrations/004-stations-module.mjs | Thêm các cột còn thiếu, giữ dữ liệu |
| docs/specs/0001-stations-management.md | Thiết kế và tiêu chí nghiệm thu |

Ví dụ khi bấm Lưu: `StationForm` → `StationsPage.save` → `stationsApi` → Vite proxy → `AdminGuard` → DTO validation → controller → service → TypeORM/MySQL. Thành công thì đóng modal, thông báo và gọi lại API danh sách. Lỗi thì giữ nội dung form để sửa.

Thiết kế lấy từ Figma file `bPqt1G05XZ7b4cTDiAc0Uo`, màn danh sách `92:558`, thêm `92:699`; các màn sửa/xác nhận cùng nhóm. Bổ sung mã bến, bộ lọc, đổi trạng thái theo yêu cầu mới. Bỏ ghi chú vì schema không có. Các mục sidebar của module khác chưa có chức năng.

## Kiểm thử

Từ `backend/`:

```bash
npm run lint
npm run test
npm run test:e2e
```

`test:e2e` tự build rồi chạy API thật trên cổng 3101 với MySQL đã cấu hình. Cần root `.env` có `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD`, `TEST_USER_EMAIL`, `TEST_USER_PASSWORD` cho các tài khoản local hiện có. Suite tạo bến có mã ngẫu nhiên, dọn đúng dữ liệu test, so sánh checksum các hàng gốc. Không chạy suite này trên production. Auto increment có thể tăng sau test dù hàng test đã được dọn.

Từ `frontend/`:

```bash
npm run build
npm run lint
npm test
```

Frontend dùng Vitest, Testing Library và jsdom cho tải/rỗng/lỗi, bộ lọc, form và xác nhận. Luồng trên Chrome và bố cục mobile được kiểm chứng riêng; xem [kết quả kiểm tra](stations-verification.md).

## Giới hạn hiện tại

Đăng nhập đủ để module hoạt động local một backend instance. Session hiện nằm trong bộ nhớ, hết sau 8 giờ hoặc khi restart backend. Trước triển khai production cần session store dùng chung/bền vững, HTTPS và cấu hình reverse proxy tin cậy. Chưa có đăng ký, quên mật khẩu, màn quản lý tài khoản hay quản lý tuyến.

Máy hiện tại dùng Node 25.9.0; các kiểm tra đã chạy được nhưng npm có cảnh báo engine từ Nest CLI/Angular devkit. Có thể chuyển sang phiên bản Node đáp ứng engines đã ghi trong package, ví dụ Node 24.15 trở lên thuộc nhánh 24.

## Tích hợp quản lý tuyến

Module tuyến hiện đã triển khai tại `/routes`, dùng chung session, request protection và shell quản trị. Xem [hướng dẫn tuyến và điểm dừng](routes-module.md). Tạo/sửa/kích hoạt tuyến khóa các bến trước route để phối hợp với kiểm tra ngừng bến hiện có. Các giới hạn chưa có module tuyến trong phần mô tả ban đầu ở trên đã được thay thế bởi phần tích hợp này.
