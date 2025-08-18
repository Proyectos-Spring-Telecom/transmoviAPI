import { Module } from '@nestjs/common';
import { DispositivosService } from './dispositivos.service';
import { DispositivosController } from './dispositivos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dispositivos } from 'src/entities/Dispositivos';

@Module({
  imports:[TypeOrmModule.forFeature([Dispositivos])],
  controllers: [DispositivosController],
  providers: [DispositivosService],
})
export class DispositivosModule {}
