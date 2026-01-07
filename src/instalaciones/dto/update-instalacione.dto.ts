import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateInstalacionesDto } from './create-instalacione.dto';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateInstalacioneDto extends PartialType(CreateInstalacionesDto) {
  @ApiProperty({
    description: 'ID del validador asociado a la instalación',
    example: 101,
  })
  @IsOptional({ message: 'El IdValidador es obligatorio' })
  @IsNumber()
  idValidador?: number;

  @ApiProperty({
    description: 'ID del validador asociado a la instalación',
    example: 101,
  })
  @IsOptional({
    message: 'Para saber el estado de los componentes en caso de cambiarlos',
  })
  @IsInt()
  @IsIn([0, 1, 2, 3, 4, 5], { message: 'Solo se permite 0, 1, 2, 3, 4, 5' })
  estatusValidadorAnterior?: number;

  @ApiProperty({
    description: 'IDs de los contadores asociados a la instalación',
    example: [202, 203],
    type: [Number],
  })
  @IsOptional({ message: 'Los IdContadores son opcionales' })
  @IsArray({ message: 'IdContadores debe ser un array' })
  @IsNumber({}, { each: true, message: 'Cada IdContador debe ser un número' })
  idContadores?: number[];

  @ApiProperty({
    description: 'IDs de los contadores anteriores (para actualizar estado)',
    example: [201],
    type: [Number],
  })
  @IsOptional({
    message: 'Para saber el estado de los componentes en caso de cambiarlos',
  })
  @IsArray({ message: 'IdContadoresAnteriores debe ser un array' })
  @IsNumber({}, { each: true })
  idContadoresAnteriores?: number[];

  @ApiProperty({
    description: 'Estatus anterior de los contadores',
    example: 1,
  })
  @IsOptional({
    message: 'Para saber el estado de los componentes en caso de cambiarlos',
  })
  @IsInt()
  @IsIn([0, 1, 2, 3, 4, 5], { message: 'Solo se permite 0, 1, 2, 3, 4, 5' })
  estatusContadoresAnteriores?: number;

  @ApiProperty({
    description: 'Comentario acerca de los componentes',
    example: 404,
  })
  @IsString()
  @IsOptional()
  comentariosValidador?: string;

  @ApiProperty({
    description: 'Comentario acerca de los componentes',
    example: 404,
  })
  @IsString()
  @IsOptional()
  comentariosContador?: string;
}
