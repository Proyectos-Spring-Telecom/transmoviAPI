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
  id: string;

  @Column("varchar", { name: "Nombre", length: 100 })
  nombre: string;

  @Column("varchar", { name: "Descripcion", nullable: true, length: 255 })
  descripcion: string | null;

  @ManyToMany(() => Permisos, (permisos) => permisos.roles)
  @JoinTable({
    name: "RolePermisos",
    joinColumns: [{ name: "IdRol", referencedColumnName: "id" }],
    inverseJoinColumns: [{ name: "IdPermiso", referencedColumnName: "id" }],
    schema: "Transmovi",
  })
  permisos: Permisos[];

  @OneToMany(() => Usuarios, (usuarios) => usuarios.idRol2)
  usuarios: Usuarios[];
}
