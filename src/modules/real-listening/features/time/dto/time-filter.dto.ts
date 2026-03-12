import { IsOptional, IsString } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { FilterQueryDTO } from 'src/modules/real-listening/domain/filter-query.dto';

export class TimeFilterDTO extends PartialType(FilterQueryDTO) {
  @IsOptional()
  @IsString()
  chartName?: string;
}
