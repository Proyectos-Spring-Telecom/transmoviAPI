import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreatePermisoDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Nombre del permiso',
    example: 'Permiso',
  })
  Nombre: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Descripcion del permiso',
    example: 'Permiso',
  })
  Descripcion: string;

  @IsInt({ message: 'Estatus debe ser un numero entero' })
  @IsIn([0, 1], { message: 'Estatus solo puede ser 0 ó 1' })
  @IsOptional()
  @ApiProperty({
    description: 'Estatus del dispositivo solo es 1 ó 0',
    example: '1',
  })
  Estatus?: number = 1;

  @IsNumber()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Asignarlo a un módulo',
    example: 'Permiso',
  })
  IdModulo: number;
}
