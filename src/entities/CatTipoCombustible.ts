import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Entity('CatTipoCombustible')
export class CatTipoCombustible {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Nombre', length: 100 })
  nombre: string;
}
