import { IsOptional, IsString } from 'class-validator';
import { FilterRequiredDTO } from 'src/modules/real-listening/domain/filter-query.dto';

export class TimeFilterDTO extends FilterRequiredDTO {
  @IsOptional()
  @IsString()
  chartName?: string;
}
