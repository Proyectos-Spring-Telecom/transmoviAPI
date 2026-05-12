import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Index('FK_HistoricoInstalaciones_Instalaciones', ['idInstalacion'], {})
@Index('FK_HistoricoInstalaciones_Dispositivo', ['idDispositivo'], {})
@Index('FK_HistoricoInstalaciones_Vehiculo', ['idVehiculo'], {})
@Index('FK_HistoricoInstalaciones_Cliente', ['idCliente'], {})
@Entity('HistoricoInstalaciones')
export class HistoricoInstalaciones {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdInstalacion' })
  idInstalacion: number;

  @Column('bigint', { name: 'IdDispositivo' })
  idDispositivo: number;

  @Column('json', { name: 'IdsDispositivos', nullable: true })
  idsDispositivos: Array<{ Id: number; NumeroSerie: string }> | null;

  @Column('json', { name: 'IdsBlueVoxs', nullable: false })
  idsBlueVoxs: Array<{ Id: number; NumeroSerie: string }>;

  @Column('bigint', { name: 'IdVehiculo' })
  idVehiculo: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @Column('datetime', {
    name: 'FechaCreacion',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fechaCreacion: Date;

  @Column('datetime', { name: 'FechaBaja', nullable: true })
  fechaBaja: Date | null;

  @Column('text', { name: 'Comentario', nullable: true })
  comentario: string | null;
}
