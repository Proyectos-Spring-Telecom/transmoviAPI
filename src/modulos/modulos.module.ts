import { Module } from '@nestjs/common';
import { ModulosService } from './modulos.service';
import { ModulosController } from './modulos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Modulos } from 'src/entities/Modulos';
import { Permisos } from 'src/entities/Permisos';

@Module({
  imports:[TypeOrmModule.forFeature([Modulos,Permisos])],
  controllers: [ModulosController],
  providers: [ModulosService],
})
export class ModulosModule {}
