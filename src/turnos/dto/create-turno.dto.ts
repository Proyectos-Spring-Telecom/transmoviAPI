import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateTurnoDto {
  @IsOptional()
  @IsDateString({}, { message: 'El inicio debe estar en formato ISO8601' })
  inicio?: Date;

  @IsDateString({}, { message: 'El fin debe estar en formato ISO8601' })
  @IsOptional()
  fin?: Date;

  @IsOptional()
  @IsInt({ message: 'El estatus debe ser un número entero' })
  @IsIn([0, 1], { message: 'El estatus solo puede ser 0 ó 1' })
  estatus?: number = 1;

  @IsInt({ message: 'El IdCliente debe ser un número entero' })
  @IsOptional()
  idCliente?: number;

  @IsInt({ message: 'El IdOperador debe ser un número entero' })
  @IsOptional()
  idOperador?: number;

  @IsInt({ message: 'El IdInstalacion debe ser un número entero' })
  @IsOptional()
  idInstalacion?: number;

  @ApiProperty({
    description: 'Numero de serie del dispositivo.',
    example: 300,
  })
  @IsString()
  @IsNotEmpty()
  numeroSerieDispositivo: string;
}
