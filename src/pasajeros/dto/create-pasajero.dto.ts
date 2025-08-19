import { Type } from "class-transformer";
import { IsDate, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreatePasajeroDto {
  @IsString()
  @IsNotEmpty({ message: 'Es necesario el nombre' })
  @MaxLength(100, { message: 'El nombre no puede exceder los 100 caracteres' })
  nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'Es obligatorio el apellido paterno' })
  @MaxLength(100, {
    message: 'El apellido paterno no puede exceder los 100 caracteres',
  })
  apellidoPaterno: string;

  //Apellido Materno es opcional para casos de un solo apellido
  @IsOptional()
  @IsString()
  @MaxLength(100, {
    message: 'El apellido materno no puede exceder los 100 caracteres',
  })
  apellidoMaterno?: string;

   @IsDate()
   @Type(() => Date)
   fechaNacimiento: Date;

  @IsOptional()
  @IsEmail()
  correo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'El teléfono no puede exceder los 20 caracteres' })
  telefono: string;

  @IsInt({ message: 'estatus debe ser un número entero'})
  @IsIn([0, 1], { message: 'Solo puede ser 0 ó 1'})
  @IsOptional() 
  estatus?: number;
}
