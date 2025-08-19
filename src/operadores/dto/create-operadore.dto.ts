import { Type } from "class-transformer";
import { IsDate, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Length, MaxLength } from "class-validator";

export class CreateOperadoreDto {
  @IsString({ message: 'Es necesario el nombre' })
  nombre: string;

  @IsNotEmpty({ message: 'Es obligatorio el apellido paterno' })
  @IsString()
  apellidoPaterno: string;
  
  //Apellido Materno es opcional para casos de un solo apellido
  @IsOptional()
  @IsString()
  apellidoMaterno?: string;

  @IsString()
  @Length(1, 20)
  numeroLicencia: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  fechaNacimiento: Date;

  @IsEmail()
  correo: string;

  @IsNotEmpty({ message: 'Es obligatorio el numero' })
  @IsString()
  @MaxLength(20, { message: 'El teléfono no puede exceder los 20 caracteres' })
  telefono: string;

  @IsInt({ message: 'estatus debe ser un número entero'})
  @IsIn([0, 1], { message: 'Solo puede ser 0 ó 1'})
  @IsOptional() 
  estatus?: number;
}
