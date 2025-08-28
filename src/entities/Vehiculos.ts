import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Operadores } from "./Operadores";
import { Dispositivos } from "./Dispositivos";

@Index("Placa", ["Placa"], { unique: true })
@Index("NumeroEconomico", ["NumeroEconomico"], { unique: true })
@Index("IdOperador", ["IdOperador"], {})
@Index("IdDispositivo", ["IdDispositivo"], {})
@Entity("Vehiculos", { schema: "TransmoviDev" })
export class Vehiculos {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  Id: number;

  @Column("varchar", { name: "Marca", length: 255 })
  Marca: string;

  @Column("varchar", { name: "Modelo", length: 100 })
  Modelo: string;

  @Column("int", { name: "Ano" })
  Ano: number;

  @Column("varchar", { name: "Placa", unique: true, length: 10 })
  Placa: string;

  @Column("varchar", { name: "NumeroEconomico", unique: true, length: 50 })
  NumeroEconomico: string;

  @Column("tinyint", { name: "Estatus", default: () => "'1'" })
  Estatus: number;

  @Column("bigint", { name: "IdOperador", nullable: true })
  IdOperador: string | null;

  @Column("bigint", { name: "IdDispositivo", nullable: true })
  IdDispositivo: string | null;

  @ManyToOne(() => Operadores, (operadores) => operadores.vehiculos, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "IdOperador", referencedColumnName: "Id" }])
  IdOperador2: Operadores;

  @ManyToOne(() => Dispositivos, (dispositivos) => dispositivos.vehiculos, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "IdDispositivo", referencedColumnName: "Id" }])
  IdDispositivo2: Dispositivos;
}
