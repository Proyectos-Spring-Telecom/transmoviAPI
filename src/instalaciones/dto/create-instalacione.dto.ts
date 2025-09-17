import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class CreateInstalacionesDto {
  @ApiProperty({
    description: 'ID del dispositivo asociado a la instalación',
    example: 101,
  })
  @IsNotEmpty({ message: 'El IdDispositivo es obligatorio' })
  @IsNumber()
  idDispositivo: number;

  @ApiProperty({
    description: 'ID del BlueVox asociado a la instalación',
    example: 202,
  })
  @IsNotEmpty({ message: 'El IdBlueVox es obligatorio' })
  @IsNumber()
  idBlueVox: number;

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
}
