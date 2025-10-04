import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateViajeDto } from './dto/create-viaje.dto';
import { Viajes } from 'src/entities/Viajes';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';

@Injectable()
export class ViajesService {
  constructor(
    @InjectRepository(Viajes)
    private readonly viajesRepository: Repository<Viajes>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  async create(
    idUser: number,
    createViajeDto: CreateViajeDto,
  ): Promise<ApiCrudResponse> {
    try {
      const newViaje = await this.viajesRepository.create(createViajeDto);
      const viajeSave = await this.viajesRepository.save(newViaje);

      // Registro en la bitácora SUCCESS
      const querylogger = { createViajeDto };
      await this.bitacoraLogger.logToBitacora(
        'Viajes',
        `Se creó un viaje con ID: ${viajeSave.id}`,
        'CREATE',
        `${querylogger}`,
        idUser,
        15,
        EstatusEnumBitcora.SUCCESS,
      );

      // API response SUCCESS
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Viaje creado correctamente',
        data: {
          id: Number(viajeSave.id),
          nombre: `Cliente ID: ${viajeSave.idCliente}, Turno ID: ${viajeSave.idTurno}, Derrotero ID: ${viajeSave.idDerrotero}, Operador ID: ${viajeSave.idOperador}`,
        },
      };

      return result;
    } catch (error) {
      // Registro en la bitácora SUCCESS
      const querylogger = { createViajeDto };
      await this.bitacoraLogger.logToBitacora(
        'Viajes',
        `Se creó un viaje con client ID: ${createViajeDto.idCliente} Turno ID: ${createViajeDto.idTurno}, Derrotero ID: ${createViajeDto.idDerrotero}, Operador ID: ${createViajeDto.idOperador}`,
        'CREATE',
        `${querylogger}`,
        idUser,
        15,
        EstatusEnumBitcora.SUCCESS,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al crear un viaje',
        error: error.message,
      });
    }
  }

  async findAllList() {
    try {
      const viajes = await this.viajesRepository.query(
        `
SELECT
  -- Viaje
  v.Id AS id,
  v.Inicio AS inicio,
  v.Fin AS fin,
  v.Estatus AS estatus,

  -- Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,

  -- Turno
  t.Id AS idTurno,
  t.Inicio AS inicioTurno,
  t.IdInstalacion AS idInstalacion,

  -- Instalación
  ins.IdDispositivo AS idDispositivo,
  -- Dispositivo
  d.NumeroSerie AS numeroSerieDispositivo,
  ins.IdBlueVox AS idBlueVox,
  -- BlueVox
  bv.NumeroSerie AS numeroSerieBlueVox,
  ins.IdVehiculo AS idVehiculo,
  -- Vehículo
  vhl.Placa AS placaVehiculo,

  -- Operador
  o.Id AS idOperador,
  o.NumeroLicencia AS numeroLicenciaOperador,
  o.IdUsuario AS idUsuario,

  -- Usuario del operador
  u.Nombre AS nombreOperador,
  u.ApellidoPaterno AS apellidoPaternoOperador,
  u.ApellidoMaterno AS apellidoMaternoOperador,

  -- Derrotero
  der.Id AS idDerrotero,
  der.Nombre AS nombreDerrotero,
  der.PuntoInicio AS puntoInicioDerrotero,
  der.PuntoFin AS puntoFinDerrotero,
  der.DistanciaKm AS distanciaKmDerrotero,

  -- Ruta
  r.Id AS idRuta,
  r.Nombre AS nombreRuta,
  r.IdRegion AS idRegion,
  -- Regiones (Inicio y Fin)
  regInicio.Nombre AS nombreRegionInicio,
  r.IdRegionFin AS idRegionFin,
  -- Regiones (Inicio y Fin)
  regFin.Nombre AS nombreRegionFin

FROM Viajes v
-- Cliente
JOIN Clientes c ON v.IdCliente = c.Id

-- Turno
JOIN Turnos t ON v.IdTurno = t.Id

-- Instalación
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id

-- Dispositivo
JOIN Dispositivos d ON ins.IdCliente = d.IdCliente AND ins.IdDispositivo = d.Id

-- BlueVox
JOIN BlueVoxs bv ON ins.IdCliente = bv.IdCliente AND ins.IdBlueVox = bv.Id

-- Vehículo
JOIN Vehiculos vhl ON ins.IdCliente = vhl.IdCliente AND ins.IdVehiculo = vhl.Id

-- Operador
JOIN Operadores o ON v.IdOperador = o.Id

-- Usuario del operador
JOIN Usuarios u ON o.IdUsuario = u.Id

-- Derrotero
JOIN Derroteros der ON v.IdDerrotero = der.Id

-- Ruta
JOIN Rutas r ON der.IdRuta = r.Id

-- Región de inicio
LEFT JOIN Regiones regInicio ON r.IdRegion = regInicio.Id

-- Región de fin
LEFT JOIN Regiones regFin ON r.IdRegionFin = regFin.Id

ORDER BY v.Id DESC;
            `,
      );

      if (viajes.length === 0) {
        throw new NotFoundException('No se encontraron viajes.');
      }

      const data = viajes.map((item) => ({
        ...item,
        id: Number(item.id),
        idCliente: Number(item.idCliente),
        idTurno: Number(item.idTurno),
        idInstalacion: Number(item.idInstalacion),
        idDispositivo: Number(item.idDispositivo),
        idBlueVox: Number(item.idBlueVox),
        idVehiculo: Number(item.idVehiculo),
        idOperador: Number(item.idOperador),
        idUsuario: Number(item.idUsuario),
        idDerrotero: Number(item.idDerrotero),
        distanciaKmDerrotero:
          item.distanciaKmDerrotero !== null
            ? Number(item.distanciaKmDerrotero)
            : null,
        idRuta: Number(item.idRuta),
        idRegion: Number(item.idRegion),
        idRegionFin:
          item.idRegionFin !== null ? Number(item.idRegionFin) : null,
      }));

      //APi response
      const result: ApiResponseCommon = {
        data: data
      };

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtener paginado viajes',
        error: error.message,
      });
    }
  }

  async findAll(page: number, limit: number): Promise<ApiResponseCommon> {
    try {
      const offset = (page - 1) * limit;

      const viajes = await this.viajesRepository.query(
        `
SELECT
  -- Viaje
  v.Id AS id,
  v.Inicio AS inicio,
  v.Fin AS fin,
  v.Estatus AS estatus,

  -- Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,

  -- Turno
  t.Id AS idTurno,
  t.Inicio AS inicioTurno,
  t.IdInstalacion AS idInstalacion,

  -- Instalación
  ins.IdDispositivo AS idDispositivo,
  -- Dispositivo
  d.NumeroSerie AS numeroSerieDispositivo,
  ins.IdBlueVox AS idBlueVox,
  -- BlueVox
  bv.NumeroSerie AS numeroSerieBlueVox,
  ins.IdVehiculo AS idVehiculo,
  -- Vehículo
  vhl.Placa AS placaVehiculo,

  -- Operador
  o.Id AS idOperador,
  o.NumeroLicencia AS numeroLicenciaOperador,
  o.IdUsuario AS idUsuario,

  -- Usuario del operador
  u.Nombre AS nombreOperador,
  u.ApellidoPaterno AS apellidoPaternoOperador,
  u.ApellidoMaterno AS apellidoMaternoOperador,

  -- Derrotero
  der.Id AS idDerrotero,
  der.Nombre AS nombreDerrotero,
  der.PuntoInicio AS puntoInicioDerrotero,
  der.PuntoFin AS puntoFinDerrotero,
  der.DistanciaKm AS distanciaKmDerrotero,

  -- Ruta
  r.Id AS idRuta,
  r.Nombre AS nombreRuta,
  r.IdRegion AS idRegion,
  -- Regiones (Inicio y Fin)
  regInicio.Nombre AS nombreRegionInicio,
  r.IdRegionFin AS idRegionFin,
  -- Regiones (Inicio y Fin)
  regFin.Nombre AS nombreRegionFin

FROM Viajes v
-- Cliente
JOIN Clientes c ON v.IdCliente = c.Id

-- Turno
JOIN Turnos t ON v.IdTurno = t.Id

-- Instalación
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id

-- Dispositivo
JOIN Dispositivos d ON ins.IdCliente = d.IdCliente AND ins.IdDispositivo = d.Id

-- BlueVox
JOIN BlueVoxs bv ON ins.IdCliente = bv.IdCliente AND ins.IdBlueVox = bv.Id

-- Vehículo
JOIN Vehiculos vhl ON ins.IdCliente = vhl.IdCliente AND ins.IdVehiculo = vhl.Id

-- Operador
JOIN Operadores o ON v.IdOperador = o.Id

-- Usuario del operador
JOIN Usuarios u ON o.IdUsuario = u.Id

-- Derrotero
JOIN Derroteros der ON v.IdDerrotero = der.Id

-- Ruta
JOIN Rutas r ON der.IdRuta = r.Id

-- Región de inicio
LEFT JOIN Regiones regInicio ON r.IdRegion = regInicio.Id

-- Región de fin
LEFT JOIN Regiones regFin ON r.IdRegionFin = regFin.Id

        WHERE v.Estatus = 1

ORDER BY v.Id DESC
LIMIT ? OFFSET ?;
            `,
        [limit, offset],
      );

      // Query para total (sin paginación)
      const totalResult = await this.viajesRepository.query(
        `
  SELECT COUNT(*) AS total
  FROM Viajes v
  WHERE v.Estatus = 1
  `,
      );

      if (viajes.length === 0) {
        throw new NotFoundException('No se encontraron viajes.');
      }

      const data = viajes.map((item) => ({
        ...item,
        id: Number(item.id),
        idCliente: Number(item.idCliente),
        idTurno: Number(item.idTurno),
        idInstalacion: Number(item.idInstalacion),
        idDispositivo: Number(item.idDispositivo),
        idBlueVox: Number(item.idBlueVox),
        idVehiculo: Number(item.idVehiculo),
        idOperador: Number(item.idOperador),
        idUsuario: Number(item.idUsuario),
        idDerrotero: Number(item.idDerrotero),
        distanciaKmDerrotero:
          item.distanciaKmDerrotero !== null
            ? Number(item.distanciaKmDerrotero)
            : null,
        idRuta: Number(item.idRuta),
        idRegion: Number(item.idRegion),
        idRegionFin:
          item.idRegionFin !== null ? Number(item.idRegionFin) : null,
      }));

      const total = Number(totalResult[0]?.total || 0);

      //APi response
      const result: ApiResponseCommon = {
        data: data,
        paginated: {
          total: total,
          page,
          lastPage: Math.ceil(total / limit),
        },
      };

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtener paginado de viajes',
        error: error.message,
      });
    }
  }

  async findOne(id: number) {
        try {
      const viajes = await this.viajesRepository.query(
        `
SELECT
  -- Viaje
  v.Id AS id,
  v.Inicio AS inicio,
  v.Fin AS fin,
  v.Estatus AS estatus,

  -- Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,

  -- Turno
  t.Id AS idTurno,
  t.Inicio AS inicioTurno,
  t.IdInstalacion AS idInstalacion,

  -- Instalación
  ins.IdDispositivo AS idDispositivo,
  -- Dispositivo
  d.NumeroSerie AS numeroSerieDispositivo,
  ins.IdBlueVox AS idBlueVox,
  -- BlueVox
  bv.NumeroSerie AS numeroSerieBlueVox,
  ins.IdVehiculo AS idVehiculo,
  -- Vehículo
  vhl.Placa AS placaVehiculo,

  -- Operador
  o.Id AS idOperador,
  o.NumeroLicencia AS numeroLicenciaOperador,
  o.IdUsuario AS idUsuario,

  -- Usuario del operador
  u.Nombre AS nombreOperador,
  u.ApellidoPaterno AS apellidoPaternoOperador,
  u.ApellidoMaterno AS apellidoMaternoOperador,

  -- Derrotero
  der.Id AS idDerrotero,
  der.Nombre AS nombreDerrotero,
  der.PuntoInicio AS puntoInicioDerrotero,
  der.PuntoFin AS puntoFinDerrotero,
  der.DistanciaKm AS distanciaKmDerrotero,

  -- Ruta
  r.Id AS idRuta,
  r.Nombre AS nombreRuta,
  r.IdRegion AS idRegion,
  -- Regiones (Inicio y Fin)
  regInicio.Nombre AS nombreRegionInicio,
  r.IdRegionFin AS idRegionFin,
  -- Regiones (Inicio y Fin)
  regFin.Nombre AS nombreRegionFin

FROM Viajes v
-- Cliente
JOIN Clientes c ON v.IdCliente = c.Id

-- Turno
JOIN Turnos t ON v.IdTurno = t.Id

-- Instalación
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id

-- Dispositivo
JOIN Dispositivos d ON ins.IdCliente = d.IdCliente AND ins.IdDispositivo = d.Id

-- BlueVox
JOIN BlueVoxs bv ON ins.IdCliente = bv.IdCliente AND ins.IdBlueVox = bv.Id

-- Vehículo
JOIN Vehiculos vhl ON ins.IdCliente = vhl.IdCliente AND ins.IdVehiculo = vhl.Id

-- Operador
JOIN Operadores o ON v.IdOperador = o.Id

-- Usuario del operador
JOIN Usuarios u ON o.IdUsuario = u.Id

-- Derrotero
JOIN Derroteros der ON v.IdDerrotero = der.Id

-- Ruta
JOIN Rutas r ON der.IdRuta = r.Id

-- Región de inicio
LEFT JOIN Regiones regInicio ON r.IdRegion = regInicio.Id

-- Región de fin
LEFT JOIN Regiones regFin ON r.IdRegionFin = regFin.Id

        WHERE v.Id = ?

ORDER BY v.Id DESC
            `,
            [id],
      );

      if (viajes.length === 0) {
        throw new NotFoundException('No se encontraron viajes.');
      }

      const viaje = viajes[0];
      
      const data = {
      ...viaje,
      id: Number(viaje.id),
      idCliente: Number(viaje.idCliente),
      idTurno: Number(viaje.idTurno),
      idInstalacion: Number(viaje.idInstalacion),
      idDispositivo: Number(viaje.idDispositivo),
      idBlueVox: Number(viaje.idBlueVox),
      idVehiculo: Number(viaje.idVehiculo),
      idOperador: Number(viaje.idOperador),
      idUsuario: Number(viaje.idUsuario),
      idDerrotero: Number(viaje.idDerrotero),
      distanciaKmDerrotero:
        viaje.distanciaKmDerrotero !== null
          ? Number(viaje.distanciaKmDerrotero)
          : null,
      idRuta: Number(viaje.idRuta),
      idRegion: Number(viaje.idRegion),
      idRegionFin:
        viaje.idRegionFin !== null ? Number(viaje.idRegionFin) : null,
    };

      //APi response
      const result: ApiResponseCommon = {
        data: data
      };

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtener un viaje',
        error: error.message,
      });
    }
  }


}
