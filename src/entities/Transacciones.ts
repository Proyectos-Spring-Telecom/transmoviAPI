import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Monederos } from "./Monederos";

@Index("IdMonedero", ["idMonedero"], {})
@Entity("Transacciones", { schema: "TransmoviDev" })
export class Transacciones {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: string;

  @Column("bigint", { name: "IdMonedero" })
  idMonedero: string;

  @Column("varchar", { name: "TipoTransaccion", length: 10 })
  tipoTransaccion: string;

  @Column("decimal", { name: "Monto", precision: 10, scale: 2 })
  monto: string;

  @Column("decimal", {
    name: "Latitud",
    nullable: true,
    precision: 10,
    scale: 7,
  })
  latitud: string | null;

  @Column("decimal", {
    name: "Longitud",
    nullable: true,
    precision: 10,
    scale: 7,
  })
  longitud: string | null;

  @Column("datetime", { name: "FechaHora" })
  fechaHora: Date;

  @Column("tinyint", { name: "Estatus", default: () => "'1'" })
  estatus: number;

  @ManyToOne(() => Monederos, (monederos) => monederos.transacciones, {
    onDelete: "NO ACTION",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "IdMonedero", referencedColumnName: "id" }])
  idMonedero2: Monederos;
}
