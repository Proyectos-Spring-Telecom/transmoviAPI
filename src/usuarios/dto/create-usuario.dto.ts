import { ApiProperty } from "@nestjs/swagger";
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  IsDateString,
  IsNumber,
} from "class-validator";

export class CreateUsuarioDto {
  @IsNumber()
  id:number;
  @IsString()
  @IsNotEmpty({ message: "El nombre de usuario es obligatorio" })
  @MaxLength(255, {
    message: "El nombre de usuario no puede exceder los 255 caracteres",
  })
  @ApiProperty({
    description: "Username único del usuario",
    example: "correo@ejemplo.com",
  })
  userName: string;

  @IsString()
  @IsNotEmpty({ message: "La contraseña es obligatoria" })
  @MinLength(6, { message: "La contraseña debe tener al menos 6 caracteres" })
  @MaxLength(255, {
    message: "La contraseña no puede exceder los 255 caracteres",
  })
  @ApiProperty({
    description: "Contraseña encriptada (hash)",
    example: "Contraseña123",
  })
  passwordHash: string;

  @IsOptional()
  @IsString()
  @MaxLength(6, { message: "El PIN no puede exceder los 6 caracteres" })
  @ApiProperty({
    description: "PIN encriptado (hash)",
    example: "123456",
    required: false,
  })
  pinHash?: string;

  @IsNotEmpty({ message: "Confirmar email en valor de 0 ó 1" })
  @IsInt({ message: "EmailConfirmado debe ser un número entero" })
  @IsIn([0, 1], { message: "Solo puede ser 0 ó 1" })
  @ApiProperty({
    description: "Confirmación de email",
    example: 0,
  })
  emailConfirmado: number = 0;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: "El nombre no puede exceder los 100 caracteres" })
  @ApiProperty({
    description: "Nombre del usuario",
    example: "Juan",
    required: false,
  })
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, {
    message: "El apellido paterno no puede exceder los 100 caracteres",
  })
  @ApiProperty({
    description: "Apellido Paterno",
    example: "Castillo",
    required: false,
  })
  apellidoPaterno?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, {
    message: "El apellido materno no puede exceder los 100 caracteres",
  })
  @ApiProperty({
    description: "Apellido Materno",
    example: "Tzec",
    required: false,
  })
  apellidoMaterno?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: "El teléfono no puede exceder los 20 caracteres" })
  @ApiProperty({
    description: "Número telefónico",
    example: "5564101421",
    required: false,
  })
  telefono?: string;

  @IsOptional()
  @IsDateString({}, { message: "UltimoLogin debe ser una fecha válida" })
  @ApiProperty({
    description: "Último login del usuario",
    example: "2025-09-01T12:00:00Z",
    required: false,
  })
  ultimoLogin?: string;

  @IsOptional()
  @IsDateString({}, { message: "ActualizacionPassword debe ser una fecha válida" })
  @ApiProperty({
    description: "Fecha de actualización de la contraseña",
    example: "2025-09-01T12:00:00Z",
    required: false,
  })
  actualizacionPassword?: string;

  @IsOptional()
  @IsDateString({}, { message: "ActualizacionPin debe ser una fecha válida" })
  @ApiProperty({
    description: "Fecha de actualización del PIN",
    example: "2025-09-01T12:00:00Z",
    required: false,
  })
  actualizacionPin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(15, { message: "El DispositivoId no puede exceder los 15 caracteres" })
  @ApiProperty({
    description: "Identificador del dispositivo",
    example: "DISP123456",
    required: false,
  })
  dispositivoId?: string;

  @IsNotEmpty({ message: "Confirmar estatus en valor de 0 ó 1" })
  @IsInt({ message: "Estatus debe ser un número entero" })
  @IsIn([0, 1], { message: "Solo puede ser 0 ó 1" })
  @ApiProperty({
    description: "Estatus de activación del usuario",
    example: 1,
  })
  estatus: number = 1;

  @IsNotEmpty({ message: "El rol es obligatorio" })
  @IsInt({ message: "El rol debe ser un identificador numérico válido" })
  @ApiProperty({
    description: "ID del Rol asignado al usuario",
    example: 2,
  })
  idRol: number;

  @IsNotEmpty({ message: "El cliente es obligatorio" })
  @IsInt({ message: "El cliente debe ser un identificador numérico válido" })
  @ApiProperty({
    description: "ID del Cliente al que pertenece el usuario",
    example: 1,
  })
  idCliente: number;
}
