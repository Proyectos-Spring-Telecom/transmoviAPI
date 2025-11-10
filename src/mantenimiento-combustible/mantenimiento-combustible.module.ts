import { Module } from '@nestjs/common';
import { MantenimientoCombustibleService } from './mantenimiento-combustible.service';
import { MantenimientoCombustibleController } from './mantenimiento-combustible.controller';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MantenimientoCombustible } from 'src/entities/MantenimientoCombustible';

@Module({
  imports: [
    TypeOrmModule.forFeature([MantenimientoCombustible]),
    BitacoraModule,
  ],
  controllers: [MantenimientoCombustibleController],
  providers: [MantenimientoCombustibleService],
  exports: [MantenimientoCombustibleService],
})
export class MantenimientoCombustibleModule {}
