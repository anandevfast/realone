import { PartialType } from '@nestjs/swagger';
import { FilterQueryDTO } from 'src/modules/real-listening/domain/filter-query.dto';

export class LocationFilterDTO extends PartialType(FilterQueryDTO) {}
