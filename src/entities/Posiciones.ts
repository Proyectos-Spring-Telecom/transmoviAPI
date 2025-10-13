import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Dispositivos } from "./Dispositivos";
import { applySchema } from "src/common/apply-schema.decorator";

@applySchema
@Index(
  "IX_Posiciones_NumeroSerieDispositivo_FechaHora",
  ["fechaHora", "numeroSerieDispositivo"],
  {}
)
@Entity("Posiciones")
export class Posiciones {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("varchar", { name: "Exactitud", length: 1 })
  exactitud: string;

  @Column("tinyint", { name: "Estado", default: () => "'0'" })
  estado: number;

  @Column("decimal", { name: "Velocidad", precision: 10, scale: 2 })
  velocidad: number;

  @Column("decimal", { name: "Direccion", precision: 10, scale: 2 })
  direccion: number;

  @Column("decimal", { name: "Latitud", precision: 10, scale: 7 })
  latitud: number;

  @Column("decimal", { name: "Longitud", precision: 10, scale: 7 })
  longitud: number;

  @Column("datetime", { name: "FechaHora" })
  fechaHora: Date;

  @Column("datetime", {
    name: "FHRegistro",
    default: () => "CURRENT_TIMESTAMP",
  })
  fhRegistro: Date;

  @Column("varchar", { name: "NumeroSerieDispositivo", length: 100 })
  numeroSerieDispositivo: string;

  @ManyToOne(() => Dispositivos, (dispositivos) => dispositivos.posiciones, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([
    { name: "NumeroSerieDispositivo", referencedColumnName: "numeroSerie" },
  ])
  numeroSerieDispositivo2: Dispositivos;
}
