import { Module } from '@nestjs/common';
import { MonederosService } from './monederos.service';
import { MonederosController } from './monederos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Monederos } from 'src/entities/Monederos';
import { BitacoraModule } from 'src/bitacora/bitacora.module';

@Module({
  imports: [TypeOrmModule.forFeature([Monederos]), BitacoraModule],
  controllers: [MonederosController],
  providers: [MonederosService],
  exports: [MonederosService],
})
export class MonederosModule {}
