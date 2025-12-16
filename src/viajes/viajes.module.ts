import { Module } from '@nestjs/common';
import { ViajesService } from './viajes.service';
import { ViajesController } from './viajes.controller';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { Viajes } from 'src/entities/Viajes';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clientes } from 'src/entities/Clientes';
import { Turnos } from 'src/entities/Turnos';

@Module({
  imports: [TypeOrmModule.forFeature([Viajes, Clientes, Turnos]), BitacoraModule],
  controllers: [ViajesController],
  providers: [ViajesService],
})
export class ViajesModule {}
