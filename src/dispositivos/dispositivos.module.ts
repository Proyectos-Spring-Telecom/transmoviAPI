import { Module } from '@nestjs/common';
import { DispositivosService } from './dispositivos.service';
import { DispositivosController } from './dispositivos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dispositivos } from 'src/entities/Dispositivos';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { ClientesModule } from 'src/clientes/clientes.module';
import { Instalaciones } from 'src/entities/Instalaciones';

@Module({
  imports: [TypeOrmModule.forFeature([Dispositivos, Instalaciones]), BitacoraModule,ClientesModule],
  controllers: [DispositivosController],
  providers: [DispositivosService],
  exports: [DispositivosService]
})
export class DispositivosModule {}
