import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Dispositivos } from "./Dispositivos";

@Index(
  "IX_Posiciones_NumeroSerieDispositivo_FechaHora",
  ["fechaHora", "numeroSerieDispositivo"],
  {}
)
@Entity("Posiciones", { schema: "TransmoviDev" })
export class Posiciones {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: string;

  @Column("varchar", { name: "Exactitud", length: 1 })
  exactitud: string;

  @Column("tinyint", { name: "Estado", default: () => "'0'" })
  estado: number;

  @Column("decimal", { name: "Velocidad", precision: 10, scale: 2 })
  velocidad: string;

  @Column("decimal", { name: "Direccion", precision: 10, scale: 2 })
  direccion: string;

  @Column("decimal", { name: "Latitud", precision: 10, scale: 7 })
  latitud: string;

  @Column("decimal", { name: "Longitud", precision: 10, scale: 7 })
  longitud: string;

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
