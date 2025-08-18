import { Type } from "class-transformer";
import { IsDate, IsDecimal, IsIn, IsInt, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateMonederoDto {
  @IsString()
  numeroSerie: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  fechaActivacion?: Date;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  saldo: number= 0.0;

  @IsInt({ message: 'estatus debe ser un número entero'})
  @IsIn([0, 1], { message: 'Solo puede ser 0 ó 1'})
  @IsOptional() 
  estatus?: number = 1;
}
