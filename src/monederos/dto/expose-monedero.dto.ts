import { Expose, Transform } from 'class-transformer';

export class ExposeMonederoDto {
  @Expose({ name: 'id' })
  @Transform(({ value }) => Number(value))
  Id: number;

  @Expose({ name: 'numeroSerie' })
  NumeroSerie: string;

  @Expose({ name: 'fechaActivacion' })
  FechaActivacion: Date;

  @Expose({ name: 'saldo' })
  Saldo: number;

  @Expose({ name: 'estatus' })
  Estatus: number;
}
