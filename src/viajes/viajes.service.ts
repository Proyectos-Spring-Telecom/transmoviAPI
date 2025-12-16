import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
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
import { EnumModulos, EstatusEnum } from 'src/common/estatus.enum';
import { Clientes } from 'src/entities/Clientes';
import { Turnos } from 'src/entities/Turnos';
import { UpdateViajeDto } from './dto/update-viaje.dto';

@Injectable()
export class ViajesService {
  constructor(
    @InjectRepository(Viajes)
    private readonly viajesRepository: Repository<Viajes>,
    @InjectRepository(Clientes)
    private readonly clienteRepository: Repository<Clientes>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    @InjectRepository(Turnos)
    private readonly turnosRepository: Repository<Turnos>,
  ) { }
  // ========================================
  // 🔹 CREAR UN VIAJE
  // ========================================
  async create(
    idUser: number,
    cliente: number,
    idOperador: number,
    createViajeDto: CreateViajeDto,
  ): Promise<ApiCrudResponse> {
    try {
      //validamos que el usuario sea rol operador
      if (!idOperador) {
        throw new UnauthorizedException(`Usuario no autorizado para la generación de viajes.`)
      }

      // Validar que el turno existe y está activo (estatus = 1)
      if (createViajeDto.idTurno) {
        const turno = await this.turnosRepository.findOne({
          where: { id: createViajeDto.idTurno },
        });

        if (!turno) {
          throw new NotFoundException(`El turno con ID ${createViajeDto.idTurno} no existe.`);
        }

        if (turno.estatus !== 1) {
          throw new BadRequestException(`No se puede crear un viaje porque el turno con ID ${createViajeDto.idTurno} no está activo (estatus: ${turno.estatus}).`);
        }
      }

      //Creamos el turno
      function pad(n: number) {
        return n < 10 ? '0' + n : n;
      }
      const ahora = new Date();
      const desfaseMs = -6 * 60 * 60 * 1000; // -6 horas
      const fechaDesfasada = new Date(ahora.getTime() + desfaseMs);
      const fechaActual = `${fechaDesfasada.getFullYear()}-${pad(fechaDesfasada.getMonth() + 1)}-${pad(fechaDesfasada.getDate())} ${pad(fechaDesfasada.getHours())}:${pad(fechaDesfasada.getMinutes())}:${pad(fechaDesfasada.getSeconds())}`;

      createViajeDto.inicio = fechaDesfasada;
      createViajeDto.estatus = EstatusEnum.ACTIVO;
      createViajeDto.idCliente = cliente;
      createViajeDto.idOperador = idOperador;

      const newViaje = await this.viajesRepository.create(createViajeDto);
      const viajeSave = await this.viajesRepository.save(newViaje);

      // Registro en la bitácora SUCCESS
      const querylogger = { createViajeDto };
      await this.bitacoraLogger.logToBitacora(
        'Viajes',
        `Se creó un viaje con ID: ${viajeSave.id}`,
        'CREATE',
        querylogger,
        idUser,
        EnumModulos.VIAJES,
        EstatusEnumBitcora.SUCCESS,
      );

      // API response SUCCESS
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Viaje creado correctamente',
        data: {
          id: Number(viajeSave.id),
          nombre: `Cliente ID: ${viajeSave.idCliente}, Turno ID: ${viajeSave.idTurno}, Variante ID: ${viajeSave.idVariante}, Operador ID: ${viajeSave.idOperador}`,
        },
      };

      return result;
    } catch (error) {
      // Registro en la bitácora SUCCESS
      const querylogger = { createViajeDto };
      await this.bitacoraLogger.logToBitacora(
        'Viajes',
        `Se creó un viaje con client ID: ${createViajeDto.idCliente} Turno ID: ${createViajeDto.idTurno}, Variante ID: ${createViajeDto.idVariante}, Operador ID: ${createViajeDto.idOperador}`,
        'CREATE',
        querylogger,
        idUser,
        EnumModulos.VIAJES,
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

  // ========================================
  // 🔹 ACTUALIZAR UN VIAJE
  // ========================================
  async update(
    idUser: number,
    cliente: number,
    idOperador: number,
    id: number,
    updateViajeDto: UpdateViajeDto,
  ): Promise<ApiCrudResponse> {
    try {
      //validamos que el usuario sea rol operador
      if (!idOperador) {
        throw new UnauthorizedException(`Usuario no autorizado para la generación de viajes.`)
      }
      //Generamos el desfase de horarios
      function pad(n: number) {
        return n < 10 ? '0' + n : n;
      }
      const ahora = new Date();
      const desfaseMs = -6 * 60 * 60 * 1000; // -6 horas
      const fechaDesfasada = new Date(ahora.getTime() + desfaseMs);
      const fechaActual = `${fechaDesfasada.getFullYear()}-${pad(fechaDesfasada.getMonth() + 1)}-${pad(fechaDesfasada.getDate())} ${pad(fechaDesfasada.getHours())}:${pad(fechaDesfasada.getMinutes())}:${pad(fechaDesfasada.getSeconds())}`;
      // Buscamos el viaje
      const viaje = await this.viajesRepository.findOne({ where: { id } });
      if (!viaje) {
        throw new NotFoundException(`Viaje con ID ${id} no encontrado`);
      }


      if (cliente != viaje.idCliente || idOperador != viaje.idOperador) {
        throw new BadRequestException(`Los datos del viaje con ID: ${id} no coinciden con los del usuario.`)
      }

      updateViajeDto.estatus = EstatusEnum.INACTIVO;
      updateViajeDto.fin = fechaDesfasada;

      // Actualizamos solo los campos enviados
      await this.viajesRepository.update(id, updateViajeDto);

      // Registro en la bitácora SUCCESS
      const querylogger = { updateViajeDto };
      await this.bitacoraLogger.logToBitacora(
        'Viajes',
        `Se actualizó el viaje con ID: ${viaje.id}`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.VIAJES,
        EstatusEnumBitcora.SUCCESS,
      );

      // API response SUCCESS
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Viaje actualizado correctamente',
        data: {
          id: Number(viaje.id),
          nombre: `Cliente ID: ${viaje.idCliente}, Turno ID: ${viaje.idTurno}, Variante ID: ${viaje.idVariante}, Operador ID: ${viaje.idOperador}`,
        },
      };

      return result;
    } catch (error) {
      // Registro en la bitácora FAIL
      const querylogger = { updateViajeDto };
      await this.bitacoraLogger.logToBitacora(
        'Viajes',
        `Error al actualizar el viaje con ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.VIAJES,
        EstatusEnumBitcora.ERROR,
        error.message,
      );

      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al actualizar el viaje',
        error: error.message,
      });
    }
  }

  //funcion para obtener los clientes hijos
  private async clienteHijos(cliente: number) {
    const clientesFiltrado = await this.clienteRepository.query(
      `CALL spGetClientes(?);`,
      [cliente],
    );

    const idsFiltrados = clientesFiltrado[0]; // El primer índice contiene los resultados
    const ids = idsFiltrados
      .map((clientesFiltrado: any) => Number(clientesFiltrado.Id))
      .filter(Boolean);
    if (ids.length === 0) {
      return { data: [] }; // No hay clientes que consultar
    }

    // 3. Construir el query dinámico con los IDs
    const placeholders = ids.map(() => '?').join(', ');
    return { ids, placeholders };
  }

  private async consultarViajesListadoCL(cliente: number) {
    const query = `
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
  ins.IdValidador AS idValidador,
  -- Validador
  d.NumeroSerie AS numeroSerieValidador,
  ins.IdContador AS idContador,
  -- Contador
  bv.NumeroSerie AS numeroSerieContador,
  ins.IdVehiculo AS idVehiculo,
  -- Vehículo
  vhl.Placa AS placaVehiculo,

  -- Operador
  o.Id AS idOperador,
  o.IdUsuario AS idUsuario,

  -- Usuario del operador
  u.Nombre AS nombreOperador,
  u.ApellidoPaterno AS apellidoPaternoOperador,
  u.ApellidoMaterno AS apellidoMaternoOperador,

  -- Variante
  der.Id AS idVariante,
  der.Nombre AS nombreVariante,
  der.PuntoInicio AS puntoInicioVariante,
  der.PuntoFin AS puntoFinVariante,
  der.DistanciaKm AS distanciaKmVariante,

  -- Ruta
  r.Id AS idRuta,
  r.Nombre AS nombreRuta,
  r.IdZona AS idZona,
  -- Zonas (Inicio y Fin)
  regInicio.Nombre AS nombreZonaInicio,
  r.IdZonaFin AS idZonaFin,
  -- Zonas (Inicio y Fin)
  regFin.Nombre AS nombreZonaFin

FROM Viajes v
JOIN Clientes c ON v.IdCliente = c.Id
JOIN Turnos t ON v.IdTurno = t.Id
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id

-- Validador
JOIN Validadores d ON ins.IdCliente = d.IdCliente AND ins.IdValidador = d.Id

-- Contador
JOIN Contadores bv ON ins.IdCliente = bv.IdCliente AND ins.IdContador = bv.Id

-- Vehículo
JOIN Vehiculos vhl ON ins.IdCliente = vhl.IdCliente AND ins.IdVehiculo = vhl.Id
JOIN Operadores o ON v.IdOperador = o.Id
JOIN Usuarios u ON o.IdUsuario = u.Id

-- Variante
JOIN Variantes der ON v.IdVariante = der.Id

-- Ruta
JOIN Rutas r ON der.IdRuta = r.Id

-- Zona de inicio
LEFT JOIN Zonas regInicio ON r.IdZona = regInicio.Id

-- Zona de fin
LEFT JOIN Zonas regFin ON r.IdZonaFin = regFin.Id

        WHERE v.Estatus = 1
        AND c.Id = ?
        AND c.Estatus = 1

ORDER BY v.Id DESC

    `;
    return this.viajesRepository.query(query, [cliente]);
  }

  private async consultarViajesListado(cliente: number) {
    const { ids, placeholders } = await this.clienteHijos(cliente);
    const query = `
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
  d.NumeroSerie AS numeroSerieValidador,
  ins.IdContador AS idContador,
  -- Contador
  c.NumeroSerie AS numeroSerieContador,
  ins.IdVehiculo AS idVehiculo,
  -- Vehículo
  vhl.Placa AS placaVehiculo,

  -- Operador
  o.Id AS idOperador,
  o.IdUsuario AS idUsuario,

  -- Usuario del operador
  u.Nombre AS nombreOperador,
  u.ApellidoPaterno AS apellidoPaternoOperador,
  u.ApellidoMaterno AS apellidoMaternoOperador,

  -- Variante
  der.Id AS idVariante,
  der.Nombre AS nombreVariante,
  der.PuntoInicio AS puntoInicioVariante,
  der.PuntoFin AS puntoFinVariante,
  der.DistanciaKm AS distanciaKmVariante,

  -- Ruta
  r.Id AS idRuta,
  r.Nombre AS nombreRuta,
  r.IdRegion AS idRegion,
  -- Zonas (Inicio y Fin)
  regInicio.Nombre AS nombreZonaInicio,
  r.IdZonaFin AS idZonaFin,
  -- Zonas (Inicio y Fin)
  regFin.Nombre AS nombreZonaFin

FROM Viajes v
JOIN Clientes c ON v.IdCliente = c.Id
JOIN Turnos t ON v.IdTurno = t.Id
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id
JOIN Validadores d ON ins.IdCliente = d.IdCliente AND ins.IdValidador = d.Id
JOIN Contadores c ON ins.IdCliente = c.IdCliente AND ins.IdContador = c.Id
JOIN Vehiculos vhl ON ins.IdCliente = vhl.IdCliente AND ins.IdVehiculo = vhl.Id
JOIN Operadores o ON v.IdOperador = o.Id
JOIN Usuarios u ON o.IdUsuario = u.Id
JOIN Variantes der ON v.IdVariante = der.Id
JOIN Rutas r ON der.IdRuta = r.Id
LEFT JOIN Zonas regInicio ON r.IdZona = regInicio.Id
LEFT JOIN Zonas regFin ON r.IdZonaFin = regFin.Id

        WHERE v.Estatus = 1
        AND c.Id IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar
        AND c.Estatus = 1

ORDER BY v.Id DESC

    `;
    return this.viajesRepository.query(query, [...ids]);
  }

  // ========================================
  // 🔹 OBTENER LISTADO DE VIAJES
  // ========================================
  async findAllList(cliente: number, rol: number) {
    try {
      let viajes;
      switch (rol) {
        case 1:
          viajes = await this.viajesRepository.query(
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
  ins.IdValidador AS idValidador,
  -- Validador
  d.NumeroSerie AS numeroSerieValidador,
  ins.IdContador AS idContador,
  -- Contador
  bv.NumeroSerie AS numeroSerieContador,
  ins.IdVehiculo AS idVehiculo,
  -- Vehículo
  vhl.Placa AS placaVehiculo,

  -- Operador
  o.Id AS idOperador,
  o.IdUsuario AS idUsuario,

  -- Usuario del operador
  u.Nombre AS nombreOperador,
  u.ApellidoPaterno AS apellidoPaternoOperador,
  u.ApellidoMaterno AS apellidoMaternoOperador,

  -- Variante
  der.Id AS idVariante,
  der.Nombre AS nombreVariante,
  der.PuntoInicio AS puntoInicioVariante,
  der.PuntoFin AS puntoFinVariante,
  der.DistanciaKm AS distanciaKmVariante,

  -- Ruta
  r.Id AS idRuta,
  r.Nombre AS nombreRuta,
  r.IdZona AS idZona,
  -- Zonas (Inicio y Fin)
  regInicio.Nombre AS nombreZonaInicio,
  r.IdZonaFin AS idZonaFin,
  -- Zonas (Inicio y Fin)
  regFin.Nombre AS nombreZonaFin

FROM Viajes v
-- Cliente
JOIN Clientes c ON v.IdCliente = c.Id
JOIN Turnos t ON v.IdTurno = t.Id
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id

-- Validador
JOIN Validadores d ON ins.IdCliente = d.IdCliente AND ins.IdValidador = d.Id

-- Contador
JOIN Contadores bv ON ins.IdCliente = bv.IdCliente AND ins.IdContador = bv.Id

-- Vehículo
JOIN Vehiculos vhl ON ins.IdCliente = vhl.IdCliente AND ins.IdVehiculo = vhl.Id
JOIN Operadores o ON v.IdOperador = o.Id
JOIN Usuarios u ON o.IdUsuario = u.Id

-- Variante
JOIN Variantes der ON v.IdVariante = der.Id

-- Ruta
JOIN Rutas r ON der.IdRuta = r.Id

-- Zona de inicio
LEFT JOIN Zonas regInicio ON r.IdZona = regInicio.Id

-- Zona de fin
LEFT JOIN Zonas regFin ON r.IdZonaFin = regFin.Id
WHERE c.Estatus = 1

ORDER BY v.Id DESC;
            `,
          );
          break;
        case 2:
        case 8:
        case 10:
          viajes = await this.consultarViajesListado(cliente);
          break;

        case 3:
        default:
          viajes = await this.consultarViajesListadoCL(cliente);
          break;
      }

      const data = viajes.map((item) => ({
        ...item,
        id: Number(item.id),
        idCliente: Number(item.idCliente),
        idTurno: Number(item.idTurno),
        idInstalacion: Number(item.idInstalacion),
        idValidador: Number(item.idValidador),
        idContador: Number(item.idContador),
        idVehiculo: Number(item.idVehiculo),
        idOperador: Number(item.idOperador),
        idUsuario: Number(item.idUsuario),
        idVariante: Number(item.idVariante),
        distanciaKmVariante:
          item.distanciaKmVariante !== null
            ? Number(item.distanciaKmVariante)
            : null,
        idRuta: Number(item.idRuta),
        idZona: Number(item.idZona),
        idZonaFin:
          item.idZonaFin !== null ? Number(item.idZonaFin) : null,
      }));

      //APi response
      const result: ApiResponseCommon = {
        data: viajes,
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

  private async consultarViajesPaginado(
    cliente: number,
    limit: number,
    offset: number,
  ) {
    const { ids, placeholders } = await this.clienteHijos(cliente);
    const query = `
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
  d.NumeroSerie AS numeroSerieValidador,
  ins.IdContador AS idContador,
  -- Contador
  c.NumeroSerie AS numeroSerieContador,
  ins.IdVehiculo AS idVehiculo,
  -- Vehículo
  vhl.Placa AS placaVehiculo,

  -- Operador
  o.Id AS idOperador,
  o.IdUsuario AS idUsuario,

  -- Usuario del operador
  u.Nombre AS nombreOperador,
  u.ApellidoPaterno AS apellidoPaternoOperador,
  u.ApellidoMaterno AS apellidoMaternoOperador,

  -- Variante
  der.Id AS idVariante,
  der.Nombre AS nombreVariante,
  der.PuntoInicio AS puntoInicioVariante,
  der.PuntoFin AS puntoFinVariante,
  der.DistanciaKm AS distanciaKmVariante,

  -- Ruta
  r.Id AS idRuta,
  r.Nombre AS nombreRuta,
  r.IdRegion AS idRegion,
  -- Zonas (Inicio y Fin)
  regInicio.Nombre AS nombreRegionInicio,
  r.IdRegionFin AS idRegionFin,
  -- Zonas (Inicio y Fin)
  regFin.Nombre AS nombreRegionFin

FROM Viajes v
JOIN Clientes c ON v.IdCliente = c.Id
JOIN Turnos t ON v.IdTurno = t.Id
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id
JOIN Validadores d ON ins.IdCliente = d.IdCliente AND ins.IdValidador = d.Id
JOIN Contadores c ON ins.IdCliente = c.IdCliente AND ins.IdContador = c.Id
JOIN Vehiculos vhl ON ins.IdCliente = vhl.IdCliente AND ins.IdVehiculo = vhl.Id
JOIN Operadores o ON v.IdOperador = o.Id
JOIN Usuarios u ON o.IdUsuario = u.Id
JOIN Variantes der ON v.IdVariante = der.Id
JOIN Rutas r ON der.IdRuta = r.Id
LEFT JOIN Zonas regInicio ON r.IdRegion = regInicio.Id
LEFT JOIN Zonas regFin ON r.IdZonaFin = regFin.Id

       
        AND c.Id IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar

ORDER BY v.Id DESC

  LIMIT ? OFFSET ?;
    `;
    return this.viajesRepository.query(query, [...ids, limit, offset]);
  }

  private async consultarTotalRutasPaginados(cliente: number) {
    const { ids, placeholders } = await this.clienteHijos(cliente);
    const query = `  
SELECT COUNT(*) AS total
FROM Viajes v
-- Cliente
JOIN Clientes c ON v.IdCliente = c.Id
JOIN Turnos t ON v.IdTurno = t.Id
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id
JOIN Validadores d ON ins.IdCliente = d.IdCliente AND ins.IdValidador = d.Id
JOIN Contadores c ON ins.IdCliente = c.IdCliente AND ins.IdContador = c.Id
JOIN Vehiculos vhl ON ins.IdCliente = vhl.IdCliente AND ins.IdVehiculo = vhl.Id
JOIN Operadores o ON v.IdOperador = o.Id
JOIN Usuarios u ON o.IdUsuario = u.Id
JOIN Variantes der ON v.IdVariante = der.Id
JOIN Rutas r ON der.IdRuta = r.Id
LEFT JOIN Zonas regInicio ON r.IdZona = regInicio.Id
LEFT JOIN Zonas regFin ON r.IdZonaFin = regFin.Id

       
        AND c.Id IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar
`;
    return await this.viajesRepository.query(query, [...ids]);
  }



  private async consultarViajesPaginadoCL(
    cliente: number,
    limit: number,
    offset: number,
  ) {
    const query = `
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
  ins.IdValidador AS idValidador,
  -- Validador
  d.NumeroSerie AS numeroSerieValidador,
  ins.IdContador AS idContador,
  -- Contador
  bv.NumeroSerie AS numeroSerieContador,
  ins.IdVehiculo AS idVehiculo,
  -- Vehículo
  vhl.Placa AS placaVehiculo,

  -- Operador
  o.Id AS idOperador,
  o.IdUsuario AS idUsuario,

  -- Usuario del operador
  u.Nombre AS nombreOperador,
  u.ApellidoPaterno AS apellidoPaternoOperador,
  u.ApellidoMaterno AS apellidoMaternoOperador,

  -- Variante
  der.Id AS idVariante,
  der.Nombre AS nombreVariante,
  der.PuntoInicio AS puntoInicioVariante,
  der.PuntoFin AS puntoFinVariante,
  der.DistanciaKm AS distanciaKmVariante,

  -- Ruta
  r.Id AS idRuta,
  r.Nombre AS nombreRuta,
  r.IdZona AS idZona,
  -- Zonas (Inicio y Fin)
  regInicio.Nombre AS nombreZonaInicio,
  r.IdZonaFin AS idZonaFin,
  -- Zonas (Inicio y Fin)
  regFin.Nombre AS nombreZonaFin

FROM Viajes v
JOIN Clientes c ON v.IdCliente = c.Id
JOIN Turnos t ON v.IdTurno = t.Id
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id

-- Validador
JOIN Validadores d ON ins.IdCliente = d.IdCliente AND ins.IdValidador = d.Id

-- Contador
JOIN Contadores bv ON ins.IdCliente = bv.IdCliente AND ins.IdContador = bv.Id

-- Vehículo
JOIN Vehiculos vhl ON ins.IdCliente = vhl.IdCliente AND ins.IdVehiculo = vhl.Id
JOIN Operadores o ON v.IdOperador = o.Id
JOIN Usuarios u ON o.IdUsuario = u.Id

-- Variante
JOIN Variantes der ON v.IdVariante = der.Id

-- Ruta
JOIN Rutas r ON der.IdRuta = r.Id

-- Zona de inicio
LEFT JOIN Zonas regInicio ON r.IdZona = regInicio.Id

-- Zona de fin
LEFT JOIN Zonas regFin ON r.IdZonaFin = regFin.Id

       
        AND c.Id = ?

ORDER BY v.Id DESC

  LIMIT ? OFFSET ?;
    `;
    return this.viajesRepository.query(query, [cliente, limit, offset]);
  }

  private async consultarTotalRutasPaginadosCL(cliente: number) {
    const query = `  
SELECT COUNT(*) AS total
FROM Viajes v
-- Cliente
JOIN Clientes c ON v.IdCliente = c.Id
JOIN Turnos t ON v.IdTurno = t.Id
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id
JOIN Validadores d ON ins.IdCliente = d.IdCliente AND ins.IdValidador = d.Id
JOIN Contadores bv ON ins.IdCliente = bv.IdCliente AND ins.IdContador = bv.Id
JOIN Vehiculos vhl ON ins.IdCliente = vhl.IdCliente AND ins.IdVehiculo = vhl.Id
JOIN Operadores o ON v.IdOperador = o.Id
JOIN Usuarios u ON o.IdUsuario = u.Id
JOIN Variantes der ON v.IdVariante = der.Id
JOIN Rutas r ON der.IdRuta = r.Id
LEFT JOIN Zonas regInicio ON r.IdZona = regInicio.Id
LEFT JOIN Zonas regFin ON r.IdZonaFin = regFin.Id

       
        AND c.Id = ?
`;
    return await this.viajesRepository.query(query, [cliente]);
  }

  // ========================================
  // 🔹 OBTENER PAGINADO DE VIAJES
  // ========================================
  async findAll(
    cliente: number,
    rol: number,
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    try {
      const offset = (page - 1) * limit;
      let totalResult;
      let viajes;
      switch (rol) {
        case 1:
          // Consulta de datos paginados Usuario SuperAdministrador
          viajes = await this.viajesRepository.query(
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
  ins.IdValidador AS idValidador,
  -- Validador
  d.NumeroSerie AS numeroSerieValidador,
  ins.IdContador AS idContador,
  -- Contador
  bv.NumeroSerie AS numeroSerieContador,
  ins.IdVehiculo AS idVehiculo,
  -- Vehículo
  vhl.Placa AS placaVehiculo,

  -- Operador
  o.Id AS idOperador,
  o.IdUsuario AS idUsuario,

  -- Usuario del operador
  u.Nombre AS nombreOperador,
  u.ApellidoPaterno AS apellidoPaternoOperador,
  u.ApellidoMaterno AS apellidoMaternoOperador,

  -- Variante
  der.Id AS idVariante,
  der.Nombre AS nombreVariante,
  der.PuntoInicio AS puntoInicioVariante,
  der.PuntoFin AS puntoFinVariante,
  der.DistanciaKm AS distanciaKmVariante,

  -- Ruta
  r.Id AS idRuta,
  r.Nombre AS nombreRuta,
  r.IdZona AS idZona,
  -- Zonas (Inicio y Fin)
  regInicio.Nombre AS nombreZonaInicio,
  r.IdZonaFin AS idZonaFin,
  -- Zonas (Inicio y Fin)
  regFin.Nombre AS nombreZonaFin

FROM Viajes v
JOIN Clientes c ON v.IdCliente = c.Id
JOIN Turnos t ON v.IdTurno = t.Id
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id

-- Validador
JOIN Validadores d ON ins.IdCliente = d.IdCliente AND ins.IdValidador = d.Id

-- Contador
JOIN Contadores bv ON ins.IdCliente = bv.IdCliente AND ins.IdContador = bv.Id

-- Vehículo
JOIN Vehiculos vhl ON ins.IdCliente = vhl.IdCliente AND ins.IdVehiculo = vhl.Id
JOIN Operadores o ON v.IdOperador = o.Id
JOIN Usuarios u ON o.IdUsuario = u.Id

-- Variante
JOIN Variantes der ON v.IdVariante = der.Id

-- Ruta
JOIN Rutas r ON der.IdRuta = r.Id

-- Zona de inicio
LEFT JOIN Zonas regInicio ON r.IdZona = regInicio.Id

-- Zona de fin
LEFT JOIN Zonas regFin ON r.IdZonaFin = regFin.Id

        

ORDER BY v.Id DESC
LIMIT ? OFFSET ?;
            `,
            [limit, offset],
          );

          // Query para total (sin paginación)
          totalResult = await this.viajesRepository.query(
            `
  SELECT COUNT(*) AS total
  FROM Viajes v
  
  `,
          );
          break;
        case 2: // Administrador
        case 8:  // Reportes
        case 10:  // Capturista
          // Consulta de datos paginados Usuario Administrador
          viajes = await this.consultarViajesPaginado(cliente, limit, offset);

          totalResult = await this.consultarTotalRutasPaginados(cliente);
          break;

        case 3:
        default:
          // Consulta de datos paginados Usuario Administrador
          viajes = await this.consultarViajesPaginadoCL(cliente, limit, offset);

          totalResult = await this.consultarTotalRutasPaginadosCL(cliente);
          break;
      }

      const data = viajes.map((item) => ({
        ...item,
        id: Number(item.id),
        idCliente: Number(item.idCliente),
        idTurno: Number(item.idTurno),
        idInstalacion: Number(item.idInstalacion),
        idValidador: Number(item.idValidador),
        idContador: Number(item.idContador),
        idVehiculo: Number(item.idVehiculo),
        idOperador: Number(item.idOperador),
        idUsuario: Number(item.idUsuario),
        idVariante: Number(item.idVariante),
        distanciaKmVariante:
          item.distanciaKmVariante !== null
            ? Number(item.distanciaKmVariante)
            : null,
        idRuta: Number(item.idRuta),
        idZona: Number(item.idZona),
        idZonaFin:
          item.idZonaFin !== null ? Number(item.idZonaFin) : null,
      }));

      const total = Number(totalResult[0]?.total || 0);

      //APi response
      const result: ApiResponseCommon = {
        data: viajes,
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

  private async consultarViajesOne(cliente: number, id: number) {
    const query = `
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
  ins.IdValidador AS idValidador,
  -- Validador
  d.NumeroSerie AS numeroSerieValidador,
  ins.IdContador AS idContador,
  -- Contador
  bv.NumeroSerie AS numeroSerieContador,
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

  -- Variante
  der.Id AS idVariante,
  der.Nombre AS nombreVariante,
  der.PuntoInicio AS puntoInicioVariante,
  der.PuntoFin AS puntoFinVariante,
  der.DistanciaKm AS distanciaKmVariante,

  -- Ruta
  r.Id AS idRuta,
  r.Nombre AS nombreRuta,
  r.IdZona AS idZona,
  -- Zonas (Inicio y Fin)
  regInicio.Nombre AS nombreZonaInicio,
  r.IdZonaFin AS idZonaFin,
  -- Zonas (Inicio y Fin)
  regFin.Nombre AS nombreZonaFin

FROM Viajes v
-- Cliente
JOIN Clientes c ON v.IdCliente = c.Id

-- Turno
JOIN Turnos t ON v.IdTurno = t.Id

-- Instalación
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id

-- Validador
JOIN Validadores d ON ins.IdCliente = d.IdCliente AND ins.IdValidador = d.Id

-- Contador
JOIN Contadores bv ON ins.IdCliente = bv.IdCliente AND ins.IdContador = bv.Id

-- Vehículo
JOIN Vehiculos vhl ON ins.IdCliente = vhl.IdCliente AND ins.IdVehiculo = vhl.Id

-- Operador
JOIN Operadores o ON v.IdOperador = o.Id

-- Usuario del operador
JOIN Usuarios u ON o.IdUsuario = u.Id

-- Variante
JOIN Variantes der ON v.IdVariante = der.Id

-- Ruta
JOIN Rutas r ON der.IdRuta = r.Id

-- Zona de inicio
LEFT JOIN Zonas regInicio ON r.IdZona = regInicio.Id

-- Zona de fin
LEFT JOIN Zonas regFin ON r.IdZonaFin = regFin.Id

        WHERE c.Id = ?
        AND v.Id = ?

ORDER BY v.Id DESC
    `;
    return this.viajesRepository.query(query, [cliente, id]);
  }

  async findOne(id: number, cliente: number, rol: number) {
    try {
      let viajes;
      viajes = await this.viajesRepository.query(
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
  ins.IdValidador AS idValidador,
  -- Validador
  d.NumeroSerie AS numeroSerieValidador,
  ins.IdContador AS idContador,
  -- Contador
  bv.NumeroSerie AS numeroSerieContador,
  ins.IdVehiculo AS idVehiculo,
  -- Vehículo
  vhl.Placa AS placaVehiculo,

  -- Operador
  o.Id AS idOperador,
  o.IdUsuario AS idUsuario,

  -- Usuario del operador
  u.Nombre AS nombreOperador,
  u.ApellidoPaterno AS apellidoPaternoOperador,
  u.ApellidoMaterno AS apellidoMaternoOperador,

  -- Variante
  der.Id AS idVariante,
  der.Nombre AS nombreVariante,
  der.PuntoInicio AS puntoInicioVariante,
  der.PuntoFin AS puntoFinVariante,
  der.DistanciaKm AS distanciaKmVariante,

  -- Ruta
  r.Id AS idRuta,
  r.Nombre AS nombreRuta,
  r.IdZona AS idZona,
  -- Zonas (Inicio y Fin)
  regInicio.Nombre AS nombreZonaInicio,
  r.IdZonaFin AS idZonaFin,
  -- Zonas (Inicio y Fin)
  regFin.Nombre AS nombreZonaFin

FROM Viajes v

JOIN Clientes c ON v.IdCliente = c.Id
JOIN Turnos t ON v.IdTurno = t.Id
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id

-- Validador
JOIN Validadores d ON ins.IdCliente = d.IdCliente AND ins.IdValidador = d.Id

-- Contador
JOIN Contadores bv ON ins.IdCliente = bv.IdCliente AND ins.IdContador = bv.Id

-- Vehículo
JOIN Vehiculos vhl ON ins.IdCliente = vhl.IdCliente AND ins.IdVehiculo = vhl.Id
JOIN Operadores o ON v.IdOperador = o.Id
JOIN Usuarios u ON o.IdUsuario = u.Id

-- Variante
JOIN Variantes der ON v.IdVariante = der.Id

-- Ruta
JOIN Rutas r ON der.IdRuta = r.Id

-- Zona de inicio
LEFT JOIN Zonas regInicio ON r.IdZona = regInicio.Id

-- Zona de fin
LEFT JOIN Zonas regFin ON r.IdZonaFin = regFin.Id

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
        idValidador: Number(viaje.idValidador),
        idContador: Number(viaje.idContador),
        idVehiculo: Number(viaje.idVehiculo),
        idOperador: Number(viaje.idOperador),
        idUsuario: Number(viaje.idUsuario),
        idVariante: Number(viaje.idVariante),
        distanciaKmVariante:
          viaje.distanciaKmVariante !== null
            ? Number(viaje.distanciaKmVariante)
            : null,
        idRuta: Number(viaje.idRuta),
        idZona: Number(viaje.idZona),
        idZonaFin:
          viaje.idZonaFin !== null ? Number(viaje.idZonaFin) : null,
      };

      //APi response
      const result: ApiResponseCommon = {
        data: viajes,
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
