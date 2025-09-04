//Modulo Usuario
import { Module } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { UsuariosController } from './usuarios.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuarios } from 'src/entities/Usuarios';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { ClientesModule } from 'src/clientes/clientes.module';
import { PermisosModule } from 'src/permisos/permisos.module';
import { UsuariosPermisos } from 'src/entities/UsuariosPermisos'; 

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuarios,UsuariosPermisos]),
    BitacoraModule,
    ClientesModule,
    PermisosModule,
  ],
  controllers: [UsuariosController],
  providers: [UsuariosService],
})
export class UsuariosModule {}
