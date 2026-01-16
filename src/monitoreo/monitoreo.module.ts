import { Module } from '@nestjs/common';
import { MonitoreoService } from './monitoreo.service';
import { MonitoreoController } from './monitoreo.controller';
import { Clientes } from 'src/entities/Clientes';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Variantes } from 'src/entities/Variantes';
import { UsuariosZonas } from 'src/entities/UsuariosZonas';
import { Posiciones } from 'src/entities/Posiciones';
import { Vehiculos } from 'src/entities/Vehiculos';
import { Instalaciones } from 'src/entities/Instalaciones';
import { Validadores } from 'src/entities/Validadores';
import { Operadores } from 'src/entities/Operadores';
import { Usuarios } from 'src/entities/Usuarios';
import { Turnos } from 'src/entities/Turnos';
import { Viajes } from 'src/entities/Viajes';

@Module({
  imports: [TypeOrmModule.forFeature([
    Variantes,
    UsuariosZonas,
    Clientes,
    Posiciones,
    Vehiculos,
    Instalaciones,
    Validadores,
    Operadores,
    Usuarios,
    Turnos,
    Viajes,
  ]), ],
  controllers: [MonitoreoController],
  providers: [MonitoreoService],
})
export class MonitoreoModule {}
