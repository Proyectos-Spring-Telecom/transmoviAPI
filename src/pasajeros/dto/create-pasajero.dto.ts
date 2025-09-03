import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePasajeroDto {
  @IsNumber()
  id:number; 

  @IsString()
  @IsNotEmpty({ message: 'Es necesario el nombre' })
  @MaxLength(100, { message: 'El nombre no puede exceder los 100 caracteres' })
  @ApiProperty({
    description: 'Nombre del pasajero',
    example: 'Nombre Pasajero',
  })
  nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'Es obligatorio el apellido paterno' })
  @MaxLength(100, {
    message: 'El apellido paterno no puede exceder los 100 caracteres',
  })
  @ApiProperty({
    description: 'Apellido del pasajero',
    example: 'Apellido Paterno del Pasajero',
  })
  apellidoPaterno: string;

  //Apellido Materno es opcional para casos de un solo apellido
  @IsOptional()
  @IsString()
  @MaxLength(100, {
    message: 'El apellido materno no puede exceder los 100 caracteres',
  })
  @ApiProperty({
    description: 'Apellido Materno del pasajero',
    example: 'Apellido Materno del Pasajero',
  })
  apellidoMaterno?: string;

  @IsDate()
  @Type(() => Date)
  @ApiProperty({
    description: 'Fecha de nacimiento',
    example: '1955-08-25',
  })
  fechaNacimiento: string;

  @IsOptional()
  @IsEmail()
  @ApiProperty({
    description: 'Correo electronico',
    example: 'correo@ejemplo.com',
  })
  correo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'El teléfono no puede exceder los 20 caracteres' })
  @ApiProperty({
    description: 'Numero telefonico',
    example: '7354442211',
  })
  telefono: string;

  @IsInt({ message: 'estatus debe ser un número entero' })
  @IsIn([0, 1], { message: 'Solo puede ser 0 ó 1' })
  @IsOptional()
  @ApiProperty({
    description: 'El estatus es solo 0 ó 1',
    example: '1',
  })
  estatus?: number;
}
