import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsDate,
  IsInt,
  MaxLength,
} from 'class-validator';

export class CreatePermisoDto {
  @IsNumber()
  @IsOptional()
  id?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  descripcion?: string;

  @IsNumber()
  @IsNotEmpty()
  idModulo: number;

  @IsInt()
  @IsOptional()
  estatus?: number;
}
