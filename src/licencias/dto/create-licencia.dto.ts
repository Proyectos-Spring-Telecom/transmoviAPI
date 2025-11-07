import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsDateString, IsNumber } from 'class-validator';

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
    description: 'ID del tipo de licencia',
    example: 2,
  })
  @IsNumber()
  @IsNotEmpty()
  idTipoLicencia: number;

  @ApiProperty({
    description: 'ID de la categoría de licencia',
    example: 4,
  })
  @IsNumber()
  @IsNotEmpty()
  idCategoriaLicencia: number;

  @ApiProperty({
    description: 'ID del operador al que pertenece la licencia',
    example: 8,
  })
  @IsNumber()
  @IsNotEmpty()
  idOperador: number;
}
