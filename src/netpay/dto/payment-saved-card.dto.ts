import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
} from 'class-validator';

export class PaymentSavedCardDto {
  @ApiProperty({
    description: 'Monto del pago',
    example: 500,
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  amount: number;

  @ApiProperty({
    description: 'Descripción del pago',
    example: 'Cargo de prueba',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Moneda (MXN, USD, etc.)',
    example: 'MXN',
    default: 'MXN',
  })
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiProperty({
    description: 'Reference ID de la tarjeta guardada (identifica la tarjeta)',
    example: '1222337263222',
  })
  @IsString()
  @IsNotEmpty()
  referenceId: string;

  @ApiPropertyOptional({
    description: 'Token de la tarjeta (opcional, puede requerirse junto con referenceID)',
    example: 'token_vzhdS4W-6IAE6KlfGLUXmDH8VIDMFs',
  })
  @IsString()
  @IsOptional()
  token?: string;

  @ApiPropertyOptional({
    description: 'Session ID (igual al deviceFingerPrint)',
    example: '1721779181755',
  })
  @IsString()
  @IsOptional()
  sessionId?: string;

  @ApiPropertyOptional({
    description: 'Device Fingerprint',
    example: '1721779181755',
  })
  @IsString()
  @IsOptional()
  deviceFingerPrint?: string;

  @ApiPropertyOptional({
    description: 'Guardar tarjeta para futuros pagos (string: "true" o "false")',
    example: 'false',
    default: 'false',
  })
  @IsString()
  @IsOptional()
  saveCard?: string;

  @ApiProperty({
    description: 'ID de la dirección guardada en la base de datos (se usará para construir el billing)',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  idDireccion: number;

  @ApiPropertyOptional({
    description: 'Información del dispositivo (para 3DS) - formato Netpay',
    example: {
      deviceChannel: 'Browser',
      httpBrowserColorDepth: '24',
      httpBrowserJavaEnabled: 'FALSE',
      httpBrowserJavaScriptEnabled: 'TRUE',
      httpBrowserLanguage: 'es',
      httpBrowserScreenHeight: '687',
      httpBrowserScreenWidth: '1718',
      httpBrowserTimeDifference: '360',
    },
  })
  @IsOptional()
  deviceInformation?: {
    deviceChannel?: string;
    httpBrowserColorDepth?: string;
    httpBrowserJavaEnabled?: string;
    httpBrowserJavaScriptEnabled?: string;
    httpBrowserLanguage?: string;
    httpBrowserScreenHeight?: string;
    httpBrowserScreenWidth?: string;
    httpBrowserTimeDifference?: string;
  };
}
