import { Module } from '@nestjs/common';
import { CatMetodoPagoService } from './cat-metodo-pago.service';
import { CatMetodoPagoController } from './cat-metodo-pago.controller';
import { CatMetodoPago } from 'src/entities/CatMetodoPago';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([CatMetodoPago]),],
  controllers: [CatMetodoPagoController],
  providers: [CatMetodoPagoService],
})
export class CatMetodoPagoModule {}
