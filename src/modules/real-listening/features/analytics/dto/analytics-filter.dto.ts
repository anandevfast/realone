import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { OmitType, PartialType } from '@nestjs/swagger';
import { FilterQueryDTO } from 'src/modules/real-listening/domain/filter-query.dto';

export class AnalyticsFilterDTO extends PartialType(
  OmitType(FilterQueryDTO, ['startDate', 'endDate'] as const),
) {
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @IsNotEmpty()
  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString()
  chartName?: string;

  @IsOptional()
  @IsBoolean()
  compareEnabled?: boolean;
}
