import { Type } from "class-transformer";
import { IsDate, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Length, MaxLength } from "class-validator";

export class CreateOperadoreDto {
  @IsString({ message: 'Es necesario el nombre' })
  Nombre: string;

  @IsNotEmpty({ message: 'Es obligatorio el apellido paterno' })
  @IsString()
  ApellidoPaterno: string;
  
  //Apellido Materno es opcional para casos de un solo apellido
  @IsOptional()
  @IsString()
  ApellidoMaterno?: string;

  @IsString()
  @Length(1, 20)
  NumeroLicencia: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  FechaNacimiento: Date;

  @IsEmail()
  Correo: string;

  @IsNotEmpty({ message: 'Es obligatorio el numero' })
  @IsString()
  @MaxLength(20, { message: 'El teléfono no puede exceder los 20 caracteres' })
  Telefono: string;

  @IsInt({ message: 'estatus debe ser un número entero'})
  @IsIn([0, 1], { message: 'Solo puede ser 0 ó 1'})
  @IsOptional() 
  Estatus?: number;
}
