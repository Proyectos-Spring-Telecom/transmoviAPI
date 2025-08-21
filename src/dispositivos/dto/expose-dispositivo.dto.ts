import { Expose, Transform } from 'class-transformer';

export class ExposeDispositivoDto {
  @Expose({ name: 'id' })
  @Transform(({ value }) => Number(value))
  Id: number;

  @Expose({ name: 'numeroSerie' })
  NumeroSerie: string;

  @Expose({ name: 'marca' })
  Marca: string;

  @Expose({ name: 'modelo' })
  Modelo: string;

  @Expose({ name: 'estatus' })
  Estatus: number;
}
