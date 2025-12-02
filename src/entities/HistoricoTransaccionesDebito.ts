import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Index('FK_HistTransDeb_NumeroSerieMonedero_idx', ['numeroSerieMonedero'], {})
@Index('FK_HistTransDeb_NumeroSerieValidador_idx', ['numeroSerieValidador'], {})
@Index('FK_HistTransDeb_CatTiposTransacciones_idx', ['idTipoTransaccion'], {})
@Entity('HistoricoTransaccionesDebito')
export class HistoricoTransaccionesDebito {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdTipoTransaccion' })
  idTipoTransaccion: number;

  @Column('tinyint', { name: 'ControlTransaccion', nullable: true, unsigned: true })
  controlTransaccion: number | null;

  @Column('decimal', { name: 'Monto', precision: 10, scale: 2 })
  monto: number;

  @Column('decimal', { name: 'LatitudInicial', precision: 10, scale: 7, nullable: true })
  latitudInicial: number | null;

  @Column('decimal', { name: 'LongitudInicial', precision: 10, scale: 7, nullable: true })
  longitudInicial: number | null;

  @Column('datetime', { name: 'FechaHoraInicio', nullable: true })
  fechaHoraInicio: Date | null;

  @Column('decimal', { name: 'DistanciaInicialKm', precision: 10, scale: 2, nullable: true })
  distanciaInicialKm: number | null;

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

  @Column('varchar', { name: 'NumeroSerieValidador', length: 100 })
  numeroSerieValidador: string;

  // -------- RELACIONES --------

}
