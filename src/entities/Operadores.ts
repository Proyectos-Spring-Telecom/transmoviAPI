import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Vehiculos } from "./Vehiculos";

@Index("NumeroLicencia", ["NumeroLicencia"], { unique: true })
@Index("Correo", ["Correo"], { unique: true })
@Entity("Operadores", { schema: "TransmoviDev" })
export class Operadores {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  Id: number;

  @Column("varchar", { name: "Nombre", length: 255 })
  Nombre: string;

  @Column("varchar", { name: "ApellidoPaterno", length: 100 })
  ApellidoPaterno: string;

  @Column("varchar", { name: "ApellidoMaterno", nullable: true, length: 100 })
  ApellidoMaterno: string | null;

  @Column("varchar", { name: "NumeroLicencia", unique: true, length: 20 })
  NumeroLicencia: string;

  @Column("datetime", { name: "FechaNacimiento" })
  FechaNacimiento: Date;

  @Column("varchar", { name: "Correo", unique: true, length: 100 })
  Correo: string;

  @Column("varchar", { name: "Telefono", length: 10 })
  Telefono: string;

  @Column("tinyint", { name: "Estatus", default: () => "'1'" })
  estatus: number;

  @OneToMany(() => Vehiculos, (vehiculos) => vehiculos.IdOperador2)
  vehiculos: Vehiculos[];
}
