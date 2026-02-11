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
@Index('FK_TransaccionesDebito_CatTiposTransacciones_idx', ['idTipoTransaccion'],)
@Index('FK_TransaccionesDebito_NumeroSerieMonedero_idx', ['numeroSerieMonedero'],)
@Index('FK_TransaccionesDebito_NumeroSerieDispositivo_idx', ['numeroSerieDispositivo'],)
@Entity('TransaccionesDebito')
export class TransaccionesDebito {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdTipoTransaccion' })
  idTipoTransaccion: number;

  @Column('decimal', { name: 'Monto', precision: 10, scale: 2 })
  monto: number;

  @Column('bigint', { name: 'IdControlTransaccion', nullable: true })
  idControlTransaccion: number | null;

  @Column('decimal', { name: 'LatitudInicial', precision: 10, scale: 7, nullable: true })
  latitudInicial: number | null;

  @Column('decimal', { name: 'LongitudInicial', precision: 10, scale: 7, nullable: true })
  longitudInicial: number | null;

  @Column('datetime', { name: 'FechaHoraInicio', nullable: true })
  fechaHoraInicio: Date | null;

  @Column('decimal', { name: 'DistanciaInicialKm', precision: 10, scale: 2, nullable: true })
  distanciaInicialKm: number | null;

  @Column('decimal', { name: 'LatitudFinal', precision: 10, scale: 7, nullable: true })
  latitudFinal: number | null;

  @Column('decimal', { name: 'LongitudFinal', precision: 10, scale: 7, nullable: true })
  longitudFinal: number | null;

  @Column('datetime', { name: 'FechaHoraFinal', nullable: true })
  fechaHoraFinal: Date;

  @Column('datetime', {
    name: 'FHRegistro',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fhRegistro: Date;

  @Column('varchar', { name: 'NumeroSerieMonedero', length: 100 })
  numeroSerieMonedero: string;

  @Column('varchar', { name: 'NumeroSerieDispositivo', length: 100 })
  numeroSerieDispositivo: string;

  @Column('bigint', { name: 'IdViajes', nullable: true })
  idViajes: number | null;

  @Column('bigint', { name: 'IdUsuario', nullable: true })
  idUsuario: number | null;

  @Column('varchar', { name: 'Contexto', nullable: true, length: 100 })
  contexto: string | null;
}