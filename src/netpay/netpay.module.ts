import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NetpayService } from './netpay.service';
import { NetpayController } from './netpay.controller';
import { Pasajeros } from 'src/entities/Pasajeros';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Pasajeros]),
  ],
  controllers: [NetpayController],
  providers: [NetpayService],
  exports: [NetpayService],
})
export class NetpayModule {}
