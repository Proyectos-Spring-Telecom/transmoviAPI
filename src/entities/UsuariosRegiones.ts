import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Regiones } from "./Regiones";
import { Usuarios } from "./Usuarios";
import { applySchema } from "src/common/apply-schema.decorator";

@applySchema
@Index("FK_UsuariosRegiones_Usuarios", ["idUsuario"], {})
@Index("FK_UsuariosRegiones_Regiones", ["idRegion"], {})
@Entity("UsuariosRegiones")
export class UsuariosRegiones {
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

  @Column("bigint", { name: "IdUsuario" })
  idUsuario: number;

  @Column("bigint", { name: "IdRegion" })
  idRegion: number;

  @ManyToOne(() => Regiones, (regiones) => regiones.usuariosRegiones, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdRegion", referencedColumnName: "id" }])
  idRegion2: Regiones;

  @ManyToOne(() => Usuarios, (usuarios) => usuarios.usuariosRegiones, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdUsuario", referencedColumnName: "id" }])
  idUsuario2: Usuarios;
}
