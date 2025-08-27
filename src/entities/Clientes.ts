import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Usuarios } from "./Usuarios";

@Entity("Clientes", { schema: "TransmoviDev" })
export class Clientes {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  Id: number;

  @Column("varchar", { name: "IdPadre", length: 50 })
  IdPadre: string;

  @Column("varchar", { name: "RFC", length: 16 })
  RFC: string;

  @Column("int", { name: "TipoPersona" })
  TipoPersona: number;

  @Column("int", { name: "Estatus" })
  Estatus: number;

  @Column("varchar", { name: "Logotipo", nullable: true, length: 500 })
  Logotipo: string | null;

  @Column("varchar", { name: "Nombre", nullable: true, length: 255 })
  Nombre: string | null;

  @Column("varchar", { name: "ApellidoPaterno", nullable: true, length: 100 })
  ApellidoPaterno: string | null;

  @Column("varchar", { name: "ApellidoMaterno", nullable: true, length: 100 })
  ApellidoMaterno: string | null;

  @Column("varchar", { name: "Telefono", nullable: true, length: 10 })
  Telefono: string | null;

  @Column("varchar", { name: "Correo", nullable: true, length: 100 })
  Correo: string | null;

  @Column("varchar", { name: "Estado", nullable: true, length: 45 })
  Estado: string | null;

  @Column("varchar", { name: "Municipio", nullable: true, length: 45 })
  Municipio: string | null;

  @Column("varchar", { name: "Colonia", nullable: true, length: 45 })
  Colonia: string | null;

  @Column("varchar", { name: "Calle", nullable: true, length: 100 })
  Calle: string | null;

  @Column("varchar", { name: "EntreCalles", nullable: true, length: 45 })
  EntreCalles: string | null;

  @Column("varchar", { name: "NumeroExterior", nullable: true, length: 10 })
  NumeroExterior: string | null;

  @Column("varchar", { name: "NumeroInterior", nullable: true, length: 10 })
  NumeroInterior: string | null;

  @Column("varchar", { name: "CP", nullable: true, length: 5 })
  CP: string | null;

  @Column("varchar", { name: "NombreEncargado", nullable: true, length: 100 })
  NombreEncargado: string | null;

  @Column("varchar", { name: "TelefonoEncargado", nullable: true, length: 10 })
  TelefonoEncargado: string | null;

  @Column("varchar", { name: "EmailEncargado", nullable: true, length: 100 })
  EmailEncargado: string | null;

  @OneToMany(() => Usuarios, (usuarios) => usuarios.IdCliente2)
  usuarios: Usuarios[];
}
