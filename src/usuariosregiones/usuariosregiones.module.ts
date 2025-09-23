import { Module } from '@nestjs/common';
import { UsuariosregionesService } from './usuariosregiones.service';
import { UsuariosregionesController } from './usuariosregiones.controller';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuariosRegiones } from 'src/entities/UsuariosRegiones';
import { Regiones } from 'src/entities/Regiones';
import { Usuarios } from 'src/entities/Usuarios';

@Module({
  imports: [TypeOrmModule.forFeature([UsuariosRegiones,Regiones,Usuarios]), BitacoraModule],
  controllers: [UsuariosregionesController],
  providers: [UsuariosregionesService],
})
export class UsuariosregionesModule {}
