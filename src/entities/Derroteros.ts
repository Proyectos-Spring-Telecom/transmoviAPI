import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Rutas } from "./Rutas";
import { Tarifas } from "./Tarifas";
import { Viajes } from "./Viajes";
import { applySchema } from "src/common/apply-schema.decorator";

@applySchema
@Index("FK_Derroteros_Rutas", ["idRuta"], {})
@Entity("Derroteros")
export class Derroteros {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("varchar", { name: "Nombre", length: 100 })
  nombre: string;

  @Column("json", { name: "PuntoInicio", nullable: true })
  puntoInicio: object | null;

  @Column("json", { name: "PuntoFin", nullable: true })
  puntoFin: object | null;

  @Column("json", { name: "RecorridoDetallado", nullable: true })
  recorridoDetallado: object | null;

  @Column("json", { name: "RecorridoInterpolar", nullable: true })
  recorridoInterpolar: object | null;

  @Column("decimal", {
    name: "DistanciaKm",
    nullable: true,
    precision: 10,
    scale: 2,
    default: () => "'0.00'",
  })
  distanciaKm: number | null;

  @Column("datetime", {
    name: "FechaCreacion",
    default: () => "CURRENT_TIMESTAMP",
  })
  fechaCreacion: Date;

 @Column("datetime", {
  name: "FechaActualizacion",
  default: () => "CURRENT_TIMESTAMP",
  onUpdate: "CURRENT_TIMESTAMP",
})
fechaActualizacion: Date;

  @Column("tinyint", { name: "Estatus", default: () => "'1'" })
  estatus: number;

  @Column("bigint", { name: "IdRuta" })
  idRuta: number;

  @ManyToOne(() => Rutas, (rutas) => rutas.derroteros, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdRuta", referencedColumnName: "id" }])
  idRuta2: Rutas;

  @OneToMany(() => Tarifas, (tarifas) => tarifas.idDerrotero2)
  tarifas: Tarifas[];

  @OneToMany(() => Viajes, (viajes) => viajes.idDerrotero2)
  viajes: Viajes[];
}
