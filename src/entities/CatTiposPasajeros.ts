import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
@applySchema
@Index('FK_CatPasajeros_Clientes_idx', ['idCliente'], {})
@Entity('CatTiposPasajeros')
export class CatTiposPasajeros {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Nombre', length: 50 })
  nombre: string;

  @Column('tinyint', { name: 'IdCatTipoDescuento', nullable: false })
  idCatTipoDescuento: number;

  @Column('int', { name: 'Cantidad', unsigned: true })
  cantidad: number | null;

  @Column('tinyint', { name: 'Estatus', unsigned: true })
  estatus: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;
}
