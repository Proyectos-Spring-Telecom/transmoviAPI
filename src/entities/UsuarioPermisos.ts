import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Index("FK_Usuarios", ["IdUsuario"], {})
@Entity("UsuariosPermisos", { schema: "TransmoviDev" })
export class UsuarioPermisos {
  @Column("bigint", { name: "IdUsuario" })
  IdUsuario: number;

  @Column("bigint", { name: "IdPermiso" })
  IdPermiso: number;

  @PrimaryGeneratedColumn({ type: "int", name: "Id" })
  Id: number;
}
