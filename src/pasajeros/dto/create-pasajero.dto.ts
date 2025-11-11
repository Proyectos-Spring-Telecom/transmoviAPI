import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsDateString,
  Length,
  IsEmail,
  IsInt,
  IsIn,
  IsNotEmpty,
  MaxLength,
  IsEnum,
  MinLength,
  Matches,
} from 'class-validator';
import { EnumSolicitudPasajero } from 'src/common/estatus.enum';

export class CreatePasajeroDto {
  @ApiProperty({ example: 'Juan', description: 'Nombre del pasajero' })
  @IsString()
  @Length(1, 100)
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({
    example: 'Pérez',
    description: 'Apellido paterno del pasajero',
  })
  @IsString()
  @Length(1, 100)
  @IsNotEmpty()
  apellidoPaterno: string;

  @ApiProperty({
    example: 'García',
    description: 'Apellido materno del pasajero (opcional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  apellidoMaterno?: string;

  @ApiProperty({
    example: '1995-08-15',
    description: 'Fecha de nacimiento (YYYY-MM-DD)',
  })
  @IsDateString()
  fechaNacimiento: string;

  @ApiProperty({
    example: '5544332211',
    description: 'Teléfono del pasajero (opcional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(1, 15)
  telefono?: string;

  @ApiProperty({
    example: 'juan.perez@example.com',
    description: 'Correo electrónico del pasajero (opcional)',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  @IsNotEmpty()
  correo?: string;

  @IsString()
  @IsNotEmpty({ message: 'El Password es obligatorio' })
  @MinLength(6, { message: 'El Password debe tener al menos 6 caracteres' })
  @Matches(/^(?=.*\p{L})(?=.*\d)(?=.*[@$!%*?&.])[^\s]+$/u, {
    message:
      'El Password debe contener al menos una letra (UTF-8), un número y un símbolo común (@$!%*?&.)',
  })
  @ApiProperty({
    description: 'Contraseña del usuario',
    example: 'P@ssword123',
  })
  passwordHash: string;

  @IsInt({ message: 'estatus debe ser un número entero' })
  @IsIn([0, 1], { message: 'Solo puede ser 0 ó 1' })
  @IsOptional()
  @ApiProperty({
    description: 'El estatus es solo 0 ó 1',
    example: '1',
  })
  estatus?: number = 1;

  @IsEnum(EnumSolicitudPasajero, {
    message: 'Estado de solicitud: 0 (No Solicitado), 1 (SOLICITADO)',
  })
  @ApiProperty({
    description: 'Solicitud cambio tipo de pasajero',
    example: '0 = No Solicitado, 1 = Solicitado',
  })
  @IsNotEmpty()
  estadoSolicitud: EnumSolicitudPasajero = EnumSolicitudPasajero.NOSOLICITADO;

  @ApiProperty({
    description: 'url del documento',
    example: 'https.documento.com',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  documentacion?: string;

  @ApiProperty({
    description: 'CURP del pasajero',
    example: 'ABCDEFGHIJKLMNOPQ',
  })
  @IsOptional()
  @IsString()
  @MaxLength(18)
  @MinLength(18)
  curp?: string;

  @ApiProperty({
    example: 'MON-0001',
    description: 'Número de serie único del monedero',
  })
  @IsString()
  @IsOptional()
  numeroSerieMonedero: string;

  @ApiProperty({
    example: 1,
    description: 'ID del tipo pasajero propietario del monedero',
  })
  @IsInt()
  @IsOptional()
  idTipoPasajero?: number;
}
