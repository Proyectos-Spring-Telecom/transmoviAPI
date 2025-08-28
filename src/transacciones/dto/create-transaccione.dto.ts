import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateTransaccioneDto {
  @Type(() => Number)
  @IsInt({ message: 'IdMonedero debe ser un número entero' })
  @Min(1, { message: 'IdMonedero debe ser mayor a 0' })
  @ApiProperty({
    description: 'ID del monedero',
    example: '123',
  })
  IdMonedero: number;

  @IsIn(['Recarga', 'Debito'], {
    message: 'Tipo de transacción inválido',
  })
  @ApiProperty({
    description: 'Tipo de transaccion',
    example: 'Recarga/debito',
  })
  TipoTransaccion: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }) // máximo 2 decimales
  @Min(0) // opcional: evita negativos
  @Max(99999999.99) // máximo permitido por DECIMAL(10,2)
  @ApiProperty({
    description: 'Monto de dinero a abonar',
    example: '23.5',
  })
  Monto: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-999.9999999)
  @Max(999.9999999)
  @ApiProperty({
    description: 'Latitud',
    example: '123.9876543',
  })
  Latitud: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-999.9999999)
  @Max(999.9999999)
  @IsOptional()
  @ApiProperty({
    description: 'Longitud',
    example: '123.9876543',
  })
  Longitud?: number;

  @Type(() => Date)
  @IsDateString() // valida que sea una fecha en formato ISO 8601
  @ApiProperty({
    description: 'Fecha y hora de la transaccion',
    example: '1988-08-08 08:00:00',
  })
  FechaHora: Date;

  @IsInt({ message: 'estatus debe ser un número entero' })
  @IsIn([0, 1], { message: 'Solo puede ser 0 ó 1' })
  @IsOptional()
  @ApiProperty({
    description: 'Estatus del operador solo puede ser 1 ó 0',
    example: '1',
  })
  Estatus?: number = 1;
}
