import { Module } from '@nestjs/common';
import { OperadoresService } from './operadores.service';
import { OperadoresController } from './operadores.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Operadores } from 'src/entities/Operadores';

@Module({
  imports: [TypeOrmModule.forFeature([Operadores])],
  controllers: [OperadoresController],
  providers: [OperadoresService],
})
export class OperadoresModule {}
