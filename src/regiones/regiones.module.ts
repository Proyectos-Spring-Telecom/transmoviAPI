import { Module } from '@nestjs/common';
import { RegionesService } from './regiones.service';
import { RegionesController } from './regiones.controller';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { Regiones } from 'src/entities/Regiones';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuariosRegiones } from 'src/entities/UsuariosRegiones';

@Module({
  imports: [TypeOrmModule.forFeature([Regiones,UsuariosRegiones]), BitacoraModule],
  controllers: [RegionesController],
  providers: [RegionesService],
})
export class RegionesModule {}
