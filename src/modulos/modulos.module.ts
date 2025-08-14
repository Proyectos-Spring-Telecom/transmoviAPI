import { Module } from '@nestjs/common';
import { ModulosService } from './modulos.service';
import { ModulosController } from './modulos.controller';

@Module({
  controllers: [ModulosController],
  providers: [ModulosService],
})
export class ModulosModule {}
