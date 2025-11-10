import { Module } from '@nestjs/common';
import { MantenimientoVehicularService } from './mantenimiento-vehicular.service';
import { MantenimientoVehicularController } from './mantenimiento-vehicular.controller';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MantenimientoVehicular } from 'src/entities/MantenimientoVehicular';

@Module({
  imports: [
    TypeOrmModule.forFeature([MantenimientoVehicular]),
    BitacoraModule,
  ],
  controllers: [MantenimientoVehicularController],
  providers: [MantenimientoVehicularService],
  exports: [MantenimientoVehicularService],
})
export class MantenimientoVehicularModule {}
