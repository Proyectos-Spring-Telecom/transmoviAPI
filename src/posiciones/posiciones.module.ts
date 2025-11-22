import { Module } from '@nestjs/common';
import { PosicionesService } from './posiciones.service';
import { PosicionesController } from './posiciones.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Posiciones } from 'src/entities/Posiciones';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { Dispositivos } from 'src/entities/Dispositivos';
import { Usuarios } from 'src/entities/Usuarios';
import { Clientes } from 'src/entities/Clientes';

@Module({
  imports: [TypeOrmModule.forFeature([Posiciones, Dispositivos, Usuarios, Clientes]), BitacoraModule],
  controllers: [PosicionesController],
  providers: [PosicionesService],
})
export class PosicionesModule { }
