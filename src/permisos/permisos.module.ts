import { Module } from '@nestjs/common';
import { PermisosService } from './permisos.service';
import { PermisosController } from './permisos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permisos } from 'src/entities/Permisos';
import { UsuarioPermisos } from 'src/entities/UsuarioPermisos';
import { BitacoraModule } from 'src/bitacora/bitacora.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Permisos, UsuarioPermisos]),
    BitacoraModule,
  ],
  controllers: [PermisosController],
  providers: [PermisosService],
})
export class PermisosModule {}
