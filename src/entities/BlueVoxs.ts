import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { ConteoPasajeros } from "./ConteoPasajeros";

@Index("Clave", ["Clave"], { unique: true })
@Entity("BlueVoxs", { schema: "TransmoviDev" })
export class BlueVoxs {
  @PrimaryGeneratedColumn({ type: "int", name: "Id" })
  Id: number;

  @Column("varchar", { name: "Clave", unique: true, length: 50 })
  Clave: string;

  @Column("varchar", { name: "Descripcion", nullable: true, length: 100 })
  Descripcion: string | null;

  @Column("tinyint", { name: "Estatus", nullable: true, default: () => "'1'" })
  estatus: number | null;

  @OneToMany(
    () => ConteoPasajeros,
    (conteoPasajeros) => conteoPasajeros.ClaveBlueVox2
  )
  conteoPasajeros: ConteoPasajeros[];
}
