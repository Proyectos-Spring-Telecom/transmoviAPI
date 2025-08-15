import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Vehiculos } from "./Vehiculos";

@Index("NumeroSerie", ["numeroSerie"], { unique: true })
@Entity("Dispositivos", { schema: "TransmoviDev" })
export class Dispositivos {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: string;

  @Column("varchar", { name: "NumeroSerie", unique: true, length: 255 })
  numeroSerie: string;

  @Column("varchar", { name: "Marca", length: 100 })
  marca: string;

  @Column("varchar", { name: "Modelo", length: 100 })
  modelo: string;

  @Column("tinyint", { name: "Estatus", default: () => "'1'" })
  estatus: number;

  @OneToMany(() => Vehiculos, (vehiculos) => vehiculos.idDispositivo2)
  vehiculos: Vehiculos[];
}
