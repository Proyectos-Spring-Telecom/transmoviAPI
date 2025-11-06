import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Derroteros } from "./Derroteros";
import { applySchema } from "src/common/apply-schema.decorator";

@applySchema
@Index("FK_Tarifas_Derroteros", ["idDerrotero"], {})
@Entity("Tarifas")
export class Tarifas {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("decimal", { name: "TarifaBase", precision: 10, scale: 2 })
  tarifaBase: number;

  @Column("decimal", { name: "DistanciaBaseKm", precision: 10, scale: 2,  nullable: true })
  distanciaBaseKm: number;

  @Column("int", { name: "IncrementoCadaMetros",  nullable: true })
  incrementoCadaMetros: number;

  @Column("decimal", { name: "CostoAdicional", precision: 10, scale: 2,  nullable: true })
  costoAdicional: number;

  @Column("int", { name: "TipoTarifa",  unsigned: true })
  tipoTarifa: number;

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
  idDerrotero: number;

  @ManyToOne(() => Derroteros, (derroteros) => derroteros.tarifas, {
    onDelete: "CASCADE",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdDerrotero", referencedColumnName: "id" }])
  idDerrotero2: Derroteros;
}
