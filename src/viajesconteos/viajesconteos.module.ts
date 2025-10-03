import { Module } from '@nestjs/common';
import { ViajesconteosService } from './viajesconteos.service';
import { ViajesconteosController } from './viajesconteos.controller';

@Module({
  controllers: [ViajesconteosController],
  providers: [ViajesconteosService],
})
export class ViajesconteosModule {}
