import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateOperadoreDto {
  @IsString({ message: 'Es necesario el nombre' })
  @ApiProperty({
    description: 'Nombre del operador',
    example: 'Juan',
  })
  Nombre: string;

  @IsNotEmpty({ message: 'Es obligatorio el apellido paterno' })
  @IsString()
  @ApiProperty({
    description: 'Apellido Paterno del operador',
    example: 'Martinez',
  })
  ApellidoPaterno: string;

  //Apellido Materno es opcional para casos de un solo apellido
  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'Apellido Materno del operador',
    example: 'Castillo',
  })
  ApellidoMaterno?: string;

  @IsString()
  @Length(1, 20)
  @ApiProperty({
    description: 'Numero de licencia del operador',
    example: 'ABC123456',
  })
  NumeroLicencia: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  @ApiProperty({
    description: 'Fecha de Nacimiento del operador',
    example: '1988-08-08 08:00:00',
  })
  FechaNacimiento: Date;

  @IsEmail()
  @ApiProperty({
    description: 'Correo electronico del operador',
    example: 'correo@ejemplo.com',
  })
  Correo: string;

  @IsNotEmpty({ message: 'Es obligatorio el numero' })
  @IsString()
  @MaxLength(20, { message: 'El teléfono no puede exceder los 20 caracteres' })
  @ApiProperty({
    description: 'Telefono del operador',
    example: '7776665544',
  })
  Telefono: string;

  @IsInt({ message: 'estatus debe ser un número entero' })
  @IsIn([0, 1], { message: 'Solo puede ser 0 ó 1' })
  @ApiProperty({
    description: 'Estatus del operador solo puede ser 1 ó 0',
    example: '1',
  })
  @IsOptional()
  Estatus?: number = 1;
}
