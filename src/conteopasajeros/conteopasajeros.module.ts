import { Module } from '@nestjs/common';
import { ConteopasajerosService } from './conteopasajeros.service';
import { ConteopasajerosController } from './conteopasajeros.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConteoPasajeros } from 'src/entities/ConteoPasajeros';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { BlueVoxs } from 'src/entities/BlueVoxs';
import { Usuarios } from 'src/entities/Usuarios';
import { Clientes } from 'src/entities/Clientes';

@Module({
  imports: [TypeOrmModule.forFeature([ConteoPasajeros, BlueVoxs, Usuarios, Clientes]), BitacoraModule],
  controllers: [ConteopasajerosController],
  providers: [ConteopasajerosService],
})
export class ConteopasajerosModule { }
