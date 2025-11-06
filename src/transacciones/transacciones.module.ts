import { Module } from '@nestjs/common';
import { TransaccionesService } from './transacciones.service';
import { TransaccionesController } from './transacciones.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonederosModule } from 'src/monederos/monederos.module';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { Dispositivos } from 'src/entities/Dispositivos';
import { PasajerosModule } from 'src/pasajeros/pasajeros.module';
import { Clientes } from 'src/entities/Clientes';
import { TransaccionesRecarga } from 'src/entities/TransaccionesRecarga';
import { TransaccionesDebito } from 'src/entities/TransaccionesDebito';

@Module({
  imports: [
    TypeOrmModule.forFeature([TransaccionesRecarga, TransaccionesDebito, Dispositivos, Clientes]),
    MonederosModule,
    BitacoraModule,
    PasajerosModule,
  ],
  controllers: [TransaccionesController],
  providers: [TransaccionesService],
  exports: [TransaccionesService],
})
export class TransaccionesModule {}
