import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Index('FK_HistTransRec_NumeroSerieMonedero_idx', ['numeroSerieMonedero'], {})
@Index('FK_HistTransRec_NumeroSerieValidador_idx', ['numeroSerieValidador'], {})
@Index('FK_HistTransRec_CatTiposTransacciones_idx', ['idTipoTransaccion'], {})
@Entity('HistoricoTransaccionesRecarga')
export class HistoricoTransaccionesRecarga {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdTipoTransaccion' })
  idTipoTransaccion: number;

  @Column('varchar', { name: 'ControlTransaccion', nullable: true, length: 30 })
  controlTransaccion: string | null;

  @Column('decimal', { name: 'Monto', precision: 10, scale: 2 })
  monto: number;

  @Column('decimal', {
    name: 'Latitud',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  latitud: number | null;

  @Column('decimal', {
    name: 'Longitud',
    precision: 10,
    scale: 7,
    nullable: true,
  })
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

  @Column('varchar', {
    name: 'NumeroSerieValidador',
    length: 100,
    nullable: true,
  })
  numeroSerieValidador: string | null;

  // -------- RELACIONES --------

}
