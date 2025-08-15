import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Vehiculos } from "./Vehiculos";

@Index("NumeroLicencia", ["numeroLicencia"], { unique: true })
@Index("Correo", ["correo"], { unique: true })
@Entity("Operadores", { schema: "TransmoviDev" })
export class Operadores {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: string;

  @Column("varchar", { name: "Nombre", length: 255 })
  nombre: string;

  @Column("varchar", { name: "ApellidoPaterno", length: 100 })
  apellidoPaterno: string;

  @Column("varchar", { name: "ApellidoMaterno", nullable: true, length: 100 })
  apellidoMaterno: string | null;

  @Column("varchar", { name: "NumeroLicencia", unique: true, length: 20 })
  numeroLicencia: string;

  @Column("datetime", { name: "FechaNacimiento" })
  fechaNacimiento: Date;

  @Column("varchar", { name: "Correo", unique: true, length: 100 })
  correo: string;

  @Column("varchar", { name: "Telefono", length: 10 })
  telefono: string;

  @Column("tinyint", { name: "Estatus", default: () => "'1'" })
  estatus: number;

  @OneToMany(() => Vehiculos, (vehiculos) => vehiculos.idOperador2)
  vehiculos: Vehiculos[];
}
