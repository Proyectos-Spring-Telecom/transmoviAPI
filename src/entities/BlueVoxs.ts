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
import { ConteoPasajeros } from './ConteoPasajeros';
import { Instalaciones } from './Instalaciones';
import { InstalacionesBlueVoxs } from './InstalacionesBlueVoxs';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Index('UQ_BlueVoxs_NumeroSerie', ['numeroSerie'], { unique: true })
@Index('UQ_BlueVoxs_IdCliente_Id', ['id', 'idCliente'], { unique: true })
@Index('FK_BlueVoxs_Clientes', ['idCliente'], {})
@Entity('BlueVoxs')
export class BlueVoxs {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'NumeroSerie', unique: true, length: 100 })
  numeroSerie: string;

  @Column('varchar', { name: 'Marca', nullable: true, length: 100 })
  marca: string | null;

  @Column('varchar', { name: 'Modelo', nullable: true, length: 100 })
  modelo: string | null;

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

  @Column('tinyint',{ name: 'EstadoActual', unsigned: true })
  estadoActual: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @ManyToOne(() => Clientes, (clientes) => clientes.blueVoxs, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([{ name: 'IdCliente', referencedColumnName: 'id' }])
  idCliente2: Clientes;

  @OneToMany(
    () => ConteoPasajeros,
    (conteoPasajeros) => conteoPasajeros.numeroSerieBlueVox2,
  )
  conteoPasajeros: ConteoPasajeros[];

  // Relación correcta según BD:
  // BlueVoxs.IdInstalaciones (FK) -> Instalaciones.Id


  @OneToMany(() => InstalacionesBlueVoxs, (instalacionesBlueVoxs) => instalacionesBlueVoxs.idBlueVox2)
  instalacionesBlueVoxs: InstalacionesBlueVoxs[];
}
