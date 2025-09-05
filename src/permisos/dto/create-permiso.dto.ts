import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsInt,
  MaxLength,
} from 'class-validator';

export class CreatePermisoDto {
  @IsNumber()
  @IsOptional()
  id?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @ApiProperty({
    description: 'Nombre del permiso',
    example: 'Permiso',
  })
  nombre: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  @ApiProperty({
    description: 'Descripción del permiso',
    example: 'Permiso',
  })
  descripcion?: string;

  @IsNumber()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Numero del modulo',
    example: '1',
  })
  idModulo: number;

  @IsInt()
  @IsOptional()
  estatus?: number;
}
