import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NetpayService } from './netpay.service';
import { NetpayController } from './netpay.controller';

@Module({
  imports: [ConfigModule],
  controllers: [NetpayController],
  providers: [NetpayService],
  exports: [NetpayService],
})
export class NetpayModule {}
