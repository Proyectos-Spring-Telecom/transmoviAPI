import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateTransaccioneDebitoDto {
  @ApiProperty({
    example: 19.432608,
    description: 'Latitud de la ubicación',
  })
  @IsNumber({ maxDecimalPlaces: 7 })
  @IsNotEmpty()
  latitud: number;

  @ApiProperty({
    example: -99.133209,
    description: 'Longitud de la ubicación',
  })
  @IsNumber({ maxDecimalPlaces: 7 })
  @IsNotEmpty()
  longitud: number;

  @ApiProperty({
    example: 'MON-0001',
    description: 'Número de serie del monedero',
  })
  @IsString()
  @IsNotEmpty()
  numeroSerieMonedero: string;

  @ApiProperty({
    example: 'DISP-0001',
    description: 'Número de serie del validador',
  })
  @IsString()
  @IsNotEmpty()
  numeroSerieValidador: string;

  @ApiProperty({
    example: 1,
    description: 'ID del viaje asociado',
  })
  @IsInt()
  @IsNotEmpty()
  idViaje: number;

  @ApiProperty({
    example: false,
    description: 'Indica si la transacción fue realizada mediante QR',
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  esQR?: boolean = false;
}
