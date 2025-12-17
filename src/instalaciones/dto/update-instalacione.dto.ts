import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateInstalacionesDto } from './create-instalacione.dto';
import {
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
    description: 'ID del contador asociado a la instalación',
    example: 202,
  })
  @IsOptional({ message: 'El IdContador es obligatorio' })
  @IsNumber()
  idContador?: number;

  @ApiProperty({
    description: 'ID del validador asociado a la instalación',
    example: 101,
  })
  @IsOptional({
    message: 'Para saber el estado de los componentes en caso de cambiarlos',
  })
  @IsInt()
  @IsIn([0, 1, 2, 3, 4, 5], { message: 'Solo se permite 0, 1, 2, 3, 4, 5' })
  estatusContadorAnterior?: number;

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
