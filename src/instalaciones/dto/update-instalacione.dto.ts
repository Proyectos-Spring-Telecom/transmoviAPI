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
    description: 'ID del dispositivo asociado a la instalación',
    example: 101,
  })
  @IsOptional({ message: 'El IdDispositivo es obligatorio' })
  @IsNumber()
  idDispositivo?: number;

  @ApiProperty({
    description: 'ID del dispositivo asociado a la instalación',
    example: 101,
  })
  @IsOptional({
    message: 'Para saber el estado de los componentes en caso de cambiarlos',
  })
  @IsInt()
  @IsIn([0, 1, 2, 3, 4, 5], { message: 'Solo se permite 0, 1, 2, 3, 4, 5' })
  estatusDispositivoAnterior?: number;

  @ApiProperty({
    description: 'ID del BlueVox asociado a la instalación',
    example: 202,
  })
  @IsOptional({ message: 'El IdBlueVox es obligatorio' })
  @IsNumber()
  idBlueVox?: number;

  @ApiProperty({
    description: 'ID del dispositivo asociado a la instalación',
    example: 101,
  })
  @IsOptional({
    message: 'Para saber el estado de los componentes en caso de cambiarlos',
  })
  @IsInt()
  @IsIn([0, 1, 2, 3, 4, 5], { message: 'Solo se permite 0, 1, 2, 3, 4, 5' })
  estatusBluevoxsAnterior?: number;

  @ApiProperty({
    description: 'Comentario acerca de los componentes',
    example: 404,
  })
  @IsString()
  @IsOptional()
  comentariosDispositivo?: string;

  @ApiProperty({
    description: 'Comentario acerca de los componentes',
    example: 404,
  })
  @IsString()
  @IsOptional()
  comentariosBluevox?: string;

  @ApiProperty({
    description:
      'IDs de BlueVoxs asociados a la instalación. Si se envía, se actualizan las asociaciones usando la matriz de decisiones (similar a usuarios-permisos). Deben pertenecer al mismo cliente.',
    example: [202, 203, 205],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  idsBlueVoxs?: number[];
}
