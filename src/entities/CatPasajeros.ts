import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
@applySchema
@Index('FK_CatPasajeros_Clientes_idx', ['idCliente'], {})
@Entity('CatPasajeros')
export class CatPasajero {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'IdTipoPasajero' })
  idTipoPasajero: number;

  @Column('varchar', { name: 'Nombre', length: 50 })
  nombre: string;

  @Column('tinyint', { name: 'TipoDescuento', unsigned: true })
  tipoDescuento: number;

  @Column('int', { name: 'Cantidad', unsigned: true })
  cantidad: number | null;

  @Column('tinyint', { name: 'Estatus', unsigned: true })
  estatus: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;
}
