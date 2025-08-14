import { Module } from '@nestjs/common';
import { MonederosService } from './monederos.service';
import { MonederosController } from './monederos.controller';

@Module({
  controllers: [MonederosController],
  providers: [MonederosService],
})
export class MonederosModule {}
