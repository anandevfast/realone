import { IsBoolean, IsOptional, IsString } from 'class-validator';
import {  FilterRequiredDTO } from 'src/modules/real-listening/domain/filter-query.dto';

export class SentimentFilterDTO extends FilterRequiredDTO {
  @IsOptional()
  @IsString()
  chartName?: string;

  @IsOptional()
  @IsBoolean()
  compareEnabled?: boolean;
}
