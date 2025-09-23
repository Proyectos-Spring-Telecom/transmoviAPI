import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRegionesDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder los 100 caracteres' })
  @ApiProperty({
    description: 'Nombre de la región',
    example: 'Zona Norte',
  })
  nombre: string;

  @IsString()
  @IsOptional()
  @MaxLength(255, { message: 'La descripción no puede exceder los 255 caracteres' })
  @ApiProperty({
    description: 'Descripción de la región',
    example: 'Cobertura de rutas y vehículos en la zona norte de la ciudad',
    required: false,
  })
  descripcion?: string;

  @IsInt()
  @IsNotEmpty({ message: 'El estatus es obligatorio' })
  @ApiProperty({
    description: 'Estatus de la región (1 = Activo, 0 = Inactivo)',
    example: 1,
    default: 1,
  })
  estatus: number;

  @IsInt()
  @IsNotEmpty({ message: 'El IdCliente es obligatorio' })
  @ApiProperty({
    description: 'ID del cliente al que pertenece la región',
    example: 5,
  })
  idCliente: number;
}
