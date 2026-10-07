import { IsOptional, IsString, MaxLength } from 'class-validator';
import { JourneyDetailDto } from './journey-detail.dto.js';

export class StartTrackingDto extends JourneyDetailDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  origin_label?: string;
}
