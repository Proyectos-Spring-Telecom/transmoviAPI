import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { EnumTipoTransaccion, EnumMetodoPago } from 'src/common/estatus.enum';

// Helper function para transformar valores de FormData a números decimales
const toNumberDecimal = ({ value }: { value: any }): number | undefined => {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return isNaN(num) ? undefined : num;
  }
  return undefined;
};

export class CreateTransaccioneRecargaDto {
  @ApiProperty({
    example: 1,
    description: 'Tipo de transacción: 1 (Recarga), 2 (Debito), 3 (Rechazo)',
    required: false,
  })
  @IsEnum(EnumTipoTransaccion, {
    message: 'El tipo de transaccion debe ser: 1 (Recarga), 2 (Debito), 3 (Rechazo)',
  })
  @IsOptional()
  @Transform(toNumberDecimal)
  idTipoTransaccion?: EnumTipoTransaccion;

  @ApiProperty({
    example: 150.75,
    description: 'Monto de la transacción (2 decimales)',
  })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'monto must be a number conforming to the specified constraints' })
  @IsNotEmpty()
  @Transform(toNumberDecimal)
  monto: number;

  @ApiProperty({
    example: 19.432608,
    description: 'Latitud inicial de la ubicación (opcional)',
    required: false,
  })
  @IsNumber({ maxDecimalPlaces: 7 })
  @IsOptional()
  @Transform(toNumberDecimal)
  latitudInicial?: number | null;

  @ApiProperty({
    example: -99.133209,
    description: 'Longitud inicial de la ubicación (opcional)',
    required: false,
  })
  @IsNumber({ maxDecimalPlaces: 7 })
  @IsOptional()
  @Transform(toNumberDecimal)
  longitudInicial?: number | null;

  @ApiProperty({
    example: 'MON-0001',
    description: 'Número de serie del monedero',
  })
  @IsString()
  @IsNotEmpty()
  numeroSerieMonedero: string;

  @ApiProperty({
    example: 'DISP-0001',
    description: 'Número de serie del validador (también acepta numeroSerieDispositivo)',
    required: false,
  })
  @IsString()
  @IsOptional()
  numeroSerieValidador?: string | null;

  @ApiProperty({
    example: 1,
    description: 'Método de pago: 1 (Efectivo), 2 (Transferencia), 3 (Tarjeta de crédito), 4 (Tarjeta de débito)',
    enum: EnumMetodoPago,
    required: true,
  })
  @IsEnum(EnumMetodoPago, {
    message: 'El método de pago debe ser: 1 (Efectivo), 2 (Transferencia), 3 (Tarjeta de crédito), 4 (Tarjeta de débito)',
  })
  @IsNotEmpty({ message: 'El método de pago es obligatorio' })
  @Transform(toNumberDecimal)
  idMetodoPago: EnumMetodoPago;

  @ApiPropertyOptional({
    example: 'token_vzhdS4W-6IAE6KlfGLUXmDH8VIDMFs',
    description: 'Token de la tarjeta de Netpay (obligatorio si método de pago es Tarjeta)',
  })
  @ValidateIf((o) => o.idMetodoPago === EnumMetodoPago.TARJETA_CREDITO || o.idMetodoPago === EnumMetodoPago.TARJETA_DEBITO)
  @IsString({ message: 'El tokenCardNetPay debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El tokenCardNetPay es obligatorio cuando el método de pago es Tarjeta' })
  tokenCardNetPay?: string;

  @ApiPropertyOptional({
    example: 'trans_1234567890',
    description: 'Transaction Token ID de Netpay (obligatorio si método de pago es Tarjeta)',
  })
  @ValidateIf((o) => o.idMetodoPago === EnumMetodoPago.TARJETA_CREDITO || o.idMetodoPago === EnumMetodoPago.TARJETA_DEBITO)
  @IsString({ message: 'El transactionTokenIdNetPay debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El transactionTokenIdNetPay es obligatorio cuando el método de pago es Tarjeta' })
  transactionTokenIdNetPay?: string;

  @ApiPropertyOptional({
    example: '1222337263222',
    description: 'Reference ID de Netpay (obligatorio si método de pago es Tarjeta)',
  })
  @ValidateIf((o) => o.idMetodoPago === EnumMetodoPago.TARJETA_CREDITO || o.idMetodoPago === EnumMetodoPago.TARJETA_DEBITO)
  @IsString({ message: 'El referenceIdNetPay debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El referenceIdNetPay es obligatorio cuando el método de pago es Tarjeta' })
  referenceIdNetPay?: string;

}
