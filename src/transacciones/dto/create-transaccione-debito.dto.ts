import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
} from 'class-validator';

export class CreateTransaccioneDebitoDto {
  @ApiPropertyOptional({
    description: 'ID del viaje',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  idViaje: number;

  @ApiPropertyOptional({
    description: 'Latitud inicial del recorrido',
    example: 19.432608,
  })
  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 7 })
  latitud: number;

  @ApiPropertyOptional({
    description: 'Longitud inicial del recorrido',
    example: -99.133209,
  })
  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 7 })
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
    description: 'Número de serie del dispositivo',
  })
  @IsString()
  @IsNotEmpty()
  numeroSerieDispositivo: string;
}
