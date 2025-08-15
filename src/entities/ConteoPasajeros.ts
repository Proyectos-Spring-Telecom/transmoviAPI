import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { BlueVoxs } from "./BlueVoxs";
import { Rutas } from "./Rutas";

@Index("ClaveBlueVox", ["claveBlueVox"], {})
@Index("IdRuta", ["idRuta"], {})
@Entity("ConteoPasajeros", { schema: "TransmoviDev" })
export class ConteoPasajeros {
  @PrimaryGeneratedColumn({ type: "int", name: "Id" })
  id: number;

  @Column("varchar", { name: "ClaveBlueVox", length: 50 })
  claveBlueVox: string;

  @Column("int", { name: "Entradas", nullable: true, default: () => "'0'" })
  entradas: number | null;

  @Column("int", { name: "Salidas", nullable: true, default: () => "'0'" })
  salidas: number | null;

  @Column("int", { name: "Diferencia" })
  diferencia: number;

  @Column("datetime", { name: "FechaHora" })
  fechaHora: Date;

  @Column("varchar", { name: "FolioViaje", length: 50 })
  folioViaje: string;

  @Column("int", { name: "IdRuta" })
  idRuta: number;

  @ManyToOne(() => BlueVoxs, (blueVoxs) => blueVoxs.conteoPasajeros, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "ClaveBlueVox", referencedColumnName: "clave" }])
  claveBlueVox2: BlueVoxs;

  @ManyToOne(() => Rutas, (rutas) => rutas.conteoPasajeros, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdRuta", referencedColumnName: "id" }])
  idRuta2: Rutas;
}
