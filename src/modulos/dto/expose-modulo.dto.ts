import { Expose, Transform } from 'class-transformer';

export class ExposeModuloDto {
  @Expose({ name: 'id' })
  @Transform(({ value }) => Number(value))
  Id: number;

  @Expose({ name: 'nombre' })
  Nombre: string;

  @Expose({ name: 'descripcion' })
  Descripcion: string | null;

  @Expose({ name: 'estatus' })
  Estatus: number | null;
}