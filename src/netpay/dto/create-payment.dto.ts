import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
} from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({
    description: 'Token de la tarjeta',
    example: 'tok_test_1234567890',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    description: 'Monto del pago',
    example: 100.50,
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  amount: number;

  @ApiProperty({
    description: 'Moneda (MXN, USD, etc.)',
    example: 'MXN',
    default: 'MXN',
  })
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiProperty({
    description: 'Descripción del pago',
    example: 'Pago de servicio de transporte',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({
    description: 'ID del cliente (si se usa token guardado)',
    example: 'cus_1234567890',
  })
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'ID de la tarjeta guardada (si se usa token guardado)',
    example: 'card_1234567890',
  })
  @IsString()
  @IsOptional()
  cardId?: string;

  @ApiPropertyOptional({
    description: 'Guardar tarjeta para futuros pagos',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  saveCard?: boolean;

  @ApiPropertyOptional({
    description: 'Reference ID para checkout',
    example: 'ref_1234567890',
  })
  @IsString()
  @IsOptional()
  referenceId?: string;

  @ApiPropertyOptional({
    description: 'Información del dispositivo (para 3DS)',
    example: {
      deviceFingerprint: 'abc123',
      userAgent: 'Mozilla/5.0...',
    },
  })
  @IsOptional()
  deviceInformation?: any;
}
