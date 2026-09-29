import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsString, MaxLength } from 'class-validator';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class StationDto {
  @Transform(trim)
  @IsString({ message: 'Mã bến phải là chuỗi.' })
  @IsNotEmpty({ message: 'Vui lòng nhập mã bến.' })
  @MaxLength(20, { message: 'Mã bến tối đa 20 ký tự.' })
  code: string;
  @Transform(trim)
  @IsString({ message: 'Tên bến phải là chuỗi.' })
  @IsNotEmpty({ message: 'Vui lòng nhập tên bến.' })
  @MaxLength(160, { message: 'Tên bến tối đa 160 ký tự.' })
  name: string;
  @Transform(trim)
  @IsString({ message: 'Địa chỉ phải là chuỗi.' })
  @IsNotEmpty({ message: 'Vui lòng nhập địa chỉ.' })
  @MaxLength(255, { message: 'Địa chỉ tối đa 255 ký tự.' })
  address: string;
}
export class StationStatusDto {
  @IsBoolean({ message: 'Trạng thái phải là true hoặc false.' })
  is_active: boolean;
}
