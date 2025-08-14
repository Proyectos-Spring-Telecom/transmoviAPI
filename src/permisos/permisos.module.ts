import { Module } from '@nestjs/common';
import { PermisosService } from './permisos.service';
import { PermisosController } from './permisos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permisos } from 'src/entities/Permisos';

@Module({
  imports:[TypeOrmModule.forFeature([Permisos])],
  controllers: [PermisosController],
  providers: [PermisosService],
})
export class PermisosModule {}
