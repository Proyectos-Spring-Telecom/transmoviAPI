import { Module } from '@nestjs/common';
import { VehiculosService } from './vehiculos.service';
import { VehiculosController } from './vehiculos.controller';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vehiculos } from 'src/entities/Vehiculos';
import { Instalaciones } from 'src/entities/Instalaciones';

@Module({
  imports:[BitacoraModule,TypeOrmModule.forFeature([Vehiculos, Instalaciones])],
  controllers: [VehiculosController],
  providers: [VehiculosService],
})
export class VehiculosModule {}
