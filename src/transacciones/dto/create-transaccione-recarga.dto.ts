import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { EnumTipoTransaccion } from 'src/common/estatus.enum';

export class CreateTransaccioneRecargaDto {
  @IsEnum(EnumTipoTransaccion, {
    message: 'El tipo de transaccion a realizar: 1 (Recarga), 2 (Debito)',
  })
  @IsOptional()
  idTipoTransaccion?: EnumTipoTransaccion;

  @ApiProperty({
    example: 150.75,
    description: 'Monto de la transacción (2 decimales)',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsNotEmpty()
  monto: number;

  @ApiProperty({
    example: '(1) Efectivo, (2) Tarjetas de crédito, (3) Tarjetas de débito',
    description: 'El metodo de pago al realizar una recarga.',
  })
  @IsNumber()
  @IsInt()
  @IsNotEmpty()
  idMetodoPago: number;

  @ApiProperty({
    example: 19.432608,
    description: 'Latitud de la ubicación (opcional)',
    required: false,
  })
  @IsNumber({ maxDecimalPlaces: 7 })
  @IsOptional()
  latitudInicial?: number;

  @ApiProperty({
    example: -99.133209,
    description: 'Longitud de la ubicación (opcional)',
    required: false,
  })
  @IsNumber({ maxDecimalPlaces: 7 })
  @IsOptional()
  longitudInicial?: number;

  @ApiProperty({
    example: '2025-09-10T12:30:00Z',
    description: 'Fecha y hora de la transacción en formato ISO8601',
  })
  @IsDateString()
  fechaHoraInicial: string;

  @ApiProperty({
    example: 'MON-0001',
    description: 'Número de serie del monedero',
  })
  @IsString()
  @IsNotEmpty()
  numeroSerieMonedero: string;

  @ApiProperty({
    example: 'DISP-0001',
    description: 'Número de serie del dispositivo',
  })
  @IsString()
  @IsOptional()
  numeroSerieDispositivo?: string;
}
