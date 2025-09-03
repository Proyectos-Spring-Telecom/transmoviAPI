// create-vehiculo.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  Length,
  IsNotEmpty,
  IsInt,
  IsIn,
} from 'class-validator';

export class CreateVehiculoDto {
  @IsString()
  @IsNotEmpty({ message: 'La marca es obligatoria' })
  @ApiProperty({
    description: 'Marca del vehiculo',
    example: 'Marcad del vehiculo',
  })
  marca: string;

  @IsString()
  @IsNotEmpty({ message: 'El modelo es obligatorio' })
  @ApiProperty({
    description: 'Modelo del vehiculo',
    example: 'Modelo del vehiculo',
  })
  modelo: string;

  @IsNumber()
  @IsNotEmpty({ message: 'El año debe ser mayor a 1900' })
  @ApiProperty({
    description: 'Año del vehiculo',
    example: '1990',
  })
  ano: number;

  @IsString()
  @Length(1, 10)
  @IsNotEmpty({ message: 'La placa es obligatoria' })
  @ApiProperty({
    description: 'Placa del vehiculo',
    example: 'ABC-1234',
  })
  placa: string;

  @IsString()
  @Length(1, 50)
  @IsNotEmpty({ message: 'El número económico es obligatorio' })
  @ApiProperty({
    description: 'Numero economico del vehiculo',
    example: 'A20',
  })
  numeroEconomico: string;

  @IsNotEmpty({ message: 'Estaus necesario' })
  @IsInt({ message: 'Estatus debe ser un numero entero' })
  @IsIn([0, 1], { message: 'Solo puede ser 0 ó 1' })
  @ApiProperty({
    description: 'El estatus es solo 0 ó 1',
    example: '1',
  })
  estatus?: number;

  @IsString()
  @IsOptional()
  @ApiProperty({
    description: 'ID del operador',
    example: 'O15ABC',
  })
  idOperador?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    description: 'ID del dispositivo',
    example: '123ABC',
  })
  idDispositivo?: string;
}
