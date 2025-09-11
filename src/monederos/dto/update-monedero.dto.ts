import { PartialType } from '@nestjs/mapped-types';
import { CreateMonederoDto } from './create-monedero.dto';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
} from 'class-validator';

export class UpdateMonederoDto {
  
  @IsInt({ message: 'estatus debe ser un número entero' })
  @IsIn([0, 1], { message: 'Solo puede ser 0 ó 1' })
  @IsOptional()
  @ApiProperty({
    description: 'El estatus es solo 0 ó 1',
    example: '1',
  })
  estatus?: number;

  @ApiProperty({
    example: 2,
    description: 'ID del pasajero (opcional)',
    required: false,
  })
  @IsOptional()
  @IsInt()
  idPasajero?: number;

  @ApiProperty({
    example: 1,
    description: 'ID del cliente propietario del monedero',
  })
  @IsInt()
  @IsOptional()
  idCliente?: number;
}
