import { Module } from '@nestjs/common';
import { ViajestransaccionesService } from './viajestransacciones.service';
import { ViajestransaccionesController } from './viajestransacciones.controller';

@Module({
  controllers: [ViajestransaccionesController],
  providers: [ViajestransaccionesService],
})
export class ViajestransaccionesModule {}
