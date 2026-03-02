import {
  // OmitType,
  PartialType,
  // PickType,
} from '@nestjs/swagger';
import { FilterQueryDTO } from 'src/modules/real-listening/domain/filter-query.dto';

export class MessageFilterDTO extends PartialType(FilterQueryDTO) {} // ถ้า PartialType ทุก field จะเป็น Optional หมด

// export class MessageFilterDTO extends FilterQueryDTO {}

// export class MessageFilterDTO extends PartialType(
//   PickType(FilterQueryDTO, ['channel', 'sentiment'] as const),
// ) {}

// export class MessageFilterDTO extends OmitType(FilterQueryDTO, [
//   'detectedBy',
//   'language',
// ] as const) {}

// อยากเลือกมาแค่บางตัว -> ใช้ PickType

// อยากตัดออกแค่บางตัว -> ใช้ OmitType

// อยากทำเป็น Optional ทั้งยวง -> ครอบด้วย PartialType(...)

// อยากตั้ง Optional แยกรายตัว -> สืบทอดมาแล้วเขียน Override ตัวแปรนั้นซ้ำใน Class ลูก
