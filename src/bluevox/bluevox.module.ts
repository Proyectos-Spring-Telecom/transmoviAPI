import { Module } from '@nestjs/common';
import { BluevoxService } from './bluevox.service';
import { BluevoxController } from './bluevox.controller';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlueVoxs } from 'src/entities/BlueVoxs';

@Module({
    imports: [TypeOrmModule.forFeature([BlueVoxs]), BitacoraModule],
  controllers: [BluevoxController],
  providers: [BluevoxService],
})
export class BluevoxModule {}
