import { Module } from '@nestjs/common';
import { DispositivosService } from './dispositivos.service';
import { DispositivosController } from './dispositivos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dispositivos } from 'src/entities/Dispositivos';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { ClientesModule } from 'src/clientes/clientes.module';

@Module({
  imports: [TypeOrmModule.forFeature([Dispositivos]), BitacoraModule,ClientesModule],
  controllers: [DispositivosController],
  providers: [DispositivosService],
})
export class DispositivosModule {}
