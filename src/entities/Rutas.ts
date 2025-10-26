import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Derroteros } from './Derroteros';
import { Regiones } from './Regiones';
import { applySchema } from "src/common/apply-schema.decorator";

@applySchema
@Index('FK_Rutas_Regiones', ['idRegion'], {})
@Entity('Rutas')
export class Rutas {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Nombre', length: 100 })
  nombre: string;

  @Column('json', { name: 'PuntoInicio', nullable: true })
  puntoInicio: object | null;

  @Column('varchar', { name: 'NombreInicio', length: 200, nullable: true })
  nombreInicio: string | null;

  @Column('json', { name: 'PuntoFin', nullable: true })
  puntoFin: object | null;

  @Column('varchar', { name: 'NombreFin', length: 200, nullable: true })
  nombreFin: string | null;

  @Column('datetime', {
    name: 'FechaCreacion',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fechaCreacion: Date;

  @Column('datetime', {
    name: 'FechaActualizacion',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  fechaActualizacion: Date;

  @Column('tinyint', { name: 'Estatus', default: () => "'1'" })
  estatus: number;

  @Column('bigint', { name: 'IdRegion' })
  idRegion: number;

  @Column("bigint", { name: "IdRegionFin", nullable: true })
  idRegionFin: number | null;

  @OneToMany(() => Derroteros, (derroteros) => derroteros.idRuta2)
  derroteros: Derroteros[];

  @ManyToOne(() => Regiones, (regiones) => regiones.rutas, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([{ name: 'IdRegion', referencedColumnName: 'id' }])
  idRegion2: Regiones;

  @ManyToOne(() => Regiones, { nullable: true })
  @JoinColumn([{ name: "IdRegionFin", referencedColumnName: "id" }])
  idRegionFin2: Regiones | null;
}
