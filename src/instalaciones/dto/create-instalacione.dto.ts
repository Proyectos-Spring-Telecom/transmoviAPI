import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
} from 'class-validator';

export class CreateInstalacionesDto {
  @ApiProperty({
    description:
      'IDs de Dispositivos asociados a la instalación. Deben pertenecer al mismo cliente y estar disponibles.',
    example: [101, 102],
  })
  @IsNotEmpty()
  @IsArray()
  @IsNumber({}, { each: true })
  idsDispositivos: number[];

  @ApiProperty({
    description: 'ID del vehículo asociado a la instalación',
    example: 303,
  })
  @IsNotEmpty({ message: 'El IdVehiculo es obligatorio' })
  @IsNumber()
  idVehiculo: number;

  @ApiProperty({
    description: 'ID del cliente asociado a la instalación',
    example: 404,
  })
  @IsNotEmpty({ message: 'El IdCliente es obligatorio' })
  @IsNumber()
  idCliente: number;

  @IsOptional()
  @IsInt()
  @IsIn([0, 1], { message: 'Solo se permite 0 o 1' })
  @ApiProperty({
    description: 'Estatus del usuario (1=Activo, 0=Inactivo)',
    example: 1,
  })
  estatus?: number = 1;

  @ApiProperty({
    description:
      'IDs de BlueVoxs asociados a la instalación. Deben pertenecer al mismo cliente y estar disponibles.',
    example: [202, 203],
  })
  @IsNotEmpty()
  @IsArray()
  @IsNumber({}, { each: true })
  idsBlueVoxs: number[];
}
