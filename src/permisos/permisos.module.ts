import { Module } from '@nestjs/common';
import { PermisosService } from './permisos.service';
import { PermisosController } from './permisos.controller';

@Module({
  controllers: [PermisosController],
  providers: [PermisosService],
})
export class PermisosModule {}
