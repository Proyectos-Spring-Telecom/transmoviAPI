import { Expose, Transform, Type } from 'class-transformer';
import { ExposeModuloDto } from 'src/modulos/dto/expose-modulo.dto';

export class ExposePermisoDto {
  @Expose({ name: 'id' })
  @Transform(({ value }) => Number(value))
  Id: number;

  @Expose({ name: 'nombre' })
  Nombre: string;

  @Expose({ name: 'descripcion' })
  Descripcion: string;

  @Expose({ name: 'estatus' })
  Estatus: number;

  @Expose({ name: 'modulo' })
  @Type(() => ExposeModuloDto)
  Modulo?: ExposeModuloDto;
}
