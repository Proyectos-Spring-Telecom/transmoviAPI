import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Index('FK_HistTransRec_NumeroSerieMonedero_idx', ['numeroSerieMonedero'], {})
@Index('FK_HistTransRec_NumeroSerieDispositivo_idx', ['numeroSerieDispositivo'], {})
@Index('FK_HistTransRec_CatTiposTransacciones_idx', ['idTipoTransaccion'], {})
@Index('FK_HistoricoTransaccionesRecarga_CatMetodoPago', ['idMetodoPago'], {})
@Index('FK_HistoricoTransaccionesRecarga_Usuarios', ['idUsuario'], {})
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

  @Column('bigint', { name: 'IdMetodoPago', nullable: true })
  idMetodoPago: number | null;

  @Column('decimal', {
    name: 'LatitudFinal',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  latitudFinal: number | null;

  @Column('decimal', {
    name: 'LongitudFinal',
    precision: 10,
    scale: 7,
    nullable: true,
  })
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

  @Column('varchar', {
    name: 'NumeroSerieDispositivo',
    length: 100,
    nullable: true,
  })
  numeroSerieDispositivo: string | null;

  @Column('bigint', { name: 'IdUsuario', nullable: true })
  idUsuario: number | null;

  // -------- RELACIONES --------

}
