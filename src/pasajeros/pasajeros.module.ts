import { Module } from '@nestjs/common';
import { PasajerosService } from './pasajeros.service';
import { PasajerosController } from './pasajeros.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pasajeros } from 'src/entities/Pasajeros';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { Clientes } from 'src/entities/Clientes';
import { UsuariosModule } from 'src/usuarios/usuarios.module';
import { Usuarios } from 'src/entities/Usuarios';
import { UsuariosPermisos } from 'src/entities/UsuariosPermisos';
import { Monederos } from 'src/entities/Monederos';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pasajeros, Clientes, Usuarios, UsuariosPermisos, Monederos]),
    BitacoraModule,
  ],
  controllers: [PasajerosController],
  providers: [PasajerosService],
  exports: [PasajerosService],
})
export class PasajerosModule {}
