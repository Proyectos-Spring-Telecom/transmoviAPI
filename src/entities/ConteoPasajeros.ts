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

@Index("ClaveBlueVox", ["ClaveBlueVox"], {})
@Index("IdRuta", ["IdRuta"], {})
@Entity("ConteoPasajeros", { schema: "TransmoviDev" })
export class ConteoPasajeros {
  @PrimaryGeneratedColumn({ type: "int", name: "Id" })
  Id: number;

  @Column("varchar", { name: "ClaveBlueVox", length: 50 })
  ClaveBlueVox: string;

  @Column("int", { name: "Entradas", nullable: true, default: () => "'0'" })
  entradas: number | null;

  @Column("int", { name: "Salidas", nullable: true, default: () => "'0'" })
  salidas: number | null;

  @Column("int", { name: "Diferencia" })
  Diferencia: number;

  @Column("datetime", { name: "FechaHora" })
  FechaHora: Date;

  @Column("varchar", { name: "FolioViaje", length: 50 })
  FolioViaje: string;

  @Column("int", { name: "IdRuta" })
  IdRuta: number;

  @ManyToOne(() => BlueVoxs, (blueVoxs) => blueVoxs.conteoPasajeros, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "ClaveBlueVox", referencedColumnName: "Clave" }])
  ClaveBlueVox2: BlueVoxs;

  @ManyToOne(() => Rutas, (rutas) => rutas.conteoPasajeros, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdRuta", referencedColumnName: "Id" }])
  IdRuta2: Rutas;
}
