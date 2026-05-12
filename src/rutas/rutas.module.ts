import { Module } from '@nestjs/common';
import { RutasService } from './rutas.service';
import { RutasController } from './rutas.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rutas } from 'src/entities/Rutas';
import { Regiones } from 'src/entities/Regiones';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { UsuariosRegiones } from 'src/entities/UsuariosRegiones';
import { Clientes } from 'src/entities/Clientes';

@Module({
  imports: [
    TypeOrmModule.forFeature([Regiones, Rutas, UsuariosRegiones, Clientes]),
    BitacoraModule,
  ],
  controllers: [RutasController],
  providers: [RutasService],
})
export class RutasModule {}
