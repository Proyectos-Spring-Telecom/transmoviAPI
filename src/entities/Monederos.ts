import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Transacciones } from "./Transacciones";

@Index("NumeroSerie", ["NumeroSerie"], { unique: true })
@Entity("Monederos", { schema: "TransmoviDev" })
export class Monederos {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  Id: number;

  @Column("varchar", { name: "NumeroSerie", unique: true, length: 100 })
  NumeroSerie: string;

  @Column("datetime", { name: "FechaActivacion" })
  FechaActivacion: Date;

  @Column("decimal", {
    name: "Saldo",
    precision: 10,
    scale: 2,
    default: () => "'0.00'",
  })
  saldo: number;

  @Column("tinyint", { name: "Estatus", default: () => "'1'" })
  estatus: number;

  @OneToMany(() => Transacciones, (transacciones) => transacciones.IdMonedero2)
  transacciones: Transacciones[];
}
