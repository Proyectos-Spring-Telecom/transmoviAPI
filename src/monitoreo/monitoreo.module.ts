import { Module } from '@nestjs/common';
import { MonitoreoService } from './monitoreo.service';
import { MonitoreoController } from './monitoreo.controller';
import { Clientes } from 'src/entities/Clientes';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Variantes } from 'src/entities/Variantes';
import { UsuariosZonas } from 'src/entities/UsuariosZonas';

@Module({
  imports: [TypeOrmModule.forFeature([Variantes,UsuariosZonas,Clientes]), ],
  controllers: [MonitoreoController],
  providers: [MonitoreoService],
})
export class MonitoreoModule {}
