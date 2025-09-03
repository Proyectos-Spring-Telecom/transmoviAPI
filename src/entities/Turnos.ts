import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Clientes } from "./Clientes";
import { Instalaciones } from "./Instalaciones";
import { Operadores } from "./Operadores";
import { Viajes } from "./Viajes";

@Index("UQ_Turnos_IdCliente_Id", ["id", "idCliente"], { unique: true })
@Index("IX_Turnos_IdOperador_Inicio", ["inicio", "idOperador"], {})
@Index("IX_Turnos_IdCliente_Inicio", ["inicio", "idCliente"], {})
@Index("FK_Turnos_Clientes", ["idCliente"], {})
@Index("FK_Turnos_Operadores", ["idOperador"], {})
@Index("FK_Turnos_Instalaciones", ["idInstalacion"], {})
@Entity("Turnos", { schema: "TransmoviDev" })
export class Turnos {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: string;

  @Column("datetime", { name: "Inicio" })
  inicio: Date;

  @Column("datetime", { name: "Fin", nullable: true })
  fin: Date | null;

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

  @Column("bigint", { name: "IdCliente" })
  idCliente: string;

  @Column("bigint", { name: "IdOperador" })
  idOperador: string;

  @Column("bigint", { name: "IdInstalacion" })
  idInstalacion: string;

  @ManyToOne(() => Clientes, (clientes) => clientes.turnos, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdCliente", referencedColumnName: "id" }])
  idCliente2: Clientes;

  @ManyToOne(() => Instalaciones, (instalaciones) => instalaciones.turnos, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdInstalacion", referencedColumnName: "id" }])
  idInstalacion2: Instalaciones;

  @ManyToOne(() => Operadores, (operadores) => operadores.turnos, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdOperador", referencedColumnName: "id" }])
  idOperador2: Operadores;

  @OneToMany(() => Viajes, (viajes) => viajes.idTurno2)
  viajes: Viajes[];
}
