import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsuariosModule } from './usuarios/usuarios.module';
import { AuthModule } from './auth/auth.module';
import { BitacoraModule } from './bitacora/bitacora.module';
import { ClientesModule } from './clientes/clientes.module';
import { DispositivosModule } from './dispositivos/dispositivos.module';
import { ModulosModule } from './modulos/modulos.module';
import { MonederosModule } from './monederos/monederos.module';
import { OperadoresModule } from './operadores/operadores.module';
import { PasajerosModule } from './pasajeros/pasajeros.module';
import { PermisosModule } from './permisos/permisos.module';
import { RolesModule } from './roles/roles.module';
import { TransaccionesModule } from './transacciones/transacciones.module';
import { VehiculosModule } from './vehiculos/vehiculos.module';
import { BluevoxModule } from './bluevox/bluevox.module';
import { RutasModule } from './rutas/rutas.module';
import { PosicionesModule } from './posiciones/posiciones.module';
import { S3Module } from './s3/s3.module';
import { ConteopasajerosModule } from './conteopasajeros/conteopasajeros.module';
import { InstalacionesModule } from './instalaciones/instalaciones.module';
import { TurnosModule } from './turnos/turnos.module';
import { RegionesModule } from './regiones/regiones.module';
import { UsuariosregionesModule } from './usuariosregiones/usuariosregiones.module';
import { UsuariosinstalacionesModule } from './usuariosinstalaciones/usuariosinstalaciones.module';
import { DerroterosModule } from './derroteros/derroteros.module';
import { TarifasModule } from './tarifas/tarifas.module';
import { ViajesModule } from './viajes/viajes.module';
import { ViajesconteosModule } from './viajesconteos/viajesconteos.module';
import { ViajestransaccionesModule } from './viajestransacciones/viajestransacciones.module';
import { MailModule } from './mail/mail.module';
import { HistoricoinstalacionesModule } from './historicoinstalaciones/historicoinstalaciones.module';
import { MonitoreoModule } from './monitoreo/monitoreo.module';
import { AdministracionModule } from './administracion/administracion.module';
import { CatpasajeroModule } from './cattiposasajeros/catpasajero.module';
import { CatcombustibleModule } from './cattipocombustible/catcombustible.module';
import { LicenciasModule } from './licencias/licencias.module';
import { CatcategorialicenciaModule } from './catcategorialicencia/catcategorialicencia.module';
import { CattipolicenciaModule } from './cattipolicencia/cattipolicencia.module';
import { CattipodescuentoModule } from './cattipodescuento/cattipodescuento.module';
import { CattipotransaccionesModule } from './cattipotransacciones/cattipotransacciones.module';
import { TalleresModule } from './talleres/talleres.module';
import { CatEstatusMantenimientoModule } from './cat-estatus-mantenimiento/cat-estatus-mantenimiento.module';
import { CatReferenciaServicioModule } from './cat-referencia-servicio/cat-referencia-servicio.module';
import { CatTipoCombustibleModule } from './cat-tipo-combustible/cat-tipo-combustible.module';
import { CatTipoVerificacionesModule } from './cat-tipo-verificaciones/cat-tipo-verificaciones.module';
import { MantenimientoVehicularModule } from './mantenimiento-vehicular/mantenimiento-vehicular.module';
import { MantenimientoCombustibleModule } from './mantenimiento-combustible/mantenimiento-combustible.module';
import { MantenimientoKilometrajeModule } from './mantenimiento-kilometraje/mantenimiento-kilometraje.module';
import Joi from 'joi';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().default(3306),
        DB_USER: Joi.string().required(),
        DB_PASSWORD: Joi.string().allow(''), // Puede estar vacío si no hay pass
        DB_DATABASE: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRES_IN: Joi.string().required(),
        AWS_REGION: Joi.string().required(),
        AWS_ACCESS_KEY_ID: Joi.string().required(),
        AWS_SECRET_ACCESS_KEY: Joi.string().required(),
        AWS_S3_BUCKET: Joi.string().required(),
        UPLOAD_MAX_SIZE: Joi.string().required(),
      }),
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_DATABASE'),
        autoLoadEntities: false,
        entities: [__dirname + '/entities/*{.ts,.js}'],
        synchronize: false, //Nunca poner en true
        dateStrings: false,
        timezone: 'Z',
        extra: {
          // Evita que bigint se devuelvan como string
          decimalNumbers: true,
        },
      }),
    }),

    UsuariosModule,

    AuthModule,

    BitacoraModule,

    ClientesModule,

    DispositivosModule,

    ModulosModule,

    MonederosModule,

    OperadoresModule,

    PasajerosModule,

    PermisosModule,

    RolesModule,

    TransaccionesModule,

    VehiculosModule,

    BluevoxModule,

    RutasModule,

    PosicionesModule,

    S3Module,

    ConteopasajerosModule,

    InstalacionesModule,

    TurnosModule,

    RegionesModule,

    UsuariosregionesModule,

    UsuariosinstalacionesModule,

    DerroterosModule,

    TarifasModule,

    ViajesModule,

    ViajesconteosModule,

    ViajestransaccionesModule,

    MailModule,

    HistoricoinstalacionesModule,

    MonitoreoModule,

    AdministracionModule,

    CatpasajeroModule,

    CatcombustibleModule,

    TalleresModule,

    CatEstatusMantenimientoModule,

    CatReferenciaServicioModule,

    CatTipoCombustibleModule,

    CatTipoVerificacionesModule,

    MantenimientoVehicularModule,

    MantenimientoCombustibleModule,

    MantenimientoKilometrajeModule,

    LicenciasModule,

    CatcategorialicenciaModule,

    CattipolicenciaModule,

    CattipodescuentoModule,

    CattipotransaccionesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
