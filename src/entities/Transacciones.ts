import {
  Column,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Dispositivos } from "./Dispositivos";
import { Monederos } from "./Monederos";
import { Viajes } from "./Viajes";
import { applySchema } from "src/common/apply-schema.decorator";

@applySchema
@Index(
  "IX_Transacciones_NumeroSerieMonedero_FechaHora",
  ["fechaHora", "numeroSerieMonedero"],
  {}
)
@Index(
  "IX_Transacciones_NumeroSerieDispositivo_FechaHora",
  ["fechaHora", "numeroSerieDispositivo"],
  {}
)
@Entity("Transacciones")
export class Transacciones {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("varchar", { name: "TipoTransaccion", length: 10 })
  tipoTransaccion: string;

  @Column("decimal", { name: "Monto", precision: 10, scale: 2 })
  monto: number;

  @Column("decimal", {
    name: "Latitud",
    nullable: true,
    precision: 10,
    scale: 7,
  })
  latitud: number | null;

  @Column("decimal", {
    name: "Longitud",
    nullable: true,
    precision: 10,
    scale: 7,
  })
  longitud: number | null;

  @Column("datetime", { name: "FechaHora" })
  fechaHora: Date;

  @Column("datetime", {
    name: "FHRegistro",
    default: () => "CURRENT_TIMESTAMP",
  })
  fhRegistro: Date;

  @Column("varchar", { name: "NumeroSerieMonedero", length: 100 })
  numeroSerieMonedero: string;

  @Column("varchar", { name: "NumeroSerieDispositivo", length: 100 })
  numeroSerieDispositivo: string;

  @ManyToOne(() => Dispositivos, (dispositivos) => dispositivos.transacciones, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([
    { name: "NumeroSerieDispositivo", referencedColumnName: "numeroSerie" },
  ])
  numeroSerieDispositivo2: Dispositivos;

  @ManyToOne(() => Monederos, (monederos) => monederos.transacciones, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([
    { name: "NumeroSerieMonedero", referencedColumnName: "numeroSerie" },
  ])
  numeroSerieMonedero2: Monederos;

  @ManyToMany(() => Viajes, (viajes) => viajes.transacciones)
  @JoinTable({
    name: "ViajesTransacciones",
    joinColumns: [{ name: "IdTransaccion", referencedColumnName: "id" }],
    inverseJoinColumns: [{ name: "IdViaje", referencedColumnName: "id" }],
    schema: "TransmoviDev",
  })
  viajes: Viajes[];
}
