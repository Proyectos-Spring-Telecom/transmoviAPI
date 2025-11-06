import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsIn,
  Min,
  IsOptional,
} from 'class-validator';

export class CreateTarifaDto {
  @ApiProperty({
    example: 35.5,
    description: 'Tarifa base en pesos',
  })
  @IsNotEmpty({ message: 'La tarifa base es obligatoria' })
  @IsNumber({}, { message: 'La tarifa base debe ser numérica' })
  @Min(0, { message: 'La tarifa base no puede ser negativa' })
  tarifaBase: number;

  @ApiProperty({
    example: 5.0,
    description: 'Distancia base en kilómetros',
  })
  @IsOptional({ message: 'La distancia base no es obligatoria' })
  @IsNumber({}, { message: 'La distancia base debe ser numérica' })
  @Min(0, { message: 'La distancia base no puede ser negativa' })
  distanciaBaseKm: number;

  @ApiProperty({
    example: 500,
    description:
      'Número de metros después de los cuales se aplica el costo adicional',
  })
  @IsOptional({ message: 'El incremento en metros es no obligatorio' })
  @IsInt({ message: 'El incremento debe ser un número entero' })
  @Min(1, { message: 'El incremento debe ser mayor a 0' })
  incrementoCadaMetros: number;

  @ApiProperty({
    example: 2.5,
    description: 'Costo adicional aplicado cada X metros',
  })
  @IsOptional({ message: 'El costo adicional es obligatorio' })
  @IsNumber({}, { message: 'El costo adicional debe ser numérico' })
  @Min(0, { message: 'El costo adicional no puede ser negativo' })
  costoAdicional: number;

  @ApiProperty({
    example: `0 ó 1`,
    description:
      'Tipo de tarifa que vamos a manejar si es incrementable o plana',
  })
  @IsNotEmpty({ message: 'El tipo de tarifa es obligatorio' })
  @IsInt({ message: 'El tipoTarifa debe ser un número entero' })
  @IsIn([0, 1], { message: 'Solo puede ser 0 ó 1' })
  tipoTarifa: number;

  @ApiProperty({
    example: 1,
    description: 'Estatus de la tarifa (0 = inactivo, 1 = activo)',
    default: 1,
  })
  @IsInt({ message: 'El estatus debe ser un número entero' })
  @IsIn([0, 1], { message: 'El estatus solo puede ser 0 o 1' })
  estatus: number = 1;

  @ApiProperty({
    example: 2001,
    description: 'Id del derrotero asociado a la tarifa',
  })
  @IsNotEmpty({ message: 'El IdDerrotero es obligatorio' })
  @IsInt({ message: 'El IdDerrotero debe ser un número entero' })
  idDerrotero: number;
}
