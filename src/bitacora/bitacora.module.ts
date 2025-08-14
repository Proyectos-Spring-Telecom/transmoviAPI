import { Module } from '@nestjs/common';
import { BitacoraService } from './bitacora.service';
import { BitacoraController } from './bitacora.controller';

@Module({
  controllers: [BitacoraController],
  providers: [BitacoraService],
})
export class BitacoraModule {}
