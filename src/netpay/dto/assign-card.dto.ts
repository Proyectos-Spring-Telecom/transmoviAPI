import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class AssignCardDto {
  @ApiProperty({
    description: 'ID del cliente (clientId numérico)',
    example: '24665',
  })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({
    description: 'Token de la tarjeta a asignar (generado por NetpayJS en frontend)',
    example: 'tok_test_1234567890',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiPropertyOptional({
    description: 'Indica si es una pre-autorización',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value === 'true';
    }
    return Boolean(value);
  })
  preAuth?: boolean = false;

  @ApiPropertyOptional({
    description: 'CVV2 de la tarjeta (3 o 4 dígitos)',
    example: '123',
  })
  @IsOptional()
  @IsString()
  cvv2?: string;
}
