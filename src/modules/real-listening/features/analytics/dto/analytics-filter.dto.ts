import { IsBoolean, IsDefined, IsOptional, IsString } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { FilterQueryDTO } from 'src/modules/real-listening/domain/filter-query.dto';

export class AnalyticsFilterDTO extends PartialType(FilterQueryDTO) {
  @IsOptional()
  @IsString()
  metric?: string;

  @IsOptional()
  @IsString()
  chartName?: string;

  @IsOptional()
  @IsBoolean()
  compareEnabled?: boolean;

  /** When true, response is only { chartMeta, compareMeta } without full chart data. Required. */
  @IsDefined()
  @IsBoolean()
  metaOnly: boolean;
}
