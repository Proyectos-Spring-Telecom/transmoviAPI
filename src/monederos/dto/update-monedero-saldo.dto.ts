import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';

export class UpdateMonederoSaldoDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  saldo: number = 0.0;
}
