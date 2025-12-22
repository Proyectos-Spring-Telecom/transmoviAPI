import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AssignCardDto {
  @ApiProperty({
    description: 'ID del cliente',
    example: 'cus_1234567890',
  })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({
    description: 'Token de la tarjeta a asignar',
    example: 'tok_test_1234567890',
  })
  @IsString()
  @IsNotEmpty()
  token: string;
}
