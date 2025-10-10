import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Viajes } from './Viajes';
import { Transacciones } from './Transacciones';

@Entity('ViajesTransacciones', { schema: `${process.env.DB_DATABASE}` })
export class ViajesTransacciones {
  @PrimaryColumn('bigint', { name: 'IdViaje' })
  idViaje: number;

  @PrimaryColumn('bigint', { name: 'IdTransaccion' })
  idTransaccion: number;

  @JoinColumn([{ name: 'IdTransaccion', referencedColumnName: 'id' }])
  transaccion: Transacciones;
}
