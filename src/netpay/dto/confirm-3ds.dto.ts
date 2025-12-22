import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class Confirm3DSDto {
  @ApiProperty({
    description: 'Transaction ID de la transacción 3DS',
    example: 'txn_1234567890',
  })
  @IsString()
  @IsNotEmpty()
  transactionId: string;

  @ApiProperty({
    description: 'Reference ID del checkout',
    example: 'ref_1234567890',
  })
  @IsString()
  @IsNotEmpty()
  referenceId: string;
}
