import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Index("FK_Usuarios", ["idUsuario"], {})
@Entity("UsuariosPermisos", { schema: "TransmoviDev" })
export class UsuarioPermisos {
  @Column("bigint", { name: "IdUsuario" })
  idUsuario: number;

  @Column("bigint", { name: "IdPermiso" })
  idPermiso: number;

  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id: number;
}
