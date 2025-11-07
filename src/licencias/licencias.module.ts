import { Module } from '@nestjs/common';
import { LicenciasService } from './licencias.service';
import { LicenciasController } from './licencias.controller';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { Licencias } from 'src/entities/Licencias';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Licencias]), BitacoraModule],
  controllers: [LicenciasController],
  providers: [LicenciasService],
  exports: [LicenciasService],
})
export class LicenciasModule {}
