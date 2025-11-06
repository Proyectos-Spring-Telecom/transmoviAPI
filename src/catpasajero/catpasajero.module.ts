import { Module } from '@nestjs/common';
import { CatpasajeroService } from './catpasajero.service';
import { CatpasajeroController } from './catpasajero.controller';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatPasajero } from 'src/entities/CatPasajeros';
import { Clientes } from 'src/entities/Clientes';

@Module({
  imports: [TypeOrmModule.forFeature([CatPasajero,Clientes]), BitacoraModule],
  controllers: [CatpasajeroController],
  providers: [CatpasajeroService],
  exports: [CatpasajeroService]
})
export class CatpasajeroModule {}
