import { IsString, Matches, MaxLength } from 'class-validator';
import { SearchJourneysDto } from './search-journeys.dto.js';

export class JourneyDetailDto extends SearchJourneysDto {
  @IsString()
  @Matches(/^[1-9]\d*$/)
  @MaxLength(20)
  route_id!: string;
}
