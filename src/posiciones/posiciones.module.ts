import { Module } from '@nestjs/common';
import { PosicionesService } from './posiciones.service';
import { PosicionesController } from './posiciones.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Posiciones } from 'src/entities/Posiciones';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { Usuarios } from 'src/entities/Usuarios';
import { Clientes } from 'src/entities/Clientes';
import { Validadores } from 'src/entities/Validadores';
import { UsuariosZonas } from 'src/entities/UsuariosZonas';

@Module({
  imports: [TypeOrmModule.forFeature([Posiciones, Validadores, Usuarios, Clientes, UsuariosZonas]), BitacoraModule],
  controllers: [PosicionesController],
  providers: [PosicionesService],
})
export class PosicionesModule { }
