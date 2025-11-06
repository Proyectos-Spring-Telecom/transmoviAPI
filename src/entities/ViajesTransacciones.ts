import {
  Entity,
  JoinColumn,
  PrimaryColumn,
} from 'typeorm';
import { applySchema } from "src/common/apply-schema.decorator";
import { TransaccionesDebito } from './TransaccionesDebito';

@applySchema
@Entity('ViajesTransacciones')
export class ViajesTransacciones {
  @PrimaryColumn('bigint', { name: 'IdViaje' })
  idViaje: number;

  @PrimaryColumn('bigint', { name: 'IdTransaccion' })
  idTransaccion: number;

  @JoinColumn([{ name: 'IdTransaccion', referencedColumnName: 'id' }])
  transaccion: TransaccionesDebito;
}
