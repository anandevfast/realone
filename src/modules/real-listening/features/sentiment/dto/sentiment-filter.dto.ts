import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { FilterQueryDTO } from 'src/modules/real-listening/domain/filter-query.dto';

export class SentimentFilterDTO extends PartialType(FilterQueryDTO) {
  @IsOptional()
  @IsString()
  metric?: string;

  @IsOptional()
  @IsString()
  chartName?: string;

  @IsOptional()
  @IsBoolean()
  compareEnabled?: boolean;
}
