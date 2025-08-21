import { Expose, Transform } from 'class-transformer';

export class ExposeDispositivoDto {
  @Expose()
  @Transform(({ obj }) => obj.id, { toClassOnly: true })
  Id: number;

  @Expose()
  @Transform(({ obj }) => obj.numeroSerie, { toClassOnly: true })
  NumeroSerie: string;

  @Expose()
  @Transform(({ obj }) => obj.marca, { toClassOnly: true })
  Marca: string;

  @Expose()
  @Transform(({ obj }) => obj.modelo, { toClassOnly: true })
  Modelo: string;

  @Expose()
  @Transform(({ obj }) => obj.estatus, { toClassOnly: true })
  Estatus: number;
}