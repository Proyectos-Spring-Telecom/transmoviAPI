import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Monederos } from "./Monederos";

@Index("IdMonedero", ["IdMonedero"], {})
@Entity("Transacciones", { schema: "TransmoviDev" })
export class Transacciones {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  Id: number;

  @Column("bigint", { name: "IdMonedero" })
  IdMonedero: number;

  @Column("varchar", { name: "TipoTransaccion", length: 10 })
  TipoTransaccion: string;

  @Column("decimal", { name: "Monto", precision: 10, scale: 2 })
  Monto: number;

  @Column("decimal", {
    name: "Latitud",
    nullable: true,
    precision: 10,
    scale: 7,
  })
  Latitud: string | null;

  @Column("decimal", {
    name: "Longitud",
    nullable: true,
    precision: 10,
    scale: 7,
  })
  Longitud: string | null;

  @Column("datetime", { name: "FechaHora" })
  FechaHora: Date;

  @Column("tinyint", { name: "Estatus", default: () => "'1'" })
  estatus: number;

  @ManyToOne(() => Monederos, (monederos) => monederos.transacciones, {
    onDelete: "NO ACTION",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "IdMonedero", referencedColumnName: "Id" }])
  IdMonedero2: Monederos;
}
