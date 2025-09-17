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
import { BlueVoxs } from "./BlueVoxs";
import { Viajes } from "./Viajes";

@Index(
  "IX_ConteoPasajeros_Serie_FechaHora",
  ["fechaHora", "numeroSerieBlueVox"],
  {}
)
@Entity("ConteoPasajeros", { schema: "TransmoviDev" })
export class ConteoPasajeros {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("int", { name: "Entradas", nullable: true, default: () => "'0'" })
  entradas: number | null;

  @Column("int", { name: "Salidas", nullable: true, default: () => "'0'" })
  salidas: number | null;

  @Column("int", { name: "Diferencia" })
  diferencia: number;

  @Column("datetime", { name: "FechaHora" })
  fechaHora: Date;

  @Column("datetime", {
    name: "FHRegistro",
    default: () => "CURRENT_TIMESTAMP",
  })
  fhRegistro: Date;

  @Column("varchar", { name: "NumeroSerieBlueVox", length: 100 })
  numeroSerieBlueVox: string;

  @ManyToOne(() => BlueVoxs, (blueVoxs) => blueVoxs.conteoPasajeros, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([
    { name: "NumeroSerieBlueVox", referencedColumnName: "numeroSerie" },
  ])
  numeroSerieBlueVox2: BlueVoxs;

  @ManyToMany(() => Viajes, (viajes) => viajes.conteoPasajeros)
  @JoinTable({
    name: "ViajesConteos",
    joinColumns: [{ name: "IdConteo", referencedColumnName: "id" }],
    inverseJoinColumns: [{ name: "IdViaje", referencedColumnName: "id" }],
    schema: "TransmoviDev",
  })
  viajes: Viajes[];
}
