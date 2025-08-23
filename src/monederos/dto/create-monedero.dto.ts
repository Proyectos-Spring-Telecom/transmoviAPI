import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDate, IsDecimal, IsIn, IsInt, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateMonederoDto {
  @IsString()
  @ApiProperty({
            description: 'Numero de serie del monedero',
            example: 'DED82B9A',
        })
  NumeroSerie: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  @ApiProperty({
            description: 'Fecha en la que se activo',
            example: '2025-08-17 08:00:00',
        })
  FechaActivacion?: Date;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @ApiProperty({
            description: 'Saldo del monedero',
            example: '50.00',
        })
  Saldo: number= 0.0;

  @IsInt({ message: 'estatus debe ser un número entero'})
  @IsIn([0, 1], { message: 'Solo puede ser 0 ó 1'})
  @IsOptional() 
  @ApiProperty({
            description: 'Estatus del monedero solo puede ser 1 ó 0',
            example: '1',
        })
  Estatus?: number = 1;
}
