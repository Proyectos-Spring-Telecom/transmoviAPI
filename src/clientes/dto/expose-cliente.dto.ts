import { Expose, Transform } from 'class-transformer';

export class ExposeClienteDto {
  @Expose({ name: 'id' })
  @Transform(({ value }) => Number(value))
  Id: number;

  @Expose({ name: 'idPadre' })
  IdPadre: string;

  @Expose({ name: 'rfc' })
  RFC: string;

  @Expose({ name: 'tipoPersona' })
  TipoPersona: number;

  @Expose({ name: 'estatus' })
  Estatus: number;

  @Expose({ name: 'logotipo' })
  Logotipo: string | null;

  @Expose({ name: 'nombre' })
  Nombre: string | null;

  @Expose({ name: 'apellidoPaterno' })
  ApellidoPaterno: string | null;

  @Expose({ name: 'apellidoMaterno' })
  ApellidoMaterno: string | null;

  @Expose({ name: 'telefono' })
  Telefono: string | null;

  @Expose({ name: 'correo' })
  Correo: string | null;

  @Expose({ name: 'estado' })
  Estado: string | null;

  @Expose({ name: 'municipio' })
  Municipio: string | null;

  @Expose({ name: 'colonia' })
  Colonia: string | null;

  @Expose({ name: 'calle' })
  Calle: string | null;

  @Expose({ name: 'entreCalles' })
  EntreCalles: string | null;

  @Expose({ name: 'numeroExterior' })
  NumeroExterior: string | null;

  @Expose({ name: 'numeroInterior' })
  NumeroInterior: string | null;

  @Expose({ name: 'cp' })
  CP: string | null;

  @Expose({ name: 'nombreEncargado' })
  NombreEncargado: string | null;

  @Expose({ name: 'telefonoEncargado' })
  TelefonoEncargado: string | null;

  @Expose({ name: 'emailEncargado' })
  EmailEncargado: string | null;
}
