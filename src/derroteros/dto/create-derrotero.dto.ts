import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsNumber,
  IsOptional,
  IsObject,
  IsPositive,
  Min,
  Max,
  IsInt,
  IsIn,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class PuntoDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;
}

export class CreateDerroteroDto {
  // ========================================
  // 🔹 CAMPOS DEL DERROTERO
  // ========================================
  @ApiProperty({
    description: 'Variable para crear derrotero de regreso (0 = No generar, 1 = Generar)',
    example: 0,
  })
  @IsNumber()
  @IsIn([0, 1], { message: 'Solo puede ser 0 ó 1' })
  @IsNotEmpty()
  crearDerroteroRegreso: number;

  @ApiProperty({
    description: 'Nombre del derrotero',
    example: 'Derrotero Centro-Norte',
    maxLength: 100,
    type: String,
  })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @MaxLength(100, { message: 'El nombre no puede exceder los 100 caracteres' })
  nombre: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject({ message: 'El punto de inicio debe ser un objeto JSON válido' })
  puntoInicio?: object;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject({ message: 'El punto final debe ser un objeto JSON válido' })
  puntoFin?: object;

  @ApiProperty({
    example: [{ lat: 20.1, lng: -103.1 }, { lat: 20.2, lng: -103.2 }],
    description: 'Recorrido base para interpolación',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PuntoDto)
  recorridoDetallado: PuntoDto[];

  @ApiPropertyOptional({
    description: 'Distancia total del derrotero en kilómetros',
    example: 15.75,
    type: Number,
    minimum: 0,
    maximum: 9999.99,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'La distancia debe ser un número con máximo 2 decimales' },
  )
  @Min(0, { message: 'La distancia no puede ser negativa' })
  @Max(9999.99, { message: 'La distancia no puede exceder 9999.99 km' })
  @Type(() => Number)
  distanciaKm?: number;

  @ApiPropertyOptional({
    description: 'Estatus del derrotero (1 = Activo, 0 = Inactivo)',
    example: 1,
    type: Number,
    enum: [0, 1],
    default: 1,
  })
  @IsOptional()
  @IsInt({ message: 'estatus debe ser un número entero' })
  @IsIn([0, 1], { message: 'Solo puede ser 0 ó 1' })
  estatus?: number = 1;

  @ApiProperty({
    description: 'ID de la ruta a la que pertenece el derrotero',
    example: 1,
    type: Number,
    minimum: 1,
  })
  @IsNotEmpty({ message: 'El ID de la ruta es obligatorio' })
  @IsNumber({}, { message: 'El ID de la ruta debe ser un número' })
  @IsPositive({ message: 'El ID de la ruta debe ser un número positivo' })
  @Type(() => Number)
  idRuta: number;

  // ========================================
  // 🔹 CAMPOS DE LA TARIFA
  // ========================================
  @ApiProperty({
    example: 35.5,
    description: 'Tarifa base en pesos',
  })
  @IsNotEmpty({ message: 'La tarifa base es obligatoria' })
  @IsNumber({}, { message: 'La tarifa base debe ser numérica' })
  tarifaBase: number;

  @ApiPropertyOptional({
    example: 5.0,
    description: 'Distancia base en kilómetros',
  })
  @IsOptional()
  @IsNumber({}, { message: 'La distancia base debe ser numérica' })
  @Min(0, { message: 'La distancia base no puede ser negativa' })
  distanciaBaseKm?: number;

  @ApiPropertyOptional({
    example: 500,
    description: 'Número de metros después de los cuales se aplica el costo adicional',
  })
  @IsOptional()
  @IsInt({ message: 'El incremento debe ser un número entero' })
  @Min(1, { message: 'El incremento debe ser mayor a 0' })
  incrementoCadaMetros?: number;

  @ApiPropertyOptional({
    example: 2.5,
    description: 'Costo adicional aplicado cada X metros',
  })
  @IsOptional()
  @IsNumber({}, { message: 'El costo adicional debe ser numérico' })
  @Min(0, { message: 'El costo adicional no puede ser negativo' })
  costoAdicional?: number;

  @ApiProperty({
    example: 1,
    description: 'Tipo de tarifa (0 = plana, 1 = incrementable)',
  })
  @IsNotEmpty({ message: 'El tipo de tarifa es obligatorio' })
  @IsInt({ message: 'El tipoTarifa debe ser un número entero' })
  @IsIn([0, 1], { message: 'Solo puede ser 0 ó 1' })
  tipoTarifa: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Estatus de la tarifa (0 = inactivo, 1 = activo)',
    default: 1,
  })
  @IsOptional()
  @IsInt({ message: 'El estatus de tarifa debe ser un número entero' })
  @IsIn([0, 1], { message: 'El estatus de tarifa solo puede ser 0 o 1' })
  estatusTarifa?: number = 1;
}