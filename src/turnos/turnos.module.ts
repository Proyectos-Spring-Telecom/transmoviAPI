import { Module } from '@nestjs/common';
import { TurnosService } from './turnos.service';
import { TurnosController } from './turnos.controller';

@Module({
  controllers: [TurnosController],
  providers: [TurnosService],
})
export class TurnosModule {}
