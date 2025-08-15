import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Modulos } from "./Modulos";
import { Roles } from "./Roles";

@Index("fk_permisos_modulo", ["idModulo"], {})
@Entity("Permisos", { schema: "TransmoviDev" })
export class Permisos {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("varchar", { name: "Nombre", length: 100 })
  nombre: string;

  @Column("varchar", { name: "Descripcion", nullable: true, length: 255 })
  descripcion: string | null;

    @Column("tinyint", { name: "Estatus", nullable: true })
  estatus: number | null;

  @ManyToOne(() => Modulos, (modulos) => modulos.permisos, {
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "idModulo", referencedColumnName: "id" }])
  idModulo: number;

  @ManyToMany(() => Roles, (roles) => roles.permisos)
  roles: Roles[];
}
