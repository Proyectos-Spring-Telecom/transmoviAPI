import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateTurnoDto } from './dto/create-turno.dto';
import { UpdateTurnoDto } from './dto/update-turno.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Turnos } from 'src/entities/Turnos';
import { Repository } from 'typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { UpdateTurnosEstatusDto } from './dto/update-turno-estatus.dto';
import { Clientes } from 'src/entities/Clientes';
import { Viajes } from 'src/entities/Viajes';
import { EnumModulos, EstatusEnum } from 'src/common/estatus.enum';
import { horaDesfasada } from 'src/utils/correccion-hora';
import { ViajesService } from 'src/viajes/viajes.service';

@Injectable()
export class TurnosService {
  constructor(
    @InjectRepository(Turnos)
    private readonly turnosRepository: Repository<Turnos>,
    @InjectRepository(Clientes)
    private readonly clienteRepository: Repository<Clientes>,
    @InjectRepository(Viajes)
    private readonly viajesRepository: Repository<Viajes>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly viajesService: ViajesService,
  ) {}

  async create(
    idUser: number,
    cliente: number,
    idOperador: number,
    createTurnoDto: CreateTurnoDto,
  ): Promise<ApiCrudResponse> {
    try {
      //validamos que el usuario sea rol operador
      if (!idOperador) {
        throw new UnauthorizedException(`El usuario no está autorizado para generar un turno.`)
      }
      
      //Creamos el turno

      const { fechaDesfasada, fechaActual } = await horaDesfasada();
      const { numeroSerieDispositivo, ...body } = createTurnoDto;

      const query = `
      SELECT i.Id
      FROM Dispositivos d
      INNER JOIN Instalaciones i ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
      WHERE d.NumeroSerie = ? AND i.Estatus = 1
      `;

      const instalacion = await this.turnosRepository.query(query, [numeroSerieDispositivo]);
      if (instalacion.length === 0) {
        throw new NotFoundException('No se ha encontrado la instalación asignada al dispositivo.');
      }

      body.inicio = fechaDesfasada;
      body.estatus = EstatusEnum.ACTIVO;
      body.idCliente = cliente;
      body.idOperador = idOperador;
      body.idInstalacion = instalacion[0].Id

      const newTurno = await this.turnosRepository.create(body);
      const turnoSave = await this.turnosRepository.save(newTurno);

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { createTurnoDto };
      await this.bitacoraLogger.logToBitacora(
        'Turnos',
        `El turno con ID: ${turnoSave.id} fue creado correctamente.`,
        'CREATE',
        querylogger,
        idUser,
        EnumModulos.TURNOS,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'El turno ha sido creado con éxito.',
        data: {
          id: Number(turnoSave.id),
          nombre:
            `id turno: ${turnoSave.id}, IdCliente: ${turnoSave.idCliente},  IdOperador: ${turnoSave.idOperador}, IdInstalacion: ${turnoSave.idInstalacion} ` ||
            '',
        },
      };
      return result;
    } catch (error) {
      console.log(error);
      //-----Registro en la bitacora----- ERROR
      const querylogger = { createTurnoDto };
      await this.bitacoraLogger.logToBitacora(
        'Turnos',
        `El turno con ID fue creado correctamente.`,
        'CREATE',
        querylogger,
        idUser,
        EnumModulos.TURNOS,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: `Hubo un problema al crear el turno.`,
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

  /**
   * Parsea y normaliza el array blueVoxs (JSON_ARRAYAGG). Alineado con instalaciones/viajes.
   */
  private parseBlueVoxs(raw: any): any[] {
    if (raw == null) return [];
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return [];
    return arr.map((b: any) => ({
      ...b,
      idBlueVox: b.idBlueVox != null ? Number(b.idBlueVox) : null,
    }));
  }

  private async consultarTurnoPaginado(
    cliente: number,
    limit: number,
    offset: number,
  ) {
    const hijos = await this.clienteHijos(cliente);
    if ('data' in hijos && !('ids' in hijos)) return [];
    const { ids, placeholders } = hijos;
    const query = `
SELECT
  -- Turno
  t.Id AS id,
  t.Inicio AS inicio,
  t.Fin AS fin,
  t.FechaCreacion AS fechaCreacion,
  t.FechaActualizacion AS fechaActualizacion,
  t.Estatus AS estatus,

  -- Instalación
  i.Id AS idInstalacion,
  i.FechaCreacion AS fechaCreacionInstalacion,
  i.FechaActualizacion AS fechaActualizacionInstalacion,
  i.Estatus AS estatusInstalacion,

  -- Dispositivo
  d.Id AS idDispositivo,
  d.NumeroSerie AS numeroSerieDispositivo,
  d.Marca AS marcaDispositivo,
  d.Modelo AS modeloDispositivo,

  COALESCE(
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'idBlueVox', bx.Id,
          'numeroSerieBlueVox', bx.NumeroSerie,
          'marcaBlueVox', bx.Marca,
          'modeloBlueVox', bx.Modelo
        )
      )
      FROM InstalacionesBlueVoxs ibv
      INNER JOIN BlueVoxs bx ON ibv.IdBlueVox = bx.Id
      WHERE ibv.IdInstalacion = i.Id
        AND ibv.Estatus = 1
        AND bx.IdCliente = i.IdCliente
    ),
    JSON_ARRAY()
  ) AS blueVoxs,

  -- Vehículo
  v.Id AS idVehiculo,
  v.Marca AS marcaVehiculo,
  v.Modelo AS modeloVehiculo,
  v.Placa AS placaVehiculo,
  v.NumeroEconomico AS numeroEconomicoVehiculo,

  -- Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente,

  -- Operador
  o.Id AS idOperador,
 
  o.FechaNacimiento AS fechaNacimientoOperador,
  u.Nombre AS nombreOperador,
  u.ApellidoPaterno AS apellidoPaternoOperador,
  u.ApellidoMaterno AS apellidoMaternoOperador

FROM Turnos t
INNER JOIN Instalaciones i ON t.IdInstalacion = i.Id
INNER JOIN Dispositivos d ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
INNER JOIN Clientes c ON t.IdCliente = c.Id
INNER JOIN Operadores o ON t.IdOperador = o.Id
INNER JOIN Usuarios u ON o.IdUsuario = u.Id

WHERE t.Estatus = 1 AND c.Estatus = 1 AND c.Id IN (${placeholders})
ORDER BY t.Id DESC
LIMIT ? OFFSET ?
   `;
    return this.turnosRepository.query(query, [...ids, limit, offset]);
  }

  private async consultarTotalTurnosPaginados(cliente: number) {
    const hijos = await this.clienteHijos(cliente);
    if ('data' in hijos && !('ids' in hijos)) return [{ total: 0 }];
    const { ids, placeholders } = hijos;
    const query = `
SELECT COUNT(*) AS total
FROM Turnos t
INNER JOIN Instalaciones i ON t.IdInstalacion = i.Id
INNER JOIN Dispositivos d ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
INNER JOIN Clientes c ON t.IdCliente = c.Id
INNER JOIN Operadores o ON t.IdOperador = o.Id
INNER JOIN Usuarios u ON o.IdUsuario = u.Id
WHERE t.Estatus = 1 AND c.Estatus = 1 AND c.Id IN (${placeholders})
`;
    return await this.turnosRepository.query(query, [...ids]);
  }

  async findAll(
    idUser: number,
    cliente: number,
    rol: number,
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    try {
      const offset = (page - 1) * limit;
      let totalResult;
      let turnos;
      switch (rol) {
        case 1:
          // Usuario SuperAdministrador
          turnos = await this.turnosRepository.query(
            `
SELECT
  -- Turno
  t.Id AS id,
  t.Inicio AS inicio,
  t.Fin AS fin,
  t.FechaCreacion AS fechaCreacion,
  t.FechaActualizacion AS fechaActualizacion,
  t.Estatus AS estatus,

  -- Instalación
  i.Id AS idInstalacion,
  i.FechaCreacion AS fechaCreacionInstalacion,
  i.FechaActualizacion AS fechaActualizacionInstalacion,
  i.Estatus AS estatusInstalacion,

  -- Dispositivo
  d.Id AS idDispositivo,
  d.NumeroSerie AS numeroSerieDispositivo,
  d.Marca AS marcaDispositivo,
  d.Modelo AS modeloDispositivo,

  COALESCE(
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'idBlueVox', bx.Id,
          'numeroSerieBlueVox', bx.NumeroSerie,
          'marcaBlueVox', bx.Marca,
          'modeloBlueVox', bx.Modelo
        )
      )
      FROM InstalacionesBlueVoxs ibv
      INNER JOIN BlueVoxs bx ON ibv.IdBlueVox = bx.Id
      WHERE ibv.IdInstalacion = i.Id
        AND ibv.Estatus = 1
        AND bx.IdCliente = i.IdCliente
    ),
    JSON_ARRAY()
  ) AS blueVoxs,

  -- Vehículo
  v.Id AS idVehiculo,
  v.Marca AS marcaVehiculo,
  v.Modelo AS modeloVehiculo,
  v.Placa AS placaVehiculo,
  v.NumeroEconomico AS numeroEconomicoVehiculo,

  -- Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente,

  -- Operador
  o.Id AS idOperador,
 
  o.FechaNacimiento AS fechaNacimientoOperador,
  u.Nombre AS nombreOperador,
  u.ApellidoPaterno AS apellidoPaternoOperador,
  u.ApellidoMaterno AS apellidoMaternoOperador

FROM Turnos t
INNER JOIN Instalaciones i ON t.IdInstalacion = i.Id
INNER JOIN Dispositivos d ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
INNER JOIN Clientes c ON t.IdCliente = c.Id
INNER JOIN Operadores o ON t.IdOperador = o.Id
INNER JOIN Usuarios u ON o.IdUsuario = u.Id
WHERE t.Estatus = 1 AND c.Estatus = 1
ORDER BY t.Id DESC
LIMIT ? OFFSET ?
            `,
            [limit, offset],
          );

          totalResult = await this.turnosRepository.query(
            `
SELECT COUNT(*) AS total
FROM Turnos t
INNER JOIN Instalaciones i ON t.IdInstalacion = i.Id
INNER JOIN Dispositivos d ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
INNER JOIN Clientes c ON t.IdCliente = c.Id
INNER JOIN Operadores o ON t.IdOperador = o.Id
INNER JOIN Usuarios u ON o.IdUsuario = u.Id
WHERE t.Estatus = 1 AND c.Estatus = 1
            `,
          );
          break;

        case 2:
          turnos = await this.consultarTurnoPaginado(cliente, limit, offset);

          // Query para total (sin paginación)
          totalResult = await this.consultarTotalTurnosPaginados(cliente);
          break;

        case 8:
          turnos = await this.consultarTurnoPaginado(cliente, limit, offset);

          // Query para total (sin paginación)
          totalResult = await this.consultarTotalTurnosPaginados(cliente);
          break;

        case 10:
          turnos = await this.consultarTurnoPaginado(cliente, limit, offset);

          // Query para total (sin paginación)
          totalResult = await this.consultarTotalTurnosPaginados(cliente);
          break;

        default:
          turnos = await this.turnosRepository.query(
            `
SELECT
  -- Turno
  t.Id AS id,
  t.Inicio AS inicio,
  t.Fin AS fin,
  t.FechaCreacion AS fechaCreacion,
  t.FechaActualizacion AS fechaActualizacion,
  t.Estatus AS estatus,

  -- Instalación
  i.Id AS idInstalacion,
  i.FechaCreacion AS fechaCreacionInstalacion,
  i.FechaActualizacion AS fechaActualizacionInstalacion,
  i.Estatus AS estatusInstalacion,

  -- Dispositivo
  d.Id AS idDispositivo,
  d.NumeroSerie AS numeroSerieDispositivo,
  d.Marca AS marcaDispositivo,
  d.Modelo AS modeloDispositivo,

  COALESCE(
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'idBlueVox', bx.Id,
          'numeroSerieBlueVox', bx.NumeroSerie,
          'marcaBlueVox', bx.Marca,
          'modeloBlueVox', bx.Modelo
        )
      )
      FROM InstalacionesBlueVoxs ibv
      INNER JOIN BlueVoxs bx ON ibv.IdBlueVox = bx.Id
      WHERE ibv.IdInstalacion = i.Id
        AND ibv.Estatus = 1
        AND bx.IdCliente = i.IdCliente
    ),
    JSON_ARRAY()
  ) AS blueVoxs,

  -- Vehículo
  v.Id AS idVehiculo,
  v.Marca AS marcaVehiculo,
  v.Modelo AS modeloVehiculo,
  v.Placa AS placaVehiculo,
  v.NumeroEconomico AS numeroEconomicoVehiculo,

  -- Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente,

  -- Operador
  o.Id AS idOperador,
 
  o.FechaNacimiento AS fechaNacimientoOperador,
  u.Nombre AS nombreOperador,
  u.ApellidoPaterno AS apellidoPaternoOperador,
  u.ApellidoMaterno AS apellidoMaternoOperador

FROM UsuariosInstalaciones ui
INNER JOIN Instalaciones i ON ui.IdInstalacion = i.Id
INNER JOIN Turnos t ON t.IdInstalacion = i.Id
INNER JOIN Clientes c ON i.IdCliente = c.Id
LEFT JOIN Dispositivos d ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
LEFT JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
LEFT JOIN Operadores o ON t.IdOperador = o.Id
LEFT JOIN Usuarios u ON o.IdUsuario = u.Id

WHERE ui.IdUsuario = ?
  AND ui.Estatus = 1
  AND i.Estatus = 1
  AND t.Estatus = 1
  AND c.Estatus = 1
ORDER BY t.Inicio DESC
LIMIT ? OFFSET ?
            `,
            [idUser, limit, offset],
          );

          totalResult = await this.turnosRepository.query(
            `
SELECT COUNT(*) AS total
FROM UsuariosInstalaciones ui
INNER JOIN Instalaciones i ON ui.IdInstalacion = i.Id
INNER JOIN Turnos t ON t.IdInstalacion = i.Id AND t.IdCliente = i.IdCliente
LEFT JOIN Dispositivos d ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
LEFT JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
INNER JOIN Clientes c ON i.IdCliente = c.Id
INNER JOIN Operadores o ON t.IdOperador = o.Id
INNER JOIN Usuarios u ON o.IdUsuario = u.Id
WHERE ui.IdUsuario = ?
  AND ui.Estatus = 1
  AND i.Estatus = 1
  AND t.Estatus = 1
  AND c.Estatus = 1
            `,
            [idUser],
          );
          break;
      }

      const total = Number(totalResult[0]?.total || 0);

      const data = turnos.map((item) => ({
        ...item,
        id: Number(item.id),
        idInstalacion: Number(item.idInstalacion),
        idDispositivo: item.idDispositivo != null ? Number(item.idDispositivo) : null,
        blueVoxs: this.parseBlueVoxs(item.blueVoxs),
        idVehiculo: item.idVehiculo != null ? Number(item.idVehiculo) : null,
        idCliente: Number(item.idCliente),
        idOperador: Number(item.idOperador),
      }));

      const result: ApiResponseCommon = {
        data,
        paginated: {
          total: total,
          page,
          lastPage: Math.ceil(total / limit),
        },
      };
      return result;
    } catch (error) {
      console.log(error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: `No fue posible obtener la paginación de turnos.`,
        error: error.message,
      });
    }
  }

  private async consultarTurnoListado(cliente: number) {
    const hijos = await this.clienteHijos(cliente);
    if ('data' in hijos && !('ids' in hijos)) return [];
    const { ids, placeholders } = hijos;
    const query = `
SELECT
  -- Turno
  t.Id AS id,
  t.Inicio AS inicio,
  t.Fin AS fin,
  t.FechaCreacion AS fechaCreacion,
  t.FechaActualizacion AS fechaActualizacion,
  t.Estatus AS estatus,

  -- Instalación
  i.Id AS idInstalacion,
  i.FechaCreacion AS fechaCreacionInstalacion,
  i.FechaActualizacion AS fechaActualizacionInstalacion,
  i.Estatus AS estatusInstalacion,

  -- Dispositivo
  d.Id AS idDispositivo,
  d.NumeroSerie AS numeroSerieDispositivo,
  d.Marca AS marcaDispositivo,
  d.Modelo AS modeloDispositivo,

  COALESCE(
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'idBlueVox', bx.Id,
          'numeroSerieBlueVox', bx.NumeroSerie,
          'marcaBlueVox', bx.Marca,
          'modeloBlueVox', bx.Modelo
        )
      )
      FROM InstalacionesBlueVoxs ibv
      INNER JOIN BlueVoxs bx ON ibv.IdBlueVox = bx.Id
      WHERE ibv.IdInstalacion = i.Id
        AND ibv.Estatus = 1
        AND bx.IdCliente = i.IdCliente
    ),
    JSON_ARRAY()
  ) AS blueVoxs,

  -- Vehículo
  v.Id AS idVehiculo,
  v.Marca AS marcaVehiculo,
  v.Modelo AS modeloVehiculo,
  v.Placa AS placaVehiculo,
  v.NumeroEconomico AS numeroEconomicoVehiculo,

  -- Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente,

  -- Operador
  o.Id AS idOperador,
 
  o.FechaNacimiento AS fechaNacimientoOperador,
  u.Nombre AS nombreOperador,
  u.ApellidoPaterno AS apellidoPaternoOperador,
  u.ApellidoMaterno AS apellidoMaternoOperador

FROM Turnos t
INNER JOIN Instalaciones i ON t.IdInstalacion = i.Id
INNER JOIN Dispositivos d ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
INNER JOIN Clientes c ON t.IdCliente = c.Id
INNER JOIN Operadores o ON t.IdOperador = o.Id
INNER JOIN Usuarios u ON o.IdUsuario = u.Id

WHERE t.Estatus = 1
AND c.Estatus = 1
AND c.Id IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar

ORDER BY t.Id DESC;
   `;
    return this.turnosRepository.query(query, [...ids]);
  }

  async findAllList(idUser: number, cliente: number, rol: number) {
    try {
      let turnos;
      switch (rol) {
        case 1:
          // Usuario SuperAdministrador
          turnos = await this.turnosRepository.query(
            `
SELECT
  -- Turno
  t.Id AS id,
  t.Inicio AS inicio,
  t.Fin AS fin,
  t.FechaCreacion AS fechaCreacion,
  t.FechaActualizacion AS fechaActualizacion,
  t.Estatus AS estatus,

  -- Instalación
  i.Id AS idInstalacion,
  i.FechaCreacion AS fechaCreacionInstalacion,
  i.FechaActualizacion AS fechaActualizacionInstalacion,
  i.Estatus AS estatusInstalacion,

  -- Dispositivo
  d.Id AS idDispositivo,
  d.NumeroSerie AS numeroSerieDispositivo,
  d.Marca AS marcaDispositivo,
  d.Modelo AS modeloDispositivo,

  COALESCE(
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'idBlueVox', bx.Id,
          'numeroSerieBlueVox', bx.NumeroSerie,
          'marcaBlueVox', bx.Marca,
          'modeloBlueVox', bx.Modelo
        )
      )
      FROM InstalacionesBlueVoxs ibv
      INNER JOIN BlueVoxs bx ON ibv.IdBlueVox = bx.Id
      WHERE ibv.IdInstalacion = i.Id
        AND ibv.Estatus = 1
        AND bx.IdCliente = i.IdCliente
    ),
    JSON_ARRAY()
  ) AS blueVoxs,

  -- Vehículo
  v.Id AS idVehiculo,
  v.Marca AS marcaVehiculo,
  v.Modelo AS modeloVehiculo,
  v.Placa AS placaVehiculo,
  v.NumeroEconomico AS numeroEconomicoVehiculo,

  -- Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente,

  -- Operador
  o.Id AS idOperador,
 
  o.FechaNacimiento AS fechaNacimientoOperador,
  u.Nombre AS nombreOperador,
  u.ApellidoPaterno AS apellidoPaternoOperador,
  u.ApellidoMaterno AS apellidoMaternoOperador

FROM Turnos t
INNER JOIN Instalaciones i ON t.IdInstalacion = i.Id
INNER JOIN Dispositivos d ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
INNER JOIN Clientes c ON t.IdCliente = c.Id
INNER JOIN Operadores o ON t.IdOperador = o.Id
INNER JOIN Usuarios u ON o.IdUsuario = u.Id

WHERE t.Estatus = 1
AND c.Estatus = 1

ORDER BY t.Id DESC;
            `,
          );
          break;

        case 2:
          turnos = await this.consultarTurnoListado(cliente);
          break;

        case 8:
          turnos = await this.consultarTurnoListado(cliente);
          break;

        case 10:
          turnos = await this.consultarTurnoListado(cliente);
          break;

        default:
          turnos = await this.turnosRepository.query(
            `
SELECT
  -- Turno
  t.Id AS id,
  t.Inicio AS inicio,
  t.Fin AS fin,
  t.FechaCreacion AS fechaCreacion,
  t.FechaActualizacion AS fechaActualizacion,
  t.Estatus AS estatus,

  -- Instalación
  i.Id AS idInstalacion,
  i.FechaCreacion AS fechaCreacionInstalacion,
  i.FechaActualizacion AS fechaActualizacionInstalacion,
  i.Estatus AS estatusInstalacion,

  -- Dispositivo
  d.Id AS idDispositivo,
  d.NumeroSerie AS numeroSerieDispositivo,
  d.Marca AS marcaDispositivo,
  d.Modelo AS modeloDispositivo,

  COALESCE(
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'idBlueVox', bx.Id,
          'numeroSerieBlueVox', bx.NumeroSerie,
          'marcaBlueVox', bx.Marca,
          'modeloBlueVox', bx.Modelo
        )
      )
      FROM InstalacionesBlueVoxs ibv
      INNER JOIN BlueVoxs bx ON ibv.IdBlueVox = bx.Id
      WHERE ibv.IdInstalacion = i.Id
        AND ibv.Estatus = 1
        AND bx.IdCliente = i.IdCliente
    ),
    JSON_ARRAY()
  ) AS blueVoxs,

  -- Vehículo
  v.Id AS idVehiculo,
  v.Marca AS marcaVehiculo,
  v.Modelo AS modeloVehiculo,
  v.Placa AS placaVehiculo,
  v.NumeroEconomico AS numeroEconomicoVehiculo,

  -- Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente,

  -- Operador
  o.Id AS idOperador,
 
  o.FechaNacimiento AS fechaNacimientoOperador,
  u.Nombre AS nombreOperador,
  u.ApellidoPaterno AS apellidoPaternoOperador,
  u.ApellidoMaterno AS apellidoMaternoOperador

FROM UsuariosInstalaciones ui
INNER JOIN Instalaciones i ON ui.IdInstalacion = i.Id
INNER JOIN Turnos t ON t.IdInstalacion = i.Id AND t.IdCliente = i.IdCliente
INNER JOIN Dispositivos d ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
INNER JOIN Clientes c ON i.IdCliente = c.Id
INNER JOIN Operadores o ON t.IdOperador = o.Id
INNER JOIN Usuarios u ON o.IdUsuario = u.Id

WHERE ui.IdUsuario = ?
  AND ui.Estatus = 1
  AND i.Estatus = 1
  AND t.Estatus = 1
  AND c.Estatus = 1

ORDER BY t.Id DESC;
            `,
            [idUser],
          );
          break;
      }

      const data = turnos.map((item) => ({
        ...item,
        id: Number(item.id),
        idInstalacion: Number(item.idInstalacion),
        idDispositivo: item.idDispositivo != null ? Number(item.idDispositivo) : null,
        blueVoxs: this.parseBlueVoxs(item.blueVoxs),
        idVehiculo: item.idVehiculo != null ? Number(item.idVehiculo) : null,
        idCliente: Number(item.idCliente),
        idOperador: Number(item.idOperador),
      }));

      const result: ApiResponseCommon = { data };
      return result;
    } catch (error) {
      console.log(error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: `Ocurrió un inconveniente al intentar cargar el listado de turnos.`,
        error: error.message,
      });
    }
  }

  private async consultarTurnoOne(cliente: number, id: number) {
    const hijos = await this.clienteHijos(cliente);
    if ('data' in hijos && !('ids' in hijos)) return [];
    const { ids, placeholders } = hijos;
    const query = `
SELECT
  -- Turno
  t.Id AS id,
  t.Inicio AS inicio,
  t.Fin AS fin,
  t.FechaCreacion AS fechaCreacion,
  t.FechaActualizacion AS fechaActualizacion,
  t.Estatus AS estatus,

  -- Instalación
  i.Id AS idInstalacion,
  i.FechaCreacion AS fechaCreacionInstalacion,
  i.FechaActualizacion AS fechaActualizacionInstalacion,
  i.Estatus AS estatusInstalacion,

  -- Dispositivo
  d.Id AS idDispositivo,
  d.NumeroSerie AS numeroSerieDispositivo,
  d.Marca AS marcaDispositivo,
  d.Modelo AS modeloDispositivo,

  COALESCE(
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'idBlueVox', bx.Id,
          'numeroSerieBlueVox', bx.NumeroSerie,
          'marcaBlueVox', bx.Marca,
          'modeloBlueVox', bx.Modelo
        )
      )
      FROM InstalacionesBlueVoxs ibv
      INNER JOIN BlueVoxs bx ON ibv.IdBlueVox = bx.Id
      WHERE ibv.IdInstalacion = i.Id
        AND ibv.Estatus = 1
        AND bx.IdCliente = i.IdCliente
    ),
    JSON_ARRAY()
  ) AS blueVoxs,

  -- Vehículo
  v.Id AS idVehiculo,
  v.Marca AS marcaVehiculo,
  v.Modelo AS modeloVehiculo,
  v.Placa AS placaVehiculo,
  v.NumeroEconomico AS numeroEconomicoVehiculo,

  -- Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente,

  -- Operador
  o.Id AS idOperador,
 
  o.FechaNacimiento AS fechaNacimientoOperador,
  u.Nombre AS nombreOperador,
  u.ApellidoPaterno AS apellidoPaternoOperador,
  u.ApellidoMaterno AS apellidoMaternoOperador

FROM Turnos t
INNER JOIN Instalaciones i ON t.IdInstalacion = i.Id
INNER JOIN Dispositivos d ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
INNER JOIN Clientes c ON t.IdCliente = c.Id
INNER JOIN Operadores o ON t.IdOperador = o.Id
INNER JOIN Usuarios u ON o.IdUsuario = u.Id

WHERE c.Id IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar
AND t.Id = ?

ORDER BY t.Id DESC;
   `;
    return this.turnosRepository.query(query, [...ids, id]);
  }

  async findOne(id: number, idUser: number, cliente: number, rol: number) {
    try {
      let turnos;
      switch (rol) {
        case 1:
          // Usuario SuperAdministrador
          turnos = await this.turnosRepository.query(
            `
SELECT
  -- Turno
  t.Id AS id,
  t.Inicio AS inicio,
  t.Fin AS fin,
  t.FechaCreacion AS fechaCreacion,
  t.FechaActualizacion AS fechaActualizacion,
  t.Estatus AS estatus,

  -- Instalación
  i.Id AS idInstalacion,
  i.FechaCreacion AS fechaCreacionInstalacion,
  i.FechaActualizacion AS fechaActualizacionInstalacion,
  i.Estatus AS estatusInstalacion,

  -- Dispositivo
  d.Id AS idDispositivo,
  d.NumeroSerie AS numeroSerieDispositivo,
  d.Marca AS marcaDispositivo,
  d.Modelo AS modeloDispositivo,

  COALESCE(
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'idBlueVox', bx.Id,
          'numeroSerieBlueVox', bx.NumeroSerie,
          'marcaBlueVox', bx.Marca,
          'modeloBlueVox', bx.Modelo
        )
      )
      FROM InstalacionesBlueVoxs ibv
      INNER JOIN BlueVoxs bx ON ibv.IdBlueVox = bx.Id
      WHERE ibv.IdInstalacion = i.Id
        AND ibv.Estatus = 1
        AND bx.IdCliente = i.IdCliente
    ),
    JSON_ARRAY()
  ) AS blueVoxs,

  -- Vehículo
  v.Id AS idVehiculo,
  v.Marca AS marcaVehiculo,
  v.Modelo AS modeloVehiculo,
  v.Placa AS placaVehiculo,
  v.NumeroEconomico AS numeroEconomicoVehiculo,

  -- Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente,

  -- Operador
  o.Id AS idOperador,
 
  o.FechaNacimiento AS fechaNacimientoOperador,
  u.Nombre AS nombreOperador,
  u.ApellidoPaterno AS apellidoPaternoOperador,
  u.ApellidoMaterno AS apellidoMaternoOperador

FROM Turnos t
INNER JOIN Instalaciones i ON t.IdInstalacion = i.Id
INNER JOIN Dispositivos d ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
INNER JOIN Clientes c ON t.IdCliente = c.Id
INNER JOIN Operadores o ON t.IdOperador = o.Id
INNER JOIN Usuarios u ON o.IdUsuario = u.Id

WHERE t.Id = ?

ORDER BY t.Id DESC;
            `,
            [id],
          );
          break;

        case 2:
          turnos = await this.consultarTurnoOne(cliente, id);
          break;

        case 8:
          turnos = await this.consultarTurnoOne(cliente, id);
          break;

        case 10:
          turnos = await this.consultarTurnoOne(cliente, id);
          break;

        default:
          turnos = await this.turnosRepository.query(
            `
SELECT
  -- Turno
  t.Id AS id,
  t.Inicio AS inicio,
  t.Fin AS fin,
  t.FechaCreacion AS fechaCreacion,
  t.FechaActualizacion AS fechaActualizacion,
  t.Estatus AS estatus,

  -- Instalación
  i.Id AS idInstalacion,
  i.FechaCreacion AS fechaCreacionInstalacion,
  i.FechaActualizacion AS fechaActualizacionInstalacion,
  i.Estatus AS estatusInstalacion,

  -- Dispositivo
  d.Id AS idDispositivo,
  d.NumeroSerie AS numeroSerieDispositivo,
  d.Marca AS marcaDispositivo,
  d.Modelo AS modeloDispositivo,

  COALESCE(
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'idBlueVox', bx.Id,
          'numeroSerieBlueVox', bx.NumeroSerie,
          'marcaBlueVox', bx.Marca,
          'modeloBlueVox', bx.Modelo
        )
      )
      FROM InstalacionesBlueVoxs ibv
      INNER JOIN BlueVoxs bx ON ibv.IdBlueVox = bx.Id
      WHERE ibv.IdInstalacion = i.Id
        AND ibv.Estatus = 1
        AND bx.IdCliente = i.IdCliente
    ),
    JSON_ARRAY()
  ) AS blueVoxs,

  -- Vehículo
  v.Id AS idVehiculo,
  v.Marca AS marcaVehiculo,
  v.Modelo AS modeloVehiculo,
  v.Placa AS placaVehiculo,
  v.NumeroEconomico AS numeroEconomicoVehiculo,

  -- Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente,

  -- Operador
  o.Id AS idOperador,
 
  o.FechaNacimiento AS fechaNacimientoOperador,
  u.Nombre AS nombreOperador,
  u.ApellidoPaterno AS apellidoPaternoOperador,
  u.ApellidoMaterno AS apellidoMaternoOperador

FROM Turnos t
INNER JOIN Instalaciones i ON t.IdInstalacion = i.Id
INNER JOIN Clientes c ON t.IdCliente = c.Id
LEFT JOIN Dispositivos d ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
LEFT JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
LEFT JOIN Operadores o ON t.IdOperador = o.Id
LEFT JOIN Usuarios u ON o.IdUsuario = u.Id

WHERE t.Id = ?
  AND EXISTS (                -- 🔹 asegura que el usuario está asignado a la instalación
    SELECT 1 
    FROM UsuariosInstalaciones ui
    WHERE ui.IdInstalacion = i.Id 
      AND ui.IdUsuario = ?
      AND ui.Estatus = 1
  )

ORDER BY t.Inicio DESC;
            `,
            [id, idUser],
          );
          break;
      }

      if (turnos.length === 0) {
        throw new NotFoundException(
          'No fue posible localizar turnos, o los datos son nulos.',
        );
      }

      const data = turnos.map((item) => ({
        ...item,
        id: Number(item.id),
        idInstalacion: Number(item.idInstalacion),
        idDispositivo: item.idDispositivo != null ? Number(item.idDispositivo) : null,
        blueVoxs: this.parseBlueVoxs(item.blueVoxs),
        idVehiculo: item.idVehiculo != null ? Number(item.idVehiculo) : null,
        idCliente: Number(item.idCliente),
        idOperador: Number(item.idOperador),
      }));

      return { data: data[0] };
    } catch (error) {
      console.log(error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: `Ocurrió un problema al consultar el turno.`,
        error: error,
      });
    }
  }

  async updateEstatus(
    id: number,
    idUser: number,
    updateTurnosEstatusDto: UpdateTurnosEstatusDto,
  ): Promise<ApiCrudResponse> {
    try {
      const estatus = updateTurnosEstatusDto.estatus;

      // Al cerrar el turno (estatus = 0), verificar y cerrar todos los viajes abiertos del turno
      if (estatus === EstatusEnum.INACTIVO) {
        const viajesAbiertos = await this.viajesRepository.find({
          where: { idTurno: id, estatus: EstatusEnum.ACTIVO },
        });
        for (const viaje of viajesAbiertos) {
          try {
            await this.viajesService.update(
              idUser,
              viaje.idCliente,
              viaje.idOperador,
              viaje.id,
              {},
            );
          } catch (err) {
            console.error(`[updateEstatus Turno] Error al cerrar viaje ${viaje.id}:`, (err as Error)?.message ?? err);
            // Se registra pero se sigue cerrando el resto de viajes y el turno
          }
        }
      }

      await this.turnosRepository.update(id, { estatus });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { updateTurnosEstatusDto };
      await this.bitacoraLogger.logToBitacora(
        'Turnos',
        `El estatus del turno con ID: ${id} fue actualizado a: ${estatus}.`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.TURNOS,
        EstatusEnumBitcora.SUCCESS,
      );

      // ----- Api response -----
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'El estatus del turno se actualizó correctamente.',
        estatus: { estatus: estatus },
        data: {
          id: id,
          nombre: `id turno:${id} ` || '',
        },
      };
      return result;
    } catch (error) {
      console.log(error);
      //-----Registro en la bitacora----- ERROR
      const querylogger = { updateTurnosEstatusDto };
      await this.bitacoraLogger.logToBitacora(
        'Turnos',
        `El estatus del turno con ID: ${id} fue actualizado a: ${updateTurnosEstatusDto.estatus}.`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.TURNOS,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: `Hubo un problema al actualizar el estatus del turno.`,
        error,
      });
    }
  }

  /**
   * Cierra todos los turnos abiertos (estatus=ACTIVO).
   * Usado por el cron de cierre automático. Cierra primero los viajes abiertos de cada turno.
   * @param idUserSistema ID de usuario sistema para bitácora (ej. 0)
   */
  async cerrarTurnosAbiertosCron(idUserSistema: number): Promise<{ turnosCerrados: number; errores: string[] }> {
    const errores: string[] = [];
    let turnosCerrados = 0;
    const turnosAbiertos = await this.turnosRepository.find({
      where: { estatus: EstatusEnum.ACTIVO },
      select: ['id'],
    });
    const updateDto = { estatus: EstatusEnum.INACTIVO };
    for (const turno of turnosAbiertos) {
      try {
        await this.updateEstatus(turno.id, idUserSistema, updateDto);
        turnosCerrados++;
      } catch (err) {
        const msg = (err as Error)?.message ?? String(err);
        errores.push(`Turno ${turno.id}: ${msg}`);
      }
    }
    return { turnosCerrados, errores };
  }

  async update(id: number, idUser: number,
    cliente: number,
    idOperador: number,
    updateTurnoDto: UpdateTurnoDto) {
    try {
      //validamos que el usuario sea rol operador
      if (!idOperador) {
        throw new UnauthorizedException(`El usuario no está autorizado para actualizar un turno.`)
      }
      const { numeroSerieDispositivo } = updateTurnoDto;

      const query = `
      SELECT i.Id
      FROM Dispositivos d
      INNER JOIN Instalaciones i ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
      WHERE d.NumeroSerie = ? AND i.Estatus = 1
      `;

      const instalacion = await this.turnosRepository.query(query, [numeroSerieDispositivo]);
      if (instalacion.length === 0) {
        throw new NotFoundException('No se ha encontrado la instalación asignada al dispositivo.');
      }
      const idInstalacion = instalacion[0].Id;
      //Generamos el desfase de horarios
      function pad(n: number) {
        return n < 10 ? '0' + n : n;
      }
      const ahora = new Date();
      const desfaseMs = -6 * 60 * 60 * 1000; // -6 horas
      const fechaDesfasada = new Date(ahora.getTime() + desfaseMs);
      const fechaActual = `${fechaDesfasada.getFullYear()}-${pad(fechaDesfasada.getMonth() + 1)}-${pad(fechaDesfasada.getDate())} ${pad(fechaDesfasada.getHours())}:${pad(fechaDesfasada.getMinutes())}:${pad(fechaDesfasada.getSeconds())}`;
      // buscamos el turno
      const turnoFind = await this.turnosRepository.findOne({ where: { id: id } })

      if (!turnoFind) {
        throw new NotFoundException(`El turno con ID: ${id} no fue encontrado.`)
      }

      if (cliente != turnoFind.idCliente || idOperador != turnoFind.idOperador || idInstalacion != turnoFind.idInstalacion) {
        throw new BadRequestException(`El turno con ID: ${id} no coincide los valores del turno con el del usuario.`)
      }
      const body = {
        fin: fechaDesfasada,
        estatus: EstatusEnum.INACTIVO,
      }

      //actualizamos
      await this.turnosRepository.update(id, body);

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { updateTurnoDto };
      await this.bitacoraLogger.logToBitacora(
        'Turnos',
        `El turno con ID: ${id} fue actualizado correctamente.`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.TURNOS,
        EstatusEnumBitcora.SUCCESS,
      );

      // ----- Api response -----
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'El turno fue actualizado con éxito.',
        data: {
          id: id,
          nombre: `id turno:${id} ` || '',
        },
      };
      return result;
    } catch (error) {
      console.log(error);
      //-----Registro en la bitacora----- ERROR
      const querylogger = { updateTurnoDto };
      await this.bitacoraLogger.logToBitacora(
        'Turnos',
        `El turno con ID: ${id} fue actualizado correctamente.`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.TURNOS,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: `Hubo un problema al actualizar el turno.`,
        error: error.message,
      });
    }
  }

  async remove(id: number, idUser: number) {
    try {
      //actualizamos
      await this.turnosRepository.update(id, { estatus: 0 });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Turnos',
        `El turno con ID: ${id} fue eliminado correctamente.`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.TURNOS,
        EstatusEnumBitcora.SUCCESS,
      );

      // ----- Api response -----
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'El turno fue eliminado con éxito.',
        data: {
          id: id,
          nombre: `id turno:${id} ` || '',
        },
      };
      return result;
    } catch (error) {
      console.log(error);
      //-----Registro en la bitacora----- ERROR
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Turnos',
        `El turno con ID: ${id} fue eliminado correctamente.`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.TURNOS,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: `Hubo un problema al eliminar el turno.`,
        error: error.message,
      });
    }
  }
}
