import { IsDefined, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { OmitType, PartialType } from '@nestjs/swagger';
import { FilterQueryDTO } from 'src/modules/real-listening/domain/filter-query.dto';

export class MessageFilterDTO extends PartialType(FilterQueryDTO) {
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


