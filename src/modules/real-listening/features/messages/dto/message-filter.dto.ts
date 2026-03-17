import { IsDefined, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { FilterRequiredDTO } from 'src/modules/real-listening/domain/filter-query.dto';

export class MessageFilterDTO extends FilterRequiredDTO {
  @IsDefined()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsDefined()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  pagePer?: number = 100;
}
