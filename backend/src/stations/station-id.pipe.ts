import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
@Injectable()
export class StationIdPipe implements PipeTransform<string, string> {
  transform(value: string) {
    if (
      !/^[1-9][0-9]{0,19}$/.test(value) ||
      BigInt(value) > 18446744073709551615n
    )
      throw new BadRequestException('ID bến xe không hợp lệ.');
    return value;
  }
}
