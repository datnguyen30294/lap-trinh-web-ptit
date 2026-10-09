import { Transform } from 'class-transformer';
import {
  Equals,
  IsByteLength,
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Họ tên phải là chuỗi.' })
  @MinLength(1, { message: 'Vui lòng nhập họ tên.' })
  @MaxLength(120, { message: 'Họ tên tối đa 120 ký tự.' })
  full_name: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  @MaxLength(160, { message: 'Email tối đa 160 ký tự.' })
  email: string;

  @IsString({ message: 'Mật khẩu phải là chuỗi.' })
  @MinLength(8, { message: 'Mật khẩu cần ít nhất 8 ký tự.' })
  @IsByteLength(0, 72, {
    message: 'Mật khẩu tối đa 72 byte UTF-8. Hãy dùng mật khẩu ngắn hơn.',
  })
  password: string;

  @IsString({ message: 'Vui lòng xác nhận mật khẩu.' })
  @IsByteLength(0, 72, { message: 'Xác nhận mật khẩu quá dài.' })
  confirm_password: string;

  @Equals(true, {
    message: 'Vui lòng đồng ý với điều khoản sử dụng và chính sách bảo mật.',
  })
  terms_accepted: boolean;
}
