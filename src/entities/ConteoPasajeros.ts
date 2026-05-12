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

/**
 * Entidad ConteoPasajeros
 *
 * Representa el conteo de pasajeros (entradas y salidas) registrado por un dispositivo BlueVox
 * en un momento específico. Está asociado a un viaje opcional.
 *
 * Relaciones:
 * - ManyToOne con BlueVoxs (a través de NumeroSerieBlueVox)
 * - ManyToOne con Viajes (a través de IdViaje, opcional)
 */
@applySchema
@Index(
  'IX_ConteoPasajeros_Serie_FechaHora',
  ['numeroSerieBlueVox', 'fechaHora'],
  {},
)
@Index('FK_ConteoPasajeros_Viajes', ['idViaje'], {})
@Entity('ConteoPasajeros')
export class ConteoPasajeros {
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

  // 🔹 RELACIÓN ManyToOne con BlueVoxs
  // El conteo está asociado a un BlueVox mediante su número de serie
  @ManyToOne(() => BlueVoxs, (blueVoxs) => blueVoxs.conteoPasajeros, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([
    { name: 'NumeroSerieBlueVox', referencedColumnName: 'numeroSerie' },
  ])
  numeroSerieBlueVox2: BlueVoxs;

  // 🔹 RELACIÓN ManyToOne con Viajes
  // El conteo puede estar asociado opcionalmente a un viaje
  @ManyToOne(() => Viajes, (viajes) => viajes.conteoPasajeros, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([{ name: 'IdViaje', referencedColumnName: 'id' }])
  idViaje2: Viajes;
}
