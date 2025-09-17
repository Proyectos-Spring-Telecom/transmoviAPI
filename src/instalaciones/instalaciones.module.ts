import { Module } from '@nestjs/common';
import { InstalacionesService } from './instalaciones.service';
import { InstalacionesController } from './instalaciones.controller';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Instalaciones } from 'src/entities/Instalaciones';

@Module({
  imports: [TypeOrmModule.forFeature([Instalaciones]), BitacoraModule],
  controllers: [InstalacionesController],
  providers: [InstalacionesService],
})
export class InstalacionesModule {}
