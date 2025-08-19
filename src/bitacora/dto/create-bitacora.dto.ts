import { IsInt, IsOptional, IsString } from "class-validator";

export class CreateBitacoraDto {
  @IsOptional()
  @IsString()
  Modulo?: string;

  @IsOptional()
  @IsString()
  Descripcion?: string;

  @IsOptional()
  @IsString()
  Accion?: string;

  @IsOptional()
  @IsString()
  Query?: string;

  @IsInt()
  IdUsuario: number;
}
