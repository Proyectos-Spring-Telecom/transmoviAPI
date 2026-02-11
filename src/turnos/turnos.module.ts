import { Module } from '@nestjs/common';
import { TurnosService } from './turnos.service';
import { TurnosController } from './turnos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Turnos } from 'src/entities/Turnos';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { Clientes } from 'src/entities/Clientes';
import { Viajes } from 'src/entities/Viajes';
import { ViajesModule } from 'src/viajes/viajes.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Turnos, Clientes, Viajes]),
    BitacoraModule,
    ViajesModule,
  ],
  controllers: [TurnosController],
  providers: [TurnosService],
  exports: [TurnosService],
})
export class TurnosModule {}
