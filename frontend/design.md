# GoBus admin

Source: Figma bPqt1G05XZ7b4cTDiAc0Uo, frames 92:558 / 92:699 / 92:999 / 92:1148 / 92:1287.
Character: giao diện quản trị gọn, nền sáng, chữ tối, bảng trắng có đường viền, điểm nhấn xanh nhạt ở điều hướng.

## Build mandate

Header thương hiệu GoBus và user thật, sidebar 240px, content padding24, tiêu đề + CTA, bộ lọc, bảng và phân trang. Không mang thanh nhãn tên frame của Figma vào ứng dụng. Tên mẫu trong Figma được thay bằng MySQL. Dùng Geist; SVG icon tải từ Figma vào public/icons. Tokens trong src/styles.css.

## Components and states

Form dialog theo Figma, thêm mã bến bắt buộc thay ghi chú không tồn tại. Trạng thái xanh/xám theo yêu cầu user; nút ngừng/kích hoạt thay icon xóa. Loading/empty/error/success phải có chữ rõ ràng. Modal native dialog và trả focus khi đóng.

## Responsive behavior

Dưới 760px sidebar gọn ngang, header wrap, bảng thành card có label, bộ lọc xếp dọc và modal không tràn màn hình. Light theme theo Figma; chưa có yêu cầu dark theme.
