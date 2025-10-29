import { Module } from '@nestjs/common';
import { MonitoreoService } from './monitoreo.service';
import { MonitoreoController } from './monitoreo.controller';
import { Clientes } from 'src/entities/Clientes';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Derroteros } from 'src/entities/Derroteros';
import { UsuariosRegiones } from 'src/entities/UsuariosRegiones';

@Module({
  imports: [TypeOrmModule.forFeature([Derroteros,UsuariosRegiones,Clientes]), ],
  controllers: [MonitoreoController],
  providers: [MonitoreoService],
})
export class MonitoreoModule {}
