import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Rutas } from "./Rutas";

@Index("IdRuta", ["IdRuta"], {})
@Entity("Tarifas", { schema: "TransmoviDev" })
export class Tarifas {
  @PrimaryGeneratedColumn({ type: "int", name: "Id" })
  Id: number;

  @Column("int", { name: "IdRuta" })
  IdRuta: number;

  @Column("decimal", { name: "TarifaBase", precision: 10, scale: 2 })
  TarifaBase: string;

  @Column("decimal", { name: "DistanciaBaseKm", precision: 10, scale: 2 })
  DistanciaBaseKm: string;

  @Column("int", { name: "IncrementoCadaMetros" })
  IncrementoCadaMetros: number;

  @Column("decimal", { name: "CostoAdicional", precision: 10, scale: 2 })
  CostoAdicional: string;

  @Column("datetime", {
    name: "FechaRegistro",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  fechaRegistro: Date | null;

  @Column("tinyint", { name: "Estatus", nullable: true, default: () => "'1'" })
  estatus: number | null;

  @ManyToOne(() => Rutas, (rutas) => rutas.tarifas, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdRuta", referencedColumnName: "Id" }])
  IdRuta2: Rutas;
}
