import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Clientes } from './Clientes';
import { Instalaciones } from './Instalaciones';
import { Posiciones } from './Posiciones';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Index('UQ_Dispositivos_NumeroSerie', ['numeroSerie'], { unique: true })
@Index('UQ_Dispositivos_IdCliente_Id', ['id', 'idCliente'], { unique: true })
@Index('FK_Dispositivos_Clientes', ['idCliente'], {})
@Entity('Dispositivos')
export class Dispositivos {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'NumeroSerie', unique: true, length: 100 })
  numeroSerie: string;

  @Column('varchar', { name: 'Marca', length: 100 })
  marca: string;

  @Column('varchar', { name: 'Modelo', length: 100 })
  modelo: string;

  @Column('datetime', {
    name: 'FechaCreacion',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fechaCreacion: Date;

  @Column('datetime', {
    name: 'FechaActualizacion',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fechaActualizacion: Date;

  @Column('tinyint', { name: 'Estatus', default: () => "'1'" })
  estatus: number;

  @Column('tinyint', { name: 'EstadoActual', unsigned: true })
  estadoActual: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @ManyToOne(() => Clientes, (clientes) => clientes.dispositivos, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([{ name: 'IdCliente', referencedColumnName: 'id' }])
  idCliente2: Clientes;

  @OneToMany(() => Instalaciones, (instalaciones) => instalaciones.dispositivos)
  instalaciones: Instalaciones[];

  @OneToMany(
    () => Posiciones,
    (posiciones) => posiciones.numeroSerieDispositivo2,
  )
  posiciones: Posiciones[];


}
