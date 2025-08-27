import { Column, Entity, OneToMany } from "typeorm";
import { Permisos } from "./Permisos";

@Entity("Modulos", { schema: "TransmoviDev" })
export class Modulos {
  @Column("bigint", { primary: true, name: "Id" })
  Id: number;

  @Column("varchar", { name: "Nombre", length: 100 })
  Nombre: string;

  @Column("varchar", { name: "Descripcion", nullable: true, length: 255 })
  Descripcion: string | null;
    @Column("tinyint", { name: "Estatus", nullable: true })
  Estatus: number | null;

  @OneToMany(() => Permisos, (permisos) => permisos.IdModulo)
  permisos: Permisos[];
}
