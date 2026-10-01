# GoBus admin

## Passenger homepage

Figma 102:3 in the same GoBus file is implemented at `/user/home`; its section is 102:2 on page 14:2. Keep its Manrope font, local assets in `public/home/`, and scoped `pages/user-home.css` separate from admin styles. Preserve the original hero, value cards and footer. Replace sample route names with API data and auth actions with the real account. Desktop is the design source; mobile is adapted responsively. Deliberate differences and screenshots: `../docs/user-home-module.md`.

Source: Figma bPqt1G05XZ7b4cTDiAc0Uo, frames 92:558 / 92:699 / 92:999 / 92:1148 / 92:1287.
Character: giao diện quản trị gọn, nền sáng, chữ tối, bảng trắng có đường viền, điểm nhấn xanh nhạt ở điều hướng.

## Build mandate

Header thương hiệu GoBus và user thật, sidebar 240px, content padding24, tiêu đề + CTA, bộ lọc, bảng và phân trang. Không mang thanh nhãn tên frame của Figma vào ứng dụng. Tên mẫu trong Figma được thay bằng MySQL. Dùng Geist; SVG icon tải từ Figma vào public/icons. Tokens trong src/styles.css.

## Components and states

Form dialog theo Figma, thêm mã bến bắt buộc thay ghi chú không tồn tại. Trạng thái xanh/xám theo yêu cầu user; nút ngừng/kích hoạt thay icon xóa. Loading/empty/error/success phải có chữ rõ ràng. Modal native dialog và trả focus khi đóng.

## Responsive behavior

Dưới 760px sidebar gọn ngang, header wrap, bảng thành card có label, bộ lọc xếp dọc và modal không tràn màn hình. Light theme theo Figma; chưa có yêu cầu dark theme.

## Route administration

Tuyến dùng Figma frames 84:7, 84:126, 84:234 và 84:346 trong cùng file. Đã đọc design context và screenshot cho danh sách, thêm, sửa có lỗi và dialog bị chặn. Giữ shell của stations để thống nhất quản trị; vùng nội dung tuyến padding 32px, card 28px và CTA xanh. Chi tiết tuyến chưa có frame riêng, dùng card và hành trình có thứ tự.

Form chọn bến thật, thêm/bỏ/lên/xuống và nhập phút/km cộng dồn. Thay tần suất không có trong schema bằng khoảng cách, thay xóa bằng ngừng/kích hoạt theo nghiệp vụ. Màn nhỏ xếp form một cột và bảng thành thẻ; tên/mã dài được xuống dòng. NULL phút cũ hiển thị rõ thay vì tự suy đoán. Quy tắc và khác biệt chi tiết ở `../docs/specs/0002-routes-stops-management.md`.

## Schedule administration

Figma frames 89:2, 89:209 and 89:436 in the same file define list, right panel form and validation state. Keep shared Geist/sidebar, content padding24, filter gap16, card radius12 and panel480/radius16. Pencil and alert SVG assets are in public/icons/schedules.

Use actual schedule ID and vehicle selection, read only vehicle capacity, separate ticket count, explicit Vietnam time and arrival derived from route stop minutes. Omit driver/license availability with no backing data. Cancel replaces deletion and explains booking restrictions. Detail uses the shared ordered timeline; mobile stacks filters and table cells without horizontal overflow. See spec 0003 for these deliberate data and business adaptations.
