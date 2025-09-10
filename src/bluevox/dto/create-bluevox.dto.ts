import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';

export class CreateBlueVoxsDto {
  @IsString()
  @IsNotEmpty({ message: 'El número de serie es obligatorio' })
  @ApiProperty({
    description: 'Número de serie único del dispositivo BlueVoxs',
    example: 'BVX-12345-XYZ',
  })
  numeroSerie: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    description: 'Marca del dispositivo',
    example: 'BlueTech',
    required: false,
  })
  marca?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    description: 'Modelo del dispositivo',
    example: 'BX-2025',
    required: false,
  })
  modelo?: string;

  @IsNumber()
  @IsNotEmpty({ message: 'El estatus es obligatorio' })
  @ApiProperty({
    description: 'Estatus del dispositivo (1 = activo, 0 = inactivo)',
    example: 1,
  })
  estatus: number;

  @IsString()
  @IsNotEmpty({ message: 'El IdCliente es obligatorio' })
  @ApiProperty({
    description: 'Identificador del cliente al que pertenece el dispositivo',
    example: '123',
  })
  idCliente: string;
}
