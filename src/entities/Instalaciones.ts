import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { BlueVoxs } from "./BlueVoxs";
import { Clientes } from "./Clientes";
import { Dispositivos } from "./Dispositivos";
import { Vehiculos } from "./Vehiculos";
import { Turnos } from "./Turnos";
import { UsuariosInstalaciones } from "./UsuariosInstalaciones";
import { applySchema } from "src/common/apply-schema.decorator";

@applySchema
@Index(
  "IX_Instalaciones_IdCliente_IdDispositivo",
  ["idDispositivo", "idCliente"],
  {}
)
@Index("IX_Instalaciones_IdCliente_IdBlueVox", ["idBlueVox", "idCliente"], {})
@Index("IX_Instalaciones_IdCliente_IdVehiculo", ["idVehiculo", "idCliente"], {})
@Index("FK_Instalaciones_Clientes", ["idCliente"], {})
@Entity("Instalaciones")
export class Instalaciones {
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

  @Column("bigint", { name: "IdDispositivo" })
  idDispositivo: number;

  @Column("bigint", { name: "IdBlueVox" })
  idBlueVox: number;

  @Column("bigint", { name: "IdVehiculo" })
  idVehiculo: number;

  @Column("bigint", { name: "IdCliente" })
  idCliente: number;

  @ManyToOne(() => BlueVoxs, (blueVoxs) => blueVoxs.instalaciones, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([
    { name: "IdCliente", referencedColumnName: "idCliente" },
    { name: "IdBlueVox", referencedColumnName: "id" },
  ])
  blueVoxs: BlueVoxs;

  @ManyToOne(() => Clientes, (clientes) => clientes.instalaciones, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdCliente", referencedColumnName: "id" }])
  idCliente2: Clientes;

  @ManyToOne(() => Dispositivos, (dispositivos) => dispositivos.instalaciones, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([
    { name: "IdCliente", referencedColumnName: "idCliente" },
    { name: "IdDispositivo", referencedColumnName: "id" },
  ])
  dispositivos: Dispositivos;

  @ManyToOne(() => Vehiculos, (vehiculos) => vehiculos.instalaciones, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([
    { name: "IdCliente", referencedColumnName: "idCliente" },
    { name: "IdVehiculo", referencedColumnName: "id" },
  ])
  vehiculos: Vehiculos;

  @OneToMany(() => Turnos, (turnos) => turnos.idInstalacion2)
  turnos: Turnos[];

  @OneToMany(
    () => UsuariosInstalaciones,
    (usuariosInstalaciones) => usuariosInstalaciones.idInstalacion2
  )
  usuariosInstalaciones: UsuariosInstalaciones[];
}
