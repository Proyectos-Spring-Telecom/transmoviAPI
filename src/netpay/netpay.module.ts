import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NetpayService } from './netpay.service';
import { NetpayController } from './netpay.controller';
import { Pasajeros } from 'src/entities/Pasajeros';
import { DatosTarjeta } from 'src/entities/DatosTarjeta';
import { DireccionesTarjeta } from 'src/entities/DireccionesTarjeta';
import { TokenDirecciones } from 'src/entities/TokenDirecciones';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Pasajeros, DatosTarjeta, DireccionesTarjeta, TokenDirecciones]),
  ],
  controllers: [NetpayController],
  providers: [NetpayService],
  exports: [NetpayService],
})
export class NetpayModule {}
