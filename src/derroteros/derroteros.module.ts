import { Module } from '@nestjs/common';
import { DerroterosService } from './derroteros.service';
import { DerroterosController } from './derroteros.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rutas } from 'src/entities/Rutas';
import { Derroteros } from 'src/entities/Derroteros';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { UsuariosRegiones } from 'src/entities/UsuariosRegiones';
import { Clientes } from 'src/entities/Clientes';
import { Tarifas } from 'src/entities/Tarifas';

@Module({
  imports: [TypeOrmModule.forFeature([Rutas,Derroteros,UsuariosRegiones,Clientes, Tarifas]), BitacoraModule],
  controllers: [DerroterosController],
  providers: [DerroterosService],
})
export class DerroterosModule {}
