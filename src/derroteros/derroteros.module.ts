import { Module } from '@nestjs/common';
import { DerroterosService } from './derroteros.service';
import { DerroterosController } from './derroteros.controller';

@Module({
  controllers: [DerroterosController],
  providers: [DerroterosService],
})
export class DerroterosModule {}
