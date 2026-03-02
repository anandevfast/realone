import { ApiProperty } from '@nestjs/swagger';

export class ApiSuccessResponse<T> {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty()
  data: T;
}

export class ApiErrorResponse {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({ example: 'BAD_REQUEST' })
  error: string;

  @ApiProperty({ example: 'Invalid input' })
  message: string;
}
