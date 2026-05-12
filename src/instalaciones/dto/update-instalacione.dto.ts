import { ApiProperty } from '@nestjs/swagger';
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

export class DispositivoAnteriorDto {
  @ApiProperty({
    description: 'ID del Dispositivo anterior',
    example: 101,
  })
  @IsNumber()
  idDispositivo: number;

  @ApiProperty({
    description: 'Estatus anterior del Dispositivo',
    example: 5,
  })
  @IsInt()
  @IsIn([0, 1, 2, 3, 4, 5], { message: 'Solo se permite 0, 1, 2, 3, 4, 5' })
  estatusAnterior: number;
}

export class UpdateInstalacioneDto {
  @ApiProperty({
    description: 'ID del vehículo asociado a la instalación',
    example: 303,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  idVehiculo?: number;

  @ApiProperty({
    description: 'ID del cliente asociado a la instalación',
    example: 404,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  idCliente?: number;

  @ApiProperty({
    description:
      'IDs de Dispositivos asociados a la instalación. Si se envía, se actualizan las asociaciones mediante la matriz en servidor. Deben pertenecer al mismo cliente.',
    example: [101, 102],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  idsDispositivos?: number[];

  @ApiProperty({
    description:
      'ID del dispositivo a marcar como principal. Debe estar entre los dispositivos asociados activos de la instalación tras aplicar `idsDispositivos`. Opcional: si no se envía, no se modifica el principal actual.',
    example: 101,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  idDispositivoPrincipal?: number;

  @ApiProperty({
    description:
      'Lista de Dispositivos anteriores que se van a cambiar con su estatus anterior',
    example: [
      { idDispositivo: 101, estatusAnterior: 5 },
      { idDispositivo: 102, estatusAnterior: 1 },
    ],
    required: false,
    type: [DispositivoAnteriorDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DispositivoAnteriorDto)
  dispositivosAnteriores?: DispositivoAnteriorDto[];

  @ApiProperty({
    description: 'Comentario acerca de los componentes (dispositivos)',
    example: 'Cambio de unidad',
    required: false,
  })
  @IsString()
  @IsOptional()
  comentariosDispositivo?: string;

  @ApiProperty({
    description:
      'IDs de BlueVoxs asociados a la instalación. Si se envía, se actualizan las asociaciones usando la matriz de decisiones. Deben pertenecer al mismo cliente.',
    example: [202, 203, 205],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  idsBlueVoxs?: number[];

  @ApiProperty({
    description:
      'Lista de BlueVoxs anteriores que se van a cambiar con su estatus anterior',
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

  @ApiProperty({
    description: 'Comentario acerca de los BlueVox',
    example: 'Reemplazo de equipo',
    required: false,
  })
  @IsString()
  @IsOptional()
  comentariosBluevox?: string;
}
