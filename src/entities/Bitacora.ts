import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("Bitacora", { schema: "TransmoviDev" })
export class Bitacora {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: string;

  @Column("varchar", { name: "Modulo", nullable: true, length: 100 })
  modulo: string | null;

  @Column("varchar", { name: "Descripcion", nullable: true, length: 250 })
  descripcion: string | null;

  @Column("varchar", { name: "Accion", nullable: true, length: 45 })
  accion: string | null;

  @Column("datetime", { name: "Fecha", nullable: true })
  fecha: Date | null;

  @Column("varchar", { name: "Query", nullable: true, length: 1000 })
  query: string | null;

  @Column("bigint", { name: "IdUsuario" })
  idUsuario: string;
}
