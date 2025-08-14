import { Module } from '@nestjs/common';
import { ModulosService } from './modulos.service';
import { ModulosController } from './modulos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Modulos } from 'src/entities/Modulos';

@Module({
  imports:[TypeOrmModule.forFeature([Modulos])],
  controllers: [ModulosController],
  providers: [ModulosService],
})
export class ModulosModule {}
