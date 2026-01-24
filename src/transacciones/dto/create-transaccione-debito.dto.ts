import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
  Min,
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

  @ApiPropertyOptional({
    example: false,
    description: 'Indica si se deben crear múltiples débitos',
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  esMultiple?: boolean = false;

  @ApiPropertyOptional({
    example: 3,
    description: 'Cantidad de pasajes a registrar. Solo tiene valor si esMultiple es true',
    required: false,
  })
  @ValidateIf((o) => o.esMultiple === true)
  @IsInt({ message: 'cantidadPasajes debe ser un número entero' })
  @Min(1, { message: 'cantidadPasajes debe ser mayor a 0' })
  @IsNotEmpty({ message: 'cantidadPasajes es obligatorio cuando esMultiple es true' })
  cantidadPasajes?: number;
}
