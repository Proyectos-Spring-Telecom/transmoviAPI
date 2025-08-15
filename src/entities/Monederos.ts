import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Transacciones } from "./Transacciones";

@Index("NumeroSerie", ["numeroSerie"], { unique: true })
@Entity("Monederos", { schema: "TransmoviDev" })
export class Monederos {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: string;

  @Column("varchar", { name: "NumeroSerie", unique: true, length: 100 })
  numeroSerie: string;

  @Column("datetime", { name: "FechaActivacion" })
  fechaActivacion: Date;

  @Column("decimal", {
    name: "Saldo",
    precision: 10,
    scale: 2,
    default: () => "'0.00'",
  })
  saldo: string;

  @Column("tinyint", { name: "Estatus", default: () => "'1'" })
  estatus: number;

  @OneToMany(() => Transacciones, (transacciones) => transacciones.idMonedero2)
  transacciones: Transacciones[];
}
