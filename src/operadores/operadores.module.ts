import { Module } from '@nestjs/common';
import { OperadoresService } from './operadores.service';
import { OperadoresController } from './operadores.controller';

@Module({
  controllers: [OperadoresController],
  providers: [OperadoresService],
})
export class OperadoresModule {}
