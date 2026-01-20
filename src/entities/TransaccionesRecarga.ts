import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Index('FK_TransaccionesRecargas_CatTiposTransacciones_idx', ['idTipoTransaccion'], {})
@Index('FK_TransaccionesRecarga_NumeroSerieMonedero_idx', ['numeroSerieMonedero'], {})
@Index('FK_TransaccionesRecarga_NumeroSerieDispositivo_idx', ['numeroSerieDispositivo'], {})
@Index('FK_TransaccionesRecarga_CatMetodoPago', ['idMetodoPago'], {})
@Entity('TransaccionesRecarga')
export class TransaccionesRecarga {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdTipoTransaccion' })
  idTipoTransaccion: number;

  @Column('varchar', { name: 'ControlTransaccion', nullable: true, length: 30 })
  controlTransaccion: string | null;

  @Column('decimal', { name: 'Monto', precision: 10, scale: 2 })
  monto: number;

  @Column('bigint', { name: 'IdMetodoPago' })
  idMetodoPago: number;

  @Column('decimal', { name: 'LatitudFinal', precision: 10, scale: 7, nullable: true })
  latitudFinal: number | null;

  @Column('decimal', { name: 'LongitudFinal', precision: 10, scale: 7, nullable: true })
  longitudFinal: number | null;

  @Column('datetime', { name: 'FechaHoraFinal' })
  fechaHoraFinal: Date;

  @Column('datetime', {
    name: 'FHRegistro',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fhRegistro: Date;

  @Column('varchar', { name: 'NumeroSerieMonedero', length: 100 })
  numeroSerieMonedero: string;

  @Column('varchar', { name: 'NumeroSerieDispositivo', length: 100, nullable: true })
  numeroSerieDispositivo: string | null;

  @Column('bigint', { name: 'IdUsuario', nullable: true  })
  idUsuario: number;

}
