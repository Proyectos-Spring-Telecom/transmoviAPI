import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Derroteros } from "./Derroteros";

@Index("FK_Tarifas_Derroteros", ["idDerrotero"], {})
@Entity("Tarifas", { schema: "TransmoviDev" })
export class Tarifas {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: string;

  @Column("decimal", { name: "TarifaBase", precision: 10, scale: 2 })
  tarifaBase: string;

  @Column("decimal", { name: "DistanciaBaseKm", precision: 10, scale: 2 })
  distanciaBaseKm: string;

  @Column("int", { name: "IncrementoCadaMetros" })
  incrementoCadaMetros: number;

  @Column("decimal", { name: "CostoAdicional", precision: 10, scale: 2 })
  costoAdicional: string;

  @Column("datetime", {
    name: "FechaCreacion",
    default: () => "CURRENT_TIMESTAMP",
  })
  fechaCreacion: Date;

  @Column("datetime", {
    name: "FechaActualizacion",
    default: () => "CURRENT_TIMESTAMP",
  })
  fechaActualizacion: Date;

  @Column("tinyint", { name: "Estatus", default: () => "'1'" })
  estatus: number;

  @Column("bigint", { name: "IdDerrotero" })
  idDerrotero: string;

  @ManyToOne(() => Derroteros, (derroteros) => derroteros.tarifas, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdDerrotero", referencedColumnName: "id" }])
  idDerrotero2: Derroteros;
}
