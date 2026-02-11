import { Module, forwardRef } from '@nestjs/common';
import { ViajesService } from './viajes.service';
import { ViajesController } from './viajes.controller';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { Viajes } from 'src/entities/Viajes';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clientes } from 'src/entities/Clientes';
import { ConteoPasajeros } from 'src/entities/ConteoPasajeros';
import { TransaccionesDebito } from 'src/entities/TransaccionesDebito';
import { TransaccionesModule } from 'src/transacciones/transacciones.module';

@Module({
  imports: [TypeOrmModule.forFeature([Viajes, Clientes, ConteoPasajeros, TransaccionesDebito]), BitacoraModule, forwardRef(() => TransaccionesModule)],
  controllers: [ViajesController],
  providers: [ViajesService],
  exports: [ViajesService],
})
export class ViajesModule {}
