import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { EnumControlTransacciones, EnumTipoTransaccion } from 'src/common/estatus.enum';

export class CreateTransaccioneDebitoDto {
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
    description: 'Control de la transacción',
    example: `${0} (pagado), ${1} (abierto)`,
    required: false,
  })
  @IsInt()
  @IsOptional()
  controlTransaccion?: EnumControlTransacciones = EnumControlTransacciones.PAGADO;

  @ApiPropertyOptional({
    description: 'Latitud inicial del recorrido',
    example: 19.432608,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  latitudInicial?: number;

  @ApiPropertyOptional({
    description: 'Longitud inicial del recorrido',
    example: -99.133209,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  longitudInicial?: number;

  @ApiPropertyOptional({
    description: 'Fecha y hora de inicio',
    example: '2025-01-15T14:30:00',
  })
  @IsOptional()
  @IsDateString()
  fechaHoraInicio?: string;

  @ApiPropertyOptional({
    description: 'Distancia inicial en kilómetros',
    example: 0.5,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  distanciaInicialKm?: number;

  @ApiProperty({
    example: 19.432608,
    description: 'Latitud de la ubicación (opcional)',
    required: false,
  })
  @IsNumber({ maxDecimalPlaces: 7 })
  @IsOptional()
  latitudFinal?: number;

  @ApiProperty({
    example: -99.133209,
    description: 'Longitud de la ubicación (opcional)',
    required: false,
  })
  @IsNumber({ maxDecimalPlaces: 7 })
  @IsOptional()
  longitudFinal?: number;

  @ApiProperty({
    example: '2025-09-10T12:30:00Z',
    description: 'Fecha y hora de la transacción en formato ISO8601',
  })
  @IsDateString()
  @IsOptional()
  fechaHoraFinal: string;

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
  @IsNotEmpty()
  numeroSerieDispositivo: string;
}
