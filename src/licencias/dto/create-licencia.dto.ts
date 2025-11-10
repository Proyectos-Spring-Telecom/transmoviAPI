import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsDateString,
  IsNumber,
  IsIn,
  IsEnum,
} from 'class-validator';
import { EnumCategoriaLicencia, EnumTipoLicencia } from 'src/common/estatus.enum';

export class CreateLicenciaDto {
  @ApiProperty({
    description: 'Nombre o descripción de la licencia',
    example: 'Licencia Federal Tipo A',
  })
  @IsString()
  @IsNotEmpty()
  licencia: string;

  @ApiProperty({
    description: 'Número de la licencia',
    example: 'ABC12345XYZ',
  })
  @IsString()
  @IsNotEmpty()
  numeroLicencia: string;

  @ApiProperty({
    description: 'Fecha en que fue expedida la licencia (YYYY-MM-DD)',
    example: '2023-01-15',
  })
  @IsDateString()
  fechaExpedicion: string;

  @ApiProperty({
    description: 'Fecha de vencimiento de la licencia (YYYY-MM-DD)',
    example: '2026-01-15',
  })
  @IsDateString()
  fechaVencimineto: string;

  @ApiProperty({
    enum: EnumTipoLicencia,
    description: 'Tipo de licencia del operador (A, B, C, D, E o F).',
    example: EnumTipoLicencia.A,
  })
  @IsEnum(EnumTipoLicencia, {
    message:
      'idTipoLicencia debe ser un valor válido: 1(A), 2(B), 3(C), 4(D), 5(E), 6(F)',
  })
  @IsNotEmpty()
  idTipoLicencia: EnumTipoLicencia;

  @ApiProperty({
    enum: EnumCategoriaLicencia,
    description: 'Categoría de la licencia según su tipo de cobertura.',
    example: EnumCategoriaLicencia.FEDERAL,
  })
  @IsEnum(EnumCategoriaLicencia, {
    message:
      'idCategoriaLicencia debe ser un valor válido: 1 (Federal) o 2 (Estatal)',
  })
  @IsNotEmpty()
  idCategoriaLicencia: EnumCategoriaLicencia;

  @ApiProperty({
    description: 'ID del operador al que pertenece la licencia',
    example: 8,
  })
  @IsNumber()
  @IsNotEmpty()
  idOperador: number;
}
