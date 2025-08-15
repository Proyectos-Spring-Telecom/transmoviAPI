import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Usuarios } from "./Usuarios";

@Entity("Clientes", { schema: "TransmoviDev" })
export class Clientes {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: string;

  @Column("varchar", { name: "IdPadre", length: 50 })
  idPadre: string;

  @Column("varchar", { name: "RFC", length: 16 })
  rfc: string;

  @Column("int", { name: "TipoPersona" })
  tipoPersona: number;

  @Column("int", { name: "Estatus" })
  estatus: number;

  @Column("varchar", { name: "Logotipo", nullable: true, length: 500 })
  logotipo: string | null;

  @Column("varchar", { name: "Nombre", nullable: true, length: 255 })
  nombre: string | null;

  @Column("varchar", { name: "ApellidoPaterno", nullable: true, length: 100 })
  apellidoPaterno: string | null;

  @Column("varchar", { name: "ApellidoMaterno", nullable: true, length: 100 })
  apellidoMaterno: string | null;

  @Column("varchar", { name: "Telefono", nullable: true, length: 10 })
  telefono: string | null;

  @Column("varchar", { name: "Correo", nullable: true, length: 100 })
  correo: string | null;

  @Column("varchar", { name: "Estado", nullable: true, length: 45 })
  estado: string | null;

  @Column("varchar", { name: "Municipio", nullable: true, length: 45 })
  municipio: string | null;

  @Column("varchar", { name: "Colonia", nullable: true, length: 45 })
  colonia: string | null;

  @Column("varchar", { name: "Calle", nullable: true, length: 100 })
  calle: string | null;

  @Column("varchar", { name: "EntreCalles", nullable: true, length: 45 })
  entreCalles: string | null;

  @Column("varchar", { name: "NumeroExterior", nullable: true, length: 10 })
  numeroExterior: string | null;

  @Column("varchar", { name: "NumeroInterior", nullable: true, length: 10 })
  numeroInterior: string | null;

  @Column("varchar", { name: "CP", nullable: true, length: 5 })
  cp: string | null;

  @Column("varchar", { name: "NombreEncargado", nullable: true, length: 100 })
  nombreEncargado: string | null;

  @Column("varchar", { name: "TelefonoEncargado", nullable: true, length: 10 })
  telefonoEncargado: string | null;

  @Column("varchar", { name: "EmailEncargado", nullable: true, length: 100 })
  emailEncargado: string | null;

  @OneToMany(() => Usuarios, (usuarios) => usuarios.idCliente2)
  usuarios: Usuarios[];
}
