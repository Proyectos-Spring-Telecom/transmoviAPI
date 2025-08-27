import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Vehiculos } from "./Vehiculos";

@Index("NumeroSerie", ["NumeroSerie"], { unique: true })
@Entity("Dispositivos", { schema: "TransmoviDev" })
export class Dispositivos {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  Id: number;

  @Column("varchar", { name: "NumeroSerie", unique: true, length: 255 })
  NumeroSerie: string;

  @Column("varchar", { name: "Marca", length: 100 })
  Marca: string;

  @Column("varchar", { name: "Modelo", length: 100 })
  Modelo: string;

  @Column("tinyint", { name: "Estatus", default: () => "'1'" })
  estatus: number;

  @OneToMany(() => Vehiculos, (vehiculos) => vehiculos.IdDispositivo2)
  vehiculos: Vehiculos[];
}
