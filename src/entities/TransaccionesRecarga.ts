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
@Entity('TransaccionesRecarga')
export class TransaccionesRecarga {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdTipoTransaccion' })
  idTipoTransaccion: number;

  @Column('tinyint', { name: 'ControlTransaccion' })
  controlTransaccion: number;

  @Column('decimal', { name: 'Monto', precision: 10, scale: 2 })
  monto: number;

  @Column('decimal', { name: 'Latitud', precision: 10, scale: 7, nullable: true })
  latitud: number | null;

  @Column('decimal', { name: 'Longitud', precision: 10, scale: 7, nullable: true })
  longitud: number | null;

  @Column('datetime', { name: 'FechaHora' })
  fechaHora: Date;

  @Column('datetime', {
    name: 'FHRegistro',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fhRegistro: Date;

  @Column('varchar', { name: 'NumeroSerieMonedero', length: 100 })
  numeroSerieMonedero: string;

  @Column('varchar', { name: 'NumeroSerieDispositivo', length: 100, nullable: true })
  numeroSerieDispositivo: string | null;

}
