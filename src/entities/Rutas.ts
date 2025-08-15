import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { ConteoPasajeros } from "./ConteoPasajeros";
import { Tarifas } from "./Tarifas";

@Entity("Rutas", { schema: "TransmoviDev" })
export class Rutas {
  @PrimaryGeneratedColumn({ type: "int", name: "Id" })
  id: number;

  @Column("varchar", { name: "Nombre", length: 100 })
  nombre: string;

  @Column("tinyint", { name: "Estatus", nullable: true, default: () => "'1'" })
  estatus: number | null;

  @Column("json", { name: "PuntoInicio", nullable: true })
  puntoInicio: object | null;

  @Column("json", { name: "PuntoFin", nullable: true })
  puntoFin: object | null;

  @Column("json", { name: "RecorridoDetallado", nullable: true })
  recorridoDetallado: object | null;

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
    (conteoPasajeros) => conteoPasajeros.idRuta2
  )
  conteoPasajeros: ConteoPasajeros[];

  @OneToMany(() => Tarifas, (tarifas) => tarifas.idRuta2)
  tarifas: Tarifas[];
}
