import { Type } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateTransaccioneDto {
  @Type(() => Number)
  @IsInt({ message: 'IdMonedero debe ser un número entero' })
  @Min(1, { message: 'IdMonedero debe ser mayor a 0' })
  IdMonedero: number;

  @IsIn(['Recarga', 'Debito'], {
    message: 'Tipo de transacción inválido',
  })
  TipoTransaccion: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }) // máximo 2 decimales
  @Min(0) // opcional: evita negativos
  @Max(99999999.99) // máximo permitido por DECIMAL(10,2)
  Monto: number;
  
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 }) 
  @Min(-999.9999999)
  @Max(999.9999999)
  Latitud: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-999.9999999)
  @Max(999.9999999)
  @IsOptional() 
  Longitud?: number;

  @Type(() => Date)
  @IsDateString() // valida que sea una fecha en formato ISO 8601
  FechaHora: Date;

  @IsInt({ message: 'estatus debe ser un número entero'})
  @IsIn([0, 1], { message: 'Solo puede ser 0 ó 1'})
  @IsOptional() 
  Estatus?: number;
}
