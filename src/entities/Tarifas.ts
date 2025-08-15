import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Rutas } from "./Rutas";

@Index("IdRuta", ["idRuta"], {})
@Entity("Tarifas", { schema: "TransmoviDev" })
export class Tarifas {
  @PrimaryGeneratedColumn({ type: "int", name: "Id" })
  id: number;

  @Column("int", { name: "IdRuta" })
  idRuta: number;

  @Column("decimal", { name: "TarifaBase", precision: 10, scale: 2 })
  tarifaBase: string;

  @Column("decimal", { name: "DistanciaBaseKm", precision: 10, scale: 2 })
  distanciaBaseKm: string;

  @Column("int", { name: "IncrementoCadaMetros" })
  incrementoCadaMetros: number;

  @Column("decimal", { name: "CostoAdicional", precision: 10, scale: 2 })
  costoAdicional: string;

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
  @JoinColumn([{ name: "IdRuta", referencedColumnName: "id" }])
  idRuta2: Rutas;
}
