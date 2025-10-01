import { Module } from '@nestjs/common';
import { TarifasService } from './tarifas.service';
import { TarifasController } from './tarifas.controller';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { Tarifas } from 'src/entities/Tarifas';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Derroteros } from 'src/entities/Derroteros';
import { UsuariosRegiones } from 'src/entities/UsuariosRegiones';

@Module({
  imports: [TypeOrmModule.forFeature([Tarifas,Derroteros,UsuariosRegiones]), BitacoraModule],
  controllers: [TarifasController],
  providers: [TarifasService],
})
export class TarifasModule {}
