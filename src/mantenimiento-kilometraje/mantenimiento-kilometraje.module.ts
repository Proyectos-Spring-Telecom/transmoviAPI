import { Module } from '@nestjs/common';
import { MantenimientoKilometrajeService } from './mantenimiento-kilometraje.service';
import { MantenimientoKilometrajeController } from './mantenimiento-kilometraje.controller';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MantenimientoKilometraje } from 'src/entities/MantenimientoKilometraje';

@Module({
  imports: [
    TypeOrmModule.forFeature([MantenimientoKilometraje]),
    BitacoraModule,
  ],
  controllers: [MantenimientoKilometrajeController],
  providers: [MantenimientoKilometrajeService],
  exports: [MantenimientoKilometrajeService],
})
export class MantenimientoKilometrajeModule {}
