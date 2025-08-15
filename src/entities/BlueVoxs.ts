import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { ConteoPasajeros } from "./ConteoPasajeros";

@Index("Clave", ["clave"], { unique: true })
@Entity("BlueVoxs", { schema: "TransmoviDev" })
export class BlueVoxs {
  @PrimaryGeneratedColumn({ type: "int", name: "Id" })
  id: number;

  @Column("varchar", { name: "Clave", unique: true, length: 50 })
  clave: string;

  @Column("varchar", { name: "Descripcion", nullable: true, length: 100 })
  descripcion: string | null;

  @Column("tinyint", { name: "Estatus", nullable: true, default: () => "'1'" })
  estatus: number | null;

  @OneToMany(
    () => ConteoPasajeros,
    (conteoPasajeros) => conteoPasajeros.claveBlueVox2
  )
  conteoPasajeros: ConteoPasajeros[];
}
