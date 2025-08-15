import { Column, Entity, OneToMany } from "typeorm";
import { Permisos } from "./Permisos";

@Entity("Modulos", { schema: "TransmoviDev" })
export class Modulos {
  @Column("bigint", { primary: true, name: "id" })
  id: number;

  @Column("varchar", { name: "Nombre", length: 100 })
  nombre: string;

  @Column("varchar", { name: "Descripcion", nullable: true, length: 255 })
  descripcion: string | null;
    @Column("tinyint", { name: "Estatus", nullable: true })
  estatus: number | null;

  @OneToMany(() => Permisos, (permisos) => permisos.idModulo)
  permisos: Permisos[];
}
