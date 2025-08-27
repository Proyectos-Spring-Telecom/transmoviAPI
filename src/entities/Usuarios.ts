import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Roles } from "./Roles";
import { Clientes } from "./Clientes";

@Index("Usuarios_UserName_unique", ["UserName"], { unique: true })
@Index("IdRol", ["IdRol"], {})
@Index("IdCliente", ["IdCliente"], {})
@Entity("Usuarios", { schema: "TransmoviDev" })
export class Usuarios {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  Id: number;

  @Column("varchar", { name: "UserName", unique: true, length: 100 })
  UserName: string;

  @Column("varchar", { name: "Password", length: 255 })
  Password: string;

  @Column("tinyint", {
    name: "EmailConfirmed",
    nullable: true,
    default: () => "'0'",
  })
  EmailConfirmed: number | null;

  @Column("varchar", { name: "Telefono", nullable: true, length: 20 })
  Telefono: string | null;

  @Column("varchar", { name: "Nombre", nullable: true, length: 100 })
  Nombre: string | null;

  @Column("varchar", { name: "ApellidoPaterno", nullable: true, length: 100 })
  ApellidoPaterno: string | null;

  @Column("varchar", { name: "ApellidoMaterno", nullable: true, length: 100 })
  ApellidoMaterno: string | null;

  @Column("tinyint", { name: "Estatus", default: () => "'1'" })
  Estatus: number;

  @Column("bigint", { name: "IdRol", nullable: true })
  IdRol: number | null;

  @Column("bigint", { name: "IdCliente", nullable: true })
  IdCliente: number | null;

  @ManyToOne(() => Roles, (roles) => roles.usuarios, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "IdRol", referencedColumnName: "Id" }])
  IdRol2: Roles;

  @ManyToOne(() => Clientes, (clientes) => clientes.usuarios, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "IdCliente", referencedColumnName: "Id" }])
  IdCliente2: Clientes;
}
