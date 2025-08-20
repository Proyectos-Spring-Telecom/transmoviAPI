import { Type } from "class-transformer";
import { IsDate, IsDecimal, IsIn, IsInt, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateMonederoDto {
  @IsString()
  NumeroSerie: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  FechaActivacion?: Date;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  Saldo: number= 0.0;

  @IsInt({ message: 'estatus debe ser un número entero'})
  @IsIn([0, 1], { message: 'Solo puede ser 0 ó 1'})
  @IsOptional() 
  Estatus?: number = 1;
}
