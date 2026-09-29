import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
export class LoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  @MaxLength(160, { message: 'Email tối đa 160 ký tự.' })
  email: string;
  @IsString({ message: 'Mật khẩu phải là chuỗi.' })
  @MinLength(1, { message: 'Vui lòng nhập mật khẩu.' })
  @MaxLength(72, { message: 'Mật khẩu tối đa 72 ký tự.' })
  password: string;
}
