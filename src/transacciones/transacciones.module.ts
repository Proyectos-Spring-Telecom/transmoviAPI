import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TransaccionesService } from './transacciones.service';
import { TransaccionesCronService } from './transacciones-cron.service';
import { TransaccionesController } from './transacciones.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonederosModule } from 'src/monederos/monederos.module';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { Dispositivos } from 'src/entities/Dispositivos';
import { PasajerosModule } from 'src/pasajeros/pasajeros.module';
import { Clientes } from 'src/entities/Clientes';
import { TransaccionesRecarga } from 'src/entities/TransaccionesRecarga';
import { TransaccionesDebito } from 'src/entities/TransaccionesDebito';
import { Monederos } from 'src/entities/Monederos';
import { CatTiposPasajeros } from 'src/entities/CatTiposPasajeros';
import { HistoricoTransaccionesDebito } from 'src/entities/HistoricoTransaccionesDebito';
import { HistoricoTransaccionesRecarga } from 'src/entities/HistoricoTransaccionesRecarga';
import { Viajes } from 'src/entities/Viajes';
import { CatMetodoPago } from 'src/entities/CatMetodoPago';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([TransaccionesRecarga, TransaccionesDebito, HistoricoTransaccionesDebito, HistoricoTransaccionesRecarga, Dispositivos, Clientes, Monederos, CatTiposPasajeros, Viajes, CatMetodoPago]),
    MonederosModule,
    BitacoraModule,
    PasajerosModule,
  ],
  controllers: [TransaccionesController],
  providers: [TransaccionesService, TransaccionesCronService],
  exports: [TransaccionesService],
})
export class TransaccionesModule { }
