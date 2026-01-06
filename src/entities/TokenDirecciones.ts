import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DireccionesTarjeta } from './DireccionesTarjeta';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Index('FK_Token_Direccion_idx', ['idDireccion'], {})
@Entity('TokenDirecciones')
export class TokenDirecciones {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdDireccion', nullable: false })
  idDireccion: number;

  @Column('varchar', { name: 'TokenCard', nullable: false, length: 255 })
  tokenCard: string;

  @ManyToOne(() => DireccionesTarjeta, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([{ name: 'IdDireccion', referencedColumnName: 'id' }])
  direccion: DireccionesTarjeta;
}

