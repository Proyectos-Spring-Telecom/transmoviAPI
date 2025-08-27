import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("Pasajeros", { schema: "TransmoviDev" })
export class Pasajeros {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  Id: number;

  @Column("varchar", { name: "Nombre", length: 100 })
  Nombre: string;

  @Column("varchar", { name: "ApellidoPaterno", length: 100 })
  ApellidoPaterno: string;

  @Column("varchar", { name: "ApellidoMaterno", nullable: true, length: 100 })
  ApellidoMaterno: string | null;

  @Column("datetime", { name: "FechaNacimiento" })
  FechaNacimiento: Date;

  @Column("varchar", { name: "Correo", nullable: true, length: 100 })
  Correo: string | null;

  @Column("varchar", { name: "Telefono", nullable: true, length: 15 })
  Telefono: string | null;

  @Column("tinyint", { name: "Estatus", default: () => "'1'" })
  Estatus: number;
}
