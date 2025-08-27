import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateUsuarioDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre de usuario es obligatorio' })
  @MaxLength(100, {
    message: 'El nombre de usuario no puede exceder los 100 caracteres',
  })
  @ApiProperty({
      description: 'Username',
      example: 'correo@ejemplo.com',
    })
  UserName: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @ApiProperty({
    description: 'Contraseña',
    example: 'Contraseña123',
  })
  Password: string;

  @IsNotEmpty({ message: 'Confirmar email en valor de 0 ó 1' })
  @IsInt({ message: 'emailConfirmed debe ser un número entero' })
  @IsIn([0, 1], { message: 'Solo puede ser 0 ó 1' })
  @ApiProperty({
    description: 'Confirmacion de email',
    example: '0',
  })
  EmailConfirmed: number = 0;

  @IsNotEmpty({ message: 'Es obligatorio el numero' })
  @IsString()
  @MaxLength(20, { message: 'El teléfono no puede exceder los 20 caracteres' })
  @ApiProperty({
    description: 'Numero telefonico',
    example: '5564101421',
  })
  Telefono: string;

  @IsString()
  @IsNotEmpty({ message: 'Es necesario el nombre' })
  @MaxLength(100, { message: 'El nombre no puede exceder los 100 caracteres' })
  @ApiProperty({
    description: 'Nombre del usuario',
    example: 'Juan',
  })
  Nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'Es obligatorio el apellido paterno' })
  @MaxLength(100, {
    message: 'El apellido paterno no puede exceder los 100 caracteres',
  })
  @ApiProperty({
    description: 'Apellido Paterno',
    example: 'Castillo',
  })
  ApellidoPaterno: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, {
    message: 'El apellido materno no puede exceder los 100 caracteres',
  })@ApiProperty({
    description: 'Apellido Materno',
    example: 'Tzec',
  })
  ApellidoMaterno?: string;

  @IsNotEmpty({ message: 'Confirmar estatus en valor de 0 ó 1' })
  @IsInt({ message: 'estatus debe ser un número entero' })
  @IsIn([0, 1], { message: 'Solo puede ser 0 ó 1' })
  @ApiProperty({
    description: 'Estatus de activacion del usuario',
    example: '1',
  })
  Estatus: number = 1;

  @IsNotEmpty({ message: 'El rol es obligatorio' })
  @IsInt({ message: 'El rol debe ser un identificador numérico válido' })
  @ApiProperty({
    description: 'Rol que va a tener',
    example: '0',
  })
  IdRol: number;

  @IsNotEmpty({ message: 'El cliente es obligatorio' })
  @IsInt({ message: 'emailConfirmed debe ser un número entero' })
  @ApiProperty({
    description: 'Cliente a que esta relacionado',
    example: '1',
  })
  IdCliente: number;
}