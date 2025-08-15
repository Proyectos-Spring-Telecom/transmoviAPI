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

@Index("Placa", ["placa"], { unique: true })
@Index("NumeroEconomico", ["numeroEconomico"], { unique: true })
@Index("IdOperador", ["idOperador"], {})
@Index("IdDispositivo", ["idDispositivo"], {})
@Entity("Vehiculos", { schema: "TransmoviDev" })
export class Vehiculos {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: string;

  @Column("varchar", { name: "Marca", length: 255 })
  marca: string;

  @Column("varchar", { name: "Modelo", length: 100 })
  modelo: string;

  @Column("int", { name: "Ano" })
  ano: number;

  @Column("varchar", { name: "Placa", unique: true, length: 10 })
  placa: string;

  @Column("varchar", { name: "NumeroEconomico", unique: true, length: 50 })
  numeroEconomico: string;

  @Column("tinyint", { name: "Estatus", default: () => "'1'" })
  estatus: number;

  @Column("bigint", { name: "IdOperador", nullable: true })
  idOperador: string | null;

  @Column("bigint", { name: "IdDispositivo", nullable: true })
  idDispositivo: string | null;

  @ManyToOne(() => Operadores, (operadores) => operadores.vehiculos, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "IdOperador", referencedColumnName: "id" }])
  idOperador2: Operadores;

  @ManyToOne(() => Dispositivos, (dispositivos) => dispositivos.vehiculos, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "IdDispositivo", referencedColumnName: "id" }])
  idDispositivo2: Dispositivos;
}
