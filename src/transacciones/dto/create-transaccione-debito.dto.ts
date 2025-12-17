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
  @ApiPropertyOptional({
    description: 'ID del viaje',
    example: -99.133209,
  })
  @IsNotEmpty()
  @IsNumber()
  idViaje: number;

  @IsInt()
  @IsNumber()
  @IsOptional()
  idTipoTransaccion?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  monto?: number;

  @IsInt()
  @IsOptional()
  controlTransaccion?: EnumControlTransacciones = EnumControlTransacciones.PAGADO;

  @ApiPropertyOptional({
    description: 'Latitud inicial del recorrido',
    example: 19.432608,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  latitud?: number;

  @ApiPropertyOptional({
    description: 'Longitud inicial del recorrido',
    example: -99.133209,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  longitud?: number;

  @IsOptional()
  @IsDateString()
  fechaHora?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  distanciaInicialKm?: number;

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
