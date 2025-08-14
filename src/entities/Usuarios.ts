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

@Index("Usuarios_UserName_unique", ["userName"], { unique: true })
@Index("IdRol", ["idRol"], {})
@Index("IdCliente", ["idCliente"], {})
@Entity("Usuarios", { schema: "TransmoviDev" })
export class Usuarios {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("varchar", { name: "UserName", unique: true, length: 100 })
  userName: string;

  @Column("varchar", { name: "Password", length: 255 })
  password: string;

  @Column("tinyint", {
    name: "EmailConfirmed",
    nullable: true,
    default: () => "'0'",
  })
  emailConfirmed: number | null;

  @Column("varchar", { name: "Telefono", nullable: true, length: 20 })
  telefono: string | null;

  @Column("varchar", { name: "Nombre", nullable: true, length: 100 })
  nombre: string | null;

  @Column("varchar", { name: "ApellidoPaterno", nullable: true, length: 100 })
  apellidoPaterno: string | null;

  @Column("varchar", { name: "ApellidoMaterno", nullable: true, length: 100 })
  apellidoMaterno: string | null;

  @Column("tinyint", { name: "Estatus", default: () => "'1'" })
  estatus: number;

  @Column("bigint", { name: "IdRol", nullable: true })
  idRol: number | null;

  @Column("bigint", { name: "IdCliente", nullable: true })
  idCliente: number | null;

  @ManyToOne(() => Roles, (roles) => roles.usuarios, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "IdRol", referencedColumnName: "id" }])
  idRol2: Roles;

  @ManyToOne(() => Clientes, (clientes) => clientes.usuarios, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "IdCliente", referencedColumnName: "id" }])
  idCliente2: Clientes;
}
