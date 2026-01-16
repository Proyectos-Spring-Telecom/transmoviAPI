import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Instalaciones } from "./Instalaciones";
import { BlueVoxs } from "./BlueVoxs";
import { applySchema } from "src/common/apply-schema.decorator";

@applySchema
@Index("UQ_InstalacionesBlueVoxs_IdInstalacion_IdBlueVox", ["idInstalacion", "idBlueVox"], {
  unique: true,
})
@Index("FK_InstalacionesBlueVoxs_Instalaciones", ["idInstalacion"], {})
@Index("FK_InstalacionesBlueVoxs_BlueVoxs", ["idBlueVox"], {})
@Entity("InstalacionesBlueVoxs")
export class InstalacionesBlueVoxs {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

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

  @Column("bigint", { name: "IdInstalacion" })
  idInstalacion: number;

  @Column("bigint", { name: "IdBlueVox" })
  idBlueVox: number;

  @ManyToOne(() => Instalaciones, (instalaciones) => instalaciones.instalacionesBlueVoxs, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdInstalacion", referencedColumnName: "id" }])
  idInstalacion2: Instalaciones;

  @ManyToOne(() => BlueVoxs, (blueVoxs) => blueVoxs.instalacionesBlueVoxs, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdBlueVox", referencedColumnName: "id" }])
  idBlueVox2: BlueVoxs;
}
