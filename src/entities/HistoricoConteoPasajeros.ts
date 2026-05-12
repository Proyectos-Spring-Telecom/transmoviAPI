import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BlueVoxs } from './BlueVoxs';
import { Viajes } from './Viajes';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Index(
  'IX_HistoricoConteoPasajeros_Serie_FechaHora',
  ['numeroSerieBlueVox', 'fechaHora'],
  {},
)
@Index('FK_HistoricoConteoPasajeros_Viajes', ['idViaje'], {})
@Entity('HistoricoConteoPasajeros')
export class HistoricoConteoPasajeros {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('int', { name: 'Entradas', nullable: true, default: () => "'0'" })
  entradas: number | null;

  @Column('int', { name: 'Salidas', nullable: true, default: () => "'0'" })
  salidas: number | null;

  @Column('int', { name: 'Diferencia' })
  diferencia: number;

  @Column('datetime', { name: 'FechaHora' })
  fechaHora: Date;

  @Column('datetime', {
    name: 'FHRegistro',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fhRegistro: Date;

  @Column('tinyint', { name: 'Estatus', nullable: true })
  estatus: number | null;

  @Column('varchar', { name: 'NumeroSerieBlueVox', length: 100 })
  numeroSerieBlueVox: string;

  @Column('bigint', { name: 'IdViaje', nullable: true })
  idViaje: number | null;

  @ManyToOne(() => BlueVoxs, (blueVoxs) => blueVoxs.historicoConteoPasajeros, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([
    { name: 'NumeroSerieBlueVox', referencedColumnName: 'numeroSerie' },
  ])
  numeroSerieBlueVox2: BlueVoxs;

  @ManyToOne(() => Viajes, (viajes) => viajes.historicoConteoPasajeros, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([{ name: 'IdViaje', referencedColumnName: 'id' }])
  idViaje2: Viajes;
}
