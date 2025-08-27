import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { ConteoPasajeros } from "./ConteoPasajeros";
import { Tarifas } from "./Tarifas";

@Entity("Rutas", { schema: "TransmoviDev" })
export class Rutas {
  @PrimaryGeneratedColumn({ type: "int", name: "Id" })
  Id: number;

  @Column("varchar", { name: "Nombre", length: 100 })
  Nombre: string;

  @Column("tinyint", { name: "Estatus", nullable: true, default: () => "'1'" })
  estatus: number | null;

  @Column("json", { name: "PuntoInicio", nullable: true })
  PuntoInicio: object | null;

  @Column("json", { name: "PuntoFin", nullable: true })
  PuntoFin: object | null;

  @Column("json", { name: "RecorridoDetallado", nullable: true })
  RecorridoDetallado: object | null;

  @Column("decimal", {
    name: "DistanciaKm",
    nullable: true,
    precision: 10,
    scale: 2,
    default: () => "'0.00'",
  })
  distanciaKm: string | null;

  @OneToMany(
    () => ConteoPasajeros,
    (conteoPasajeros) => conteoPasajeros.IdRuta2
  )
  conteoPasajeros: ConteoPasajeros[];

  @OneToMany(() => Tarifas, (tarifas) => tarifas.IdRuta2)
  tarifas: Tarifas[];
}
