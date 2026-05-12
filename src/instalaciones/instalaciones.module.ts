import { Module } from '@nestjs/common';
import { InstalacionesService } from './instalaciones.service';
import { InstalacionesController } from './instalaciones.controller';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Instalaciones } from 'src/entities/Instalaciones';
import { UsuariosInstalaciones } from 'src/entities/UsuariosInstalaciones';
import { Dispositivos } from 'src/entities/Dispositivos';
import { BlueVoxs } from 'src/entities/BlueVoxs';
import { Vehiculos } from 'src/entities/Vehiculos';
import { Clientes } from 'src/entities/Clientes';
import { HistoricoInstalaciones } from 'src/entities/historico-instalaciones';
import { InstalacionesBlueVoxs } from 'src/entities/InstalacionesBlueVoxs';
import { InstalacionesDispositivos } from 'src/entities/InstalacionesDispositivos';
import { HistoricoinstalacionesModule } from 'src/historicoinstalaciones/historicoinstalaciones.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Instalaciones,
      UsuariosInstalaciones,
      Dispositivos,
      BlueVoxs,
      Vehiculos,
      Clientes,
      InstalacionesBlueVoxs,
      InstalacionesDispositivos,
    ]),
    BitacoraModule,
    HistoricoinstalacionesModule,
  ],
  controllers: [InstalacionesController],
  providers: [InstalacionesService],
})
export class InstalacionesModule {}
