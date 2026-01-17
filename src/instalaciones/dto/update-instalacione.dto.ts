import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateInstalacionesDto } from './create-instalacione.dto';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BlueVoxAnteriorDto {
  @ApiProperty({
    description: 'ID del BlueVox anterior',
    example: 5,
  })
  @IsNumber()
  idBlueVox: number;

  @ApiProperty({
    description: 'Estatus anterior del BlueVox',
    example: 5,
  })
  @IsInt()
  @IsIn([0, 1, 2, 3, 4, 5], { message: 'Solo se permite 0, 1, 2, 3, 4, 5' })
  estatusAnterior: number;
}

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
    description:
      'IDs de BlueVoxs asociados a la instalación. Si se envía, se actualizan las asociaciones usando la matriz de decisiones (similar a usuarios-permisos). Deben pertenecer al mismo cliente.',
    example: [202, 203, 205],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  idsBlueVoxs?: number[];

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
    description: 'ID del cliente asociado a la instalación',
    example: 6,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  idCliente?: number;

  @ApiProperty({
    description: 'Lista de BlueVoxs anteriores que se van a cambiar con su estatus anterior',
    example: [
      { idBlueVox: 5, estatusAnterior: 5 },
      { idBlueVox: 7, estatusAnterior: 1 },
    ],
    required: false,
    type: [BlueVoxAnteriorDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlueVoxAnteriorDto)
  blueVoxsAnteriores?: BlueVoxAnteriorDto[];
}
