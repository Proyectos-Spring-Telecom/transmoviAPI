import { Module } from '@nestjs/common';
import { DispositivosService } from './dispositivos.service';
import { DispositivosController } from './dispositivos.controller';

@Module({
  controllers: [DispositivosController],
  providers: [DispositivosService],
})
export class DispositivosModule {}
