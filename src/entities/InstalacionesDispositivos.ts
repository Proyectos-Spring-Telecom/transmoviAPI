import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Instalaciones } from './Instalaciones';
import { Dispositivos } from './Dispositivos';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Index(
  'UQ_InstalacionesDispositivos_IdInstalacion_IdDispositivo',
  ['idInstalacion', 'idDispositivo'],
  { unique: true },
)
@Index('FK_InstalacionesDispositivos_Instalaciones', ['idInstalacion'], {})
@Index('FK_InstalacionesDispositivos_Dispositivos', ['idDispositivo'], {})
@Entity('InstalacionesDispositivos')
export class InstalacionesDispositivos {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

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

  @Column('bigint', { name: 'IdInstalacion' })
  idInstalacion: number;

  @Column('bigint', { name: 'IdDispositivo' })
  idDispositivo: number;

  @ManyToOne(
    () => Instalaciones,
    (instalaciones) => instalaciones.instalacionesDispositivos,
    {
      onDelete: 'NO ACTION',
      onUpdate: 'NO ACTION',
    },
  )
  @JoinColumn([{ name: 'IdInstalacion', referencedColumnName: 'id' }])
  idInstalacion2: Instalaciones;

  @ManyToOne(
    () => Dispositivos,
    (dispositivos) => dispositivos.instalacionesDispositivos,
    {
      onDelete: 'NO ACTION',
      onUpdate: 'NO ACTION',
    },
  )
  @JoinColumn([{ name: 'IdDispositivo', referencedColumnName: 'id' }])
  idDispositivo2: Dispositivos;
}
