import { Module } from '@nestjs/common';
import { VehiculosService } from './vehiculos.service';
import { VehiculosController } from './vehiculos.controller';

@Module({
  controllers: [VehiculosController],
  providers: [VehiculosService],
})
export class VehiculosModule {}
