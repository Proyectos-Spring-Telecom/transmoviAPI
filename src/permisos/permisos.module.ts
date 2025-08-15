import { Module } from '@nestjs/common';
import { PermisosService } from './permisos.service';
import { PermisosController } from './permisos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permisos } from 'src/entities/Permisos';
import { UsuarioPermisos } from 'src/entities/UsuarioPermisos';

@Module({
  imports:[TypeOrmModule.forFeature([Permisos,UsuarioPermisos])],
  controllers: [PermisosController],
  providers: [PermisosService],
})
export class PermisosModule {}
