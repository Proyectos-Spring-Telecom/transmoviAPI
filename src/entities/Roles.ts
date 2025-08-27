import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Permisos } from "./Permisos";
import { Usuarios } from "./Usuarios";

@Entity("Roles", { schema: "TransmoviDev" })
export class Roles {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  Id: string;

  @Column("varchar", { name: "Nombre", length: 100 })
  Nombre: string;

  @Column("varchar", { name: "Descripcion", nullable: true, length: 255 })
  Descripcion: string | null;

  @ManyToMany(() => Permisos, (permisos) => permisos.roles)
  @JoinTable({
    name: "RolePermisos",
    joinColumns: [{ name: "IdRol", referencedColumnName: "Id" }],
    inverseJoinColumns: [{ name: "IdPermiso", referencedColumnName: "Id" }],
    schema: "TransmoviDev",
  })
  Permisos: Permisos[];

  @OneToMany(() => Usuarios, (usuarios) => usuarios.IdRol2)
  usuarios: Usuarios[];
}
