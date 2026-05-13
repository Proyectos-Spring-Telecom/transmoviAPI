import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateConteoPasajerosDto } from './dto/create-conteopasajero.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { ConteoPasajeros } from 'src/entities/ConteoPasajeros';
import { Between, MoreThanOrEqual, Repository } from 'typeorm';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { BlueVoxs } from 'src/entities/BlueVoxs';
import { Usuarios } from 'src/entities/Usuarios';
import { EnumModulos, EstatusEnum, EnumTipoTransaccion } from 'src/common/estatus.enum';
import { Clientes } from 'src/entities/Clientes';
import { UpdateConteoPasajerosDto } from './dto/update-conteopasajero.dto';
import { Viajes } from 'src/entities/Viajes';

@Injectable()
export class ConteopasajerosService {
  constructor(
    @InjectRepository(ConteoPasajeros)
    private readonly conteopasajeroRepository: Repository<ConteoPasajeros>,
    @InjectRepository(BlueVoxs)
    private readonly bluevoxsRepository: Repository<BlueVoxs>,
    @InjectRepository(Usuarios)
    private readonly usuariosRepository: Repository<Usuarios>,
    @InjectRepository(Clientes)
    private readonly clienteRepository: Repository<Clientes>,
    @InjectRepository(Viajes)
    private readonly viajesRepository: Repository<Viajes>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  // ========================================
  // 🔹 CREAR DATOS DE CONTEOPASAJEROS
  // ========================================
  /**
   * Crea un nuevo registro de conteo de pasajeros.
   *
   * Reglas de negocio:
   * - El número de serie del BlueVox debe existir en la base de datos
   * - Si se proporciona idViaje, el viaje debe existir
   * - El estatus es opcional (puede ser null)
   *
   * @param idUser ID del usuario que realiza la operación (para bitácora)
   * @param cliente ID del cliente (obtenido del token, para validaciones si aplica)
   * @param rol Rol del usuario (obtenido del token, para validaciones si aplica)
   * @param createConteopasajeroDto DTO con los datos del conteo (entradas, salidas, diferencia, fechaHora, numeroSerieBlueVox, estatus opcional, idViaje opcional)
   * @returns Respuesta de la operación con el conteo creado
   * @throws NotFoundException Si el BlueVox o el Viaje (si se proporciona) no existen
   * @throws InternalServerErrorException Si ocurre un error al crear el conteo
   */
  async create(
    idUser: number,
    cliente: number,
    rol: number,
    createConteopasajeroDto: CreateConteoPasajerosDto,
  ): Promise<ApiCrudResponse> {
    try {
      // 🔹 VALIDACIÓN: Se verifica que el BlueVox exista mediante su número de serie
      // El BlueVox es obligatorio ya que el conteo debe estar asociado a un dispositivo
      const bluevox = await this.bluevoxsRepository.findOne({
        where: { numeroSerie: createConteopasajeroDto.numeroSerieBlueVox },
      });

      if (!bluevox) {
        throw new NotFoundException(
          'No se encontró el número de serie de Bluevox.',
        );
      }

      // 🔹 RESOLUCIÓN AUTOMÁTICA DE idViaje:
      // 1) Obtener instalación activa del BlueVox
      const instalacionResult = await this.conteopasajeroRepository.query(
        `
SELECT i.Id AS idInstalacion
FROM BlueVoxs bx
INNER JOIN InstalacionesBlueVoxs ibv ON ibv.IdBlueVox = bx.Id
INNER JOIN Instalaciones i ON i.Id = ibv.IdInstalacion
WHERE bx.NumeroSerie = ?
  AND ibv.Estatus = 1
  AND i.Estatus = 1
ORDER BY i.Id DESC
LIMIT 1
        `,
        [createConteopasajeroDto.numeroSerieBlueVox],
      );

      if (!instalacionResult.length) {
        throw new NotFoundException(
          `No se encontró instalación activa para el BlueVox: ${createConteopasajeroDto.numeroSerieBlueVox}.`,
        );
      }

      const idInstalacion = Number(instalacionResult[0].idInstalacion);

      // 2) Obtener turno activo del día actual para esa instalación
      const turnoResult = await this.conteopasajeroRepository.query(
        `
SELECT t.Id AS idTurno
FROM Turnos t
WHERE t.IdInstalacion = ?
  AND t.Estatus = 1
  AND DATE(t.Inicio) = CURDATE()
ORDER BY t.Inicio DESC, t.Id DESC
LIMIT 1
        `,
        [idInstalacion],
      );

      if (!turnoResult.length) {
        throw new NotFoundException(
          `No se encontró turno activo del día para la instalación: ${idInstalacion}.`,
        );
      }

      const idTurno = Number(turnoResult[0].idTurno);

      // 3) Obtener viaje activo del día actual para ese turno
      const viajeResult = await this.conteopasajeroRepository.query(
        `
SELECT v.Id AS idViaje
FROM Viajes v
WHERE v.IdTurno = ?
  AND v.Estatus = 1
  AND DATE(v.Inicio) = CURDATE()
ORDER BY v.Inicio DESC, v.Id DESC
LIMIT 1
        `,
        [idTurno],
      );

      if (!viajeResult.length) {
        throw new NotFoundException(
          `No se encontró viaje activo del día para el turno: ${idTurno}.`,
        );
      }

      // 4) Asignar idViaje resuelto al DTO antes de guardar
      createConteopasajeroDto.idViaje = Number(viajeResult[0].idViaje);

      // 🔹 CREACIÓN DEL REGISTRO: Se crea una instancia de ConteoPasajeros con los datos del DTO
      const newConteoPasajero = await this.conteopasajeroRepository.create(
        createConteopasajeroDto,
      );
      // 🔹 GUARDADO EN LA BASE DE DATOS: Se guarda el registro (genera el ID automático)
      const conteoPasajeroSave =
        await this.conteopasajeroRepository.save(newConteoPasajero);

      // 🔹 REGISTRO EN BITÁCORA: Se registra la operación exitosa
      // Se guarda el DTO completo para auditoría
      const querylogger = { createConteopasajeroDto };
      await this.bitacoraLogger.logToBitacora(
        'ConteoPasajeros',
        `Se creó un ConteoPasajeros con Numero de serie BlueVoxs: ${createConteopasajeroDto.numeroSerieBlueVox}`,
        'CREATE',
        querylogger,
        idUser,
        EnumModulos.CONTEOPASAJEROS,
        EstatusEnumBitcora.SUCCESS,
      );

      // 🔹 RESPUESTA DE LA API: Formato estándar de respuesta exitosa
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'El registro de ConteoPasajero se realizó con éxito.',
        data: {
          id: Number(conteoPasajeroSave.id),
          nombre:
            `${conteoPasajeroSave.id} ${conteoPasajeroSave.numeroSerieBlueVox}` ||
            '',
        },
      };
      return result;
    } catch (error) {
      console.log(error);
      const querylogger = { createConteopasajeroDto };
      await this.bitacoraLogger.logToBitacora(
        'ConteoPasajeros',
        `Se creó un ConteoPasajeros con Numero de serie BlueVoxs: ${createConteopasajeroDto.numeroSerieBlueVox}`,
        'CREATE',
        querylogger,
        idUser,
        EnumModulos.CONTEOPASAJEROS,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al crear ConteoPasajeros',
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

    const idsFiltrados = clientesFiltrado[0];
    const ids = idsFiltrados
      .map((clientesFiltrado: any) => Number(clientesFiltrado.Id))
      .filter(Boolean);
    if (ids.length === 0) {
      return { data: [] };
    }

    const placeholders = ids.map(() => '?').join(', ');
    return { ids, placeholders };
  }

  private async consultarConteoPasajerosPaginado(
    cliente: number,
    limit: number,
    offset: number,
    ordenarPorIdViaje = false,
  ) {
    const { ids, placeholders } = await this.clienteHijos(cliente);
    const orderSql = ordenarPorIdViaje
      ? 'ORDER BY IFNULL(cp.IdViaje, -1) DESC, cp.Id DESC'
      : 'ORDER BY cp.Id DESC';
    const query = `
SELECT
    cp.Id AS id,
    cp.Entradas AS entradas,
    cp.Salidas AS salidas,
    cp.Diferencia AS diferencia,
    cp.FechaHora AS fechaHora,
    cp.FHRegistro AS fhRegistro,
    cp.Estatus AS estatus,
    cp.NumeroSerieBlueVox AS numeroSerieBlueVox,
    cp.IdViaje AS idViaje,
    bv.Marca AS marcaBlueVox,
    bv.Modelo AS modeloBlueVox,
    v.Placa AS placaVehiculo,
    c.Id AS idCliente,
    CONCAT(
        c.Nombre,
        IFNULL(CONCAT(' ', c.ApellidoPaterno), ''),
        IFNULL(CONCAT(' ', c.ApellidoMaterno), '')
    ) AS NombreCompletoCliente
FROM ConteoPasajeros cp
INNER JOIN BlueVoxs bv
    ON cp.NumeroSerieBlueVox = bv.NumeroSerie
LEFT JOIN (
  SELECT ibv.IdInstalacion, ibv.IdBlueVox, i.IdVehiculo, i.IdCliente
  FROM InstalacionesBlueVoxs ibv
  INNER JOIN Instalaciones i ON ibv.IdInstalacion = i.Id
  WHERE ibv.Estatus = 1 AND i.Estatus = 1
  ORDER BY ibv.Id DESC
  LIMIT 1
) AS first_inst ON first_inst.IdBlueVox = bv.Id
LEFT JOIN Instalaciones i ON first_inst.IdInstalacion = i.Id
LEFT JOIN Vehiculos v 
    ON first_inst.IdVehiculo = v.Id AND first_inst.IdCliente = v.IdCliente
INNER JOIN Clientes c
    ON bv.IdCliente = c.Id
WHERE c.Id IN (${placeholders})
${orderSql}
LIMIT ? OFFSET ?;
  `;
    return this.conteopasajeroRepository.query(query, [...ids, limit, offset]);
  }

  private async consultarTotalConteoPasajerosPaginados(cliente: number) {
    const { ids, placeholders } = await this.clienteHijos(cliente);
    const query = `
SELECT COUNT(*) AS total
FROM ConteoPasajeros cp
INNER JOIN BlueVoxs bv
    ON cp.NumeroSerieBlueVox = bv.NumeroSerie
LEFT JOIN (
  SELECT ibv.IdInstalacion, ibv.IdBlueVox, i.IdVehiculo, i.IdCliente
  FROM InstalacionesBlueVoxs ibv
  INNER JOIN Instalaciones i ON ibv.IdInstalacion = i.Id
  WHERE ibv.Estatus = 1 AND i.Estatus = 1
  ORDER BY ibv.Id DESC
  LIMIT 1
) AS first_inst ON first_inst.IdBlueVox = bv.Id
LEFT JOIN Instalaciones i ON first_inst.IdInstalacion = i.Id
LEFT JOIN Vehiculos v 
    ON first_inst.IdVehiculo = v.Id AND first_inst.IdCliente = v.IdCliente
INNER JOIN Clientes c
    ON bv.IdCliente = c.Id
WHERE c.Id IN (${placeholders})
  `;
    return await this.conteopasajeroRepository.query(query, [...ids]);
  }

  private async consultarConteoPasajerosPaginadoCL(
    cliente: number,
    limit: number,
    offset: number,
    ordenarPorIdViaje = false,
  ) {
    const orderSql = ordenarPorIdViaje
      ? 'ORDER BY IFNULL(cp.IdViaje, -1) DESC, cp.Id DESC'
      : 'ORDER BY cp.Id DESC';
    const query = `
SELECT
    cp.Id AS id,
    cp.Entradas AS entradas,
    cp.Salidas AS salidas,
    cp.Diferencia AS diferencia,
    cp.FechaHora AS fechaHora,
    cp.FHRegistro AS fhRegistro,
    cp.Estatus AS estatus,
    cp.NumeroSerieBlueVox AS numeroSerieBlueVox,
    cp.IdViaje AS idViaje,
    bv.Marca AS marcaBlueVox,
    bv.Modelo AS modeloBlueVox,
    v.Placa AS placaVehiculo,
    c.Id AS idCliente,
    CONCAT(
        c.Nombre,
        IFNULL(CONCAT(' ', c.ApellidoPaterno), ''),
        IFNULL(CONCAT(' ', c.ApellidoMaterno), '')
    ) AS NombreCompletoCliente
FROM ConteoPasajeros cp
INNER JOIN BlueVoxs bv
    ON cp.NumeroSerieBlueVox = bv.NumeroSerie
LEFT JOIN (
  SELECT ibv.IdInstalacion, ibv.IdBlueVox, i.IdVehiculo, i.IdCliente
  FROM InstalacionesBlueVoxs ibv
  INNER JOIN Instalaciones i ON ibv.IdInstalacion = i.Id
  WHERE ibv.Estatus = 1 AND i.Estatus = 1
  ORDER BY ibv.Id DESC
  LIMIT 1
) AS first_inst ON first_inst.IdBlueVox = bv.Id
LEFT JOIN Instalaciones i ON first_inst.IdInstalacion = i.Id
LEFT JOIN Vehiculos v 
    ON first_inst.IdVehiculo = v.Id AND first_inst.IdCliente = v.IdCliente
INNER JOIN Clientes c
    ON bv.IdCliente = c.Id
WHERE c.Id = ?
${orderSql}
LIMIT ? OFFSET ?;
  `;
    return this.conteopasajeroRepository.query(query, [cliente, limit, offset]);
  }

  private async consultarTotalConteoPasajerosPaginadosCl(cliente: number) {
    const query = `
SELECT COUNT(*) AS total
FROM ConteoPasajeros cp
INNER JOIN BlueVoxs bv
    ON cp.NumeroSerieBlueVox = bv.NumeroSerie
LEFT JOIN (
  SELECT ibv.IdInstalacion, ibv.IdBlueVox, i.IdVehiculo, i.IdCliente
  FROM InstalacionesBlueVoxs ibv
  INNER JOIN Instalaciones i ON ibv.IdInstalacion = i.Id
  WHERE ibv.Estatus = 1 AND i.Estatus = 1
  ORDER BY ibv.Id DESC
  LIMIT 1
) AS first_inst ON first_inst.IdBlueVox = bv.Id
LEFT JOIN Instalaciones i ON first_inst.IdInstalacion = i.Id
LEFT JOIN Vehiculos v 
    ON first_inst.IdVehiculo = v.Id AND first_inst.IdCliente = v.IdCliente
INNER JOIN Clientes c
    ON bv.IdCliente = c.Id
WHERE c.Id = ?
  `;
    return await this.conteopasajeroRepository.query(query, [cliente]);
  }

  async findAll(
    idUser: number,
    cliente: number,
    rol: number,
    page: number,
    limit: number,
    ordenarPorIdViaje = false,
  ): Promise<ApiResponseCommon> {
    try {
      let conteoPasajeros;
      const offset = (page - 1) * limit;
      let totalResult;
      const orderSqlSuper = ordenarPorIdViaje
        ? 'ORDER BY IFNULL(cp.IdViaje, -1) DESC, cp.Id DESC'
        : 'ORDER BY cp.Id DESC';
      switch (rol) {
        case 1:
          conteoPasajeros = await this.conteopasajeroRepository.query(
            `
SELECT
    cp.Id AS id,
    cp.Entradas AS entradas,
    cp.Salidas AS salidas,
    cp.Diferencia AS diferencia,
    cp.FechaHora AS fechaHora,
    cp.FHRegistro AS fhRegistro,
    cp.Estatus AS estatus,
    cp.NumeroSerieBlueVox AS numeroSerieBlueVox,
    cp.IdViaje AS idViaje,
    bv.Marca AS marcaBlueVox,
    bv.Modelo AS modeloBlueVox,
    v.Placa AS placaVehiculo,
    c.Id AS idCliente,
    CONCAT(
        c.Nombre,
        IFNULL(CONCAT(' ', c.ApellidoPaterno), ''),
        IFNULL(CONCAT(' ', c.ApellidoMaterno), '')
    ) AS NombreCompletoCliente
FROM ConteoPasajeros cp
INNER JOIN BlueVoxs bv
    ON cp.NumeroSerieBlueVox = bv.NumeroSerie
LEFT JOIN (
  SELECT ibv.IdInstalacion, ibv.IdBlueVox, i.IdVehiculo, i.IdCliente
  FROM InstalacionesBlueVoxs ibv
  INNER JOIN Instalaciones i ON ibv.IdInstalacion = i.Id
  WHERE ibv.Estatus = 1 AND i.Estatus = 1
  ORDER BY ibv.Id DESC
  LIMIT 1
) AS first_inst ON first_inst.IdBlueVox = bv.Id
LEFT JOIN Instalaciones i ON first_inst.IdInstalacion = i.Id
LEFT JOIN Vehiculos v 
    ON first_inst.IdVehiculo = v.Id AND first_inst.IdCliente = v.IdCliente
INNER JOIN Clientes c
    ON bv.IdCliente = c.Id
${orderSqlSuper}
LIMIT ? OFFSET ?;
          `,
            [limit, offset],
          );

          totalResult = await this.conteopasajeroRepository.query(
            `
SELECT COUNT(*) AS total
FROM ConteoPasajeros cp
INNER JOIN BlueVoxs bv
    ON cp.NumeroSerieBlueVox = bv.NumeroSerie
LEFT JOIN (
  SELECT ibv.IdInstalacion, ibv.IdBlueVox, i.IdVehiculo, i.IdCliente
  FROM InstalacionesBlueVoxs ibv
  INNER JOIN Instalaciones i ON ibv.IdInstalacion = i.Id
  WHERE ibv.Estatus = 1 AND i.Estatus = 1
  ORDER BY ibv.Id DESC
  LIMIT 1
) AS first_inst ON first_inst.IdBlueVox = bv.Id
LEFT JOIN Instalaciones i ON first_inst.IdInstalacion = i.Id
LEFT JOIN Vehiculos v 
    ON first_inst.IdVehiculo = v.Id AND first_inst.IdCliente = v.IdCliente
INNER JOIN Clientes c
    ON bv.IdCliente = c.Id
          `,
          );
          break;

        case 2:
          conteoPasajeros = await this.consultarConteoPasajerosPaginado(
            cliente,
            limit,
            offset,
            ordenarPorIdViaje,
          );
          totalResult =
            await this.consultarTotalConteoPasajerosPaginados(cliente);
          break;

        case 3:
          conteoPasajeros = await this.consultarConteoPasajerosPaginadoCL(
            cliente,
            limit,
            offset,
            ordenarPorIdViaje,
          );
          totalResult =
            await this.consultarTotalConteoPasajerosPaginadosCl(cliente);
          break;

        case 8:
          conteoPasajeros = await this.consultarConteoPasajerosPaginado(
            cliente,
            limit,
            offset,
            ordenarPorIdViaje,
          );
          totalResult =
            await this.consultarTotalConteoPasajerosPaginados(cliente);
          break;

        case 10:
          conteoPasajeros = await this.consultarConteoPasajerosPaginado(
            cliente,
            limit,
            offset,
            ordenarPorIdViaje,
          );
          totalResult =
            await this.consultarTotalConteoPasajerosPaginados(cliente);
          break;

        default:
          conteoPasajeros = await this.consultarConteoPasajerosPaginadoCL(
            cliente,
            limit,
            offset,
            ordenarPorIdViaje,
          );
          totalResult =
            await this.consultarTotalConteoPasajerosPaginadosCl(cliente);
          break;
      }

      const total = Number(totalResult[0]?.total || 0);

      const data = conteoPasajeros.map((item) => ({
        ...item,
        id: Number(item.id),
        idCliente: Number(item.idCliente),
      }));

      const result: ApiResponseCommon = {
        data: data,
        paginated: {
          total,
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
        message: 'Error al obtener conteo pasajeros',
        error: error.message,
      });
    }
  }

  /**
   * Por viaje: compara ConteoPasajeros (ascensos) vs HistoricoTransaccionesDebito (boletos).
   *
   * Filtro de fechas: un viaje aparece si tiene actividad (conteo o débito) en el rango.
   * Conteos totales (totalAscensos, totalBoletos) y el detalle anidado se calculan sobre
   * TODO el histórico del viaje, sin recortar por fecha — alineado al query de referencia.
   *
   * Boletos: COUNT de HistoricoTransaccionesDebito por td.IdViajes con IdTipoTransaccion = DEBITO.
   *
   * Roles:
   *  - 1: sin filtro de cliente.
   *  - 2 / 8 / 10: jerarquía de cliente (lista de IDs).
   *  - 3 y default: cliente del token.
   */
  async findResumenAscensosVsBoletosPorViaje(
    _idUser: number,
    cliente: number,
    rol: number,
    fechaInicio: string,
    fechaFin: string,
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    try {
      const offset = (page - 1) * limit;
      const fechaInicioParam = `${fechaInicio}T00:00:00`;
      const fechaFinParam = `${fechaFin}T23:59:59`;
      const tipoDebito = EnumTipoTransaccion.DEBITO;

      const parseJson = (v: unknown): unknown => {
        if (v == null) return v;
        if (typeof v === 'string') {
          try {
            return JSON.parse(v) as unknown;
          } catch {
            return v;
          }
        }
        return v;
      };

      const groupBy =
        'v.Id, v.Inicio, v.Fin, v.IdCliente, veh.Id, veh.Placa, veh.Marca, veh.Modelo, veh.NumeroEconomico';

      // SELECT + FROM compartidos: la única diferencia entre roles es el WHERE
      // y los filtros internos de cliente en las subconsultas. Piezas por rol + esqueleto único.

      type RolPieces = {
        /** Subquery escalar de totalAscensos (debe terminar en cp.IdViaje = v.Id) */
        totalAscensosSub: string;
        /** Subquery escalar de totalBoletos */
        totalBoletosSub: string;
        /** Subquery para el array de conteos por BlueVox (cp.IdViaje = v.Id AND cp.NumeroSerieBlueVox = bv.NumeroSerie) */
        conteosSub: string;
        /** Filtro adicional en el JOIN de BlueVoxs externo (cliente) */
        bvJoinExtra: string;
        /** Cláusula WHERE de filtro de viajes (cliente + actividad en rango) */
        whereClause: string;
        /** Parámetros en el orden exacto en que aparecen los '?' del SQL completo (sqlData) */
        buildParamsData: () => unknown[];
        /** Parámetros en el orden exacto en que aparecen los '?' del sqlCount */
        buildParamsCount: () => unknown[];
      };

      let pieces: RolPieces;

      switch (rol) {
        case 1: {
          pieces = {
            totalAscensosSub: `
            SELECT COALESCE(SUM(cp.Entradas - cp.Salidas), 0)
            FROM ConteoPasajeros cp
            WHERE cp.IdViaje = v.Id`,
            totalBoletosSub: `
            SELECT COUNT(*)
            FROM HistoricoTransaccionesDebito td
            WHERE td.IdViajes = v.Id
              AND td.IdTipoTransaccion = ${tipoDebito}`,
            conteosSub: `
            SELECT JSON_ARRAYAGG(
              JSON_OBJECT(
                'idConteo', cp.Id,
                'entradas', cp.Entradas,
                'salidas', cp.Salidas,
                'diferencia', cp.Diferencia,
                'fechaHora', cp.FechaHora
              )
            )
            FROM ConteoPasajeros cp
            WHERE cp.IdViaje = v.Id
              AND cp.NumeroSerieBlueVox = bv.NumeroSerie`,
            bvJoinExtra: '',
            whereClause: `
            WHERE (
              EXISTS (
                SELECT 1 FROM ConteoPasajeros cp2
                WHERE cp2.IdViaje = v.Id
                  AND cp2.FechaHora BETWEEN ? AND ?
              )
              OR EXISTS (
                SELECT 1 FROM HistoricoTransaccionesDebito td2
                WHERE td2.IdViajes = v.Id
                  AND td2.FechaHoraFinal BETWEEN ? AND ?
                  AND td2.IdTipoTransaccion = ${tipoDebito}
              )
            )`,
            buildParamsData: () => [
              fechaInicioParam,
              fechaFinParam,
              fechaInicioParam,
              fechaFinParam,
              limit,
              offset,
            ],
            buildParamsCount: () => [
              fechaInicioParam,
              fechaFinParam,
              fechaInicioParam,
              fechaFinParam,
            ],
          };
          break;
        }

        case 2:
        case 8:
        case 10: {
          const jer = await this.clienteHijos(cliente);
          if (!('ids' in jer) || jer.ids.length === 0) {
            return {
              data: [],
              paginated: { total: 0, page, lastPage: 0 },
            };
          }
          const { ids, placeholders } = jer as {
            ids: number[];
            placeholders: string;
          };

          pieces = {
            totalAscensosSub: `
            SELECT COALESCE(SUM(cp.Entradas - cp.Salidas), 0)
            FROM ConteoPasajeros cp
            INNER JOIN BlueVoxs bvx ON bvx.NumeroSerie = cp.NumeroSerieBlueVox
              AND bvx.IdCliente IN (${placeholders})
            WHERE cp.IdViaje = v.Id`,
            totalBoletosSub: `
            SELECT COUNT(*)
            FROM HistoricoTransaccionesDebito td
            INNER JOIN Dispositivos d ON d.NumeroSerie = td.NumeroSerieDispositivo
              AND d.IdCliente IN (${placeholders})
            WHERE td.IdViajes = v.Id
              AND td.IdTipoTransaccion = ${tipoDebito}`,
            // bv externo ya está filtrado por cliente; conteos sin JOIN extra a BlueVoxs
            conteosSub: `
            SELECT JSON_ARRAYAGG(
              JSON_OBJECT(
                'idConteo', cp.Id,
                'entradas', cp.Entradas,
                'salidas', cp.Salidas,
                'diferencia', cp.Diferencia,
                'fechaHora', cp.FechaHora
              )
            )
            FROM ConteoPasajeros cp
            WHERE cp.IdViaje = v.Id
              AND cp.NumeroSerieBlueVox = bv.NumeroSerie`,
            bvJoinExtra: `AND bv.IdCliente IN (${placeholders})`,
            whereClause: `
            WHERE v.IdCliente IN (${placeholders})
              AND (
                EXISTS (
                  SELECT 1 FROM ConteoPasajeros cp2
                  INNER JOIN BlueVoxs bve ON bve.NumeroSerie = cp2.NumeroSerieBlueVox
                    AND bve.IdCliente IN (${placeholders})
                  WHERE cp2.IdViaje = v.Id
                    AND cp2.FechaHora BETWEEN ? AND ?
                )
                OR EXISTS (
                  SELECT 1 FROM HistoricoTransaccionesDebito td2
                  INNER JOIN Dispositivos de ON de.NumeroSerie = td2.NumeroSerieDispositivo
                    AND de.IdCliente IN (${placeholders})
                  WHERE td2.IdViajes = v.Id
                    AND td2.FechaHoraFinal BETWEEN ? AND ?
                    AND td2.IdTipoTransaccion = ${tipoDebito}
                )
              )`,
            // Orden de '?' en sqlData:
            //   1) totalAscensosSub:  ...ids
            //   2) totalBoletosSub:   ...ids
            //   3) bvJoinExtra:       ...ids
            //   4) where v.IdCliente: ...ids
            //   5) where EXISTS cp2:  ...ids, fechaIni, fechaFin
            //   6) where EXISTS td2:  ...ids, fechaIni, fechaFin
            //   7) LIMIT/OFFSET
            buildParamsData: () => [
              ...ids, // totalAscensosSub
              ...ids, // totalBoletosSub
              ...ids, // bvJoinExtra
              ...ids, // v.IdCliente IN
              ...ids, // EXISTS cp2
              fechaInicioParam,
              fechaFinParam,
              ...ids, // EXISTS td2
              fechaInicioParam,
              fechaFinParam,
              limit,
              offset,
            ],
            // Para el count NO usamos las subqueries escalares, solo el FROM + WHERE
            buildParamsCount: () => [
              ...ids, // bvJoinExtra
              ...ids, // v.IdCliente IN
              ...ids, // EXISTS cp2
              fechaInicioParam,
              fechaFinParam,
              ...ids, // EXISTS td2
              fechaInicioParam,
              fechaFinParam,
            ],
          };
          break;
        }

        case 3:
        default: {
          pieces = {
            totalAscensosSub: `
            SELECT COALESCE(SUM(cp.Entradas - cp.Salidas), 0)
            FROM ConteoPasajeros cp
            INNER JOIN BlueVoxs bvx ON bvx.NumeroSerie = cp.NumeroSerieBlueVox
              AND bvx.IdCliente = ?
            WHERE cp.IdViaje = v.Id`,
            totalBoletosSub: `
            SELECT COUNT(*)
            FROM HistoricoTransaccionesDebito td
            INNER JOIN Dispositivos d ON d.NumeroSerie = td.NumeroSerieDispositivo
              AND d.IdCliente = ?
            WHERE td.IdViajes = v.Id
              AND td.IdTipoTransaccion = ${tipoDebito}`,
            conteosSub: `
            SELECT JSON_ARRAYAGG(
              JSON_OBJECT(
                'idConteo', cp.Id,
                'entradas', cp.Entradas,
                'salidas', cp.Salidas,
                'diferencia', cp.Diferencia,
                'fechaHora', cp.FechaHora
              )
            )
            FROM ConteoPasajeros cp
            WHERE cp.IdViaje = v.Id
              AND cp.NumeroSerieBlueVox = bv.NumeroSerie`,
            bvJoinExtra: 'AND bv.IdCliente = ?',
            whereClause: `
            WHERE v.IdCliente = ?
              AND (
                EXISTS (
                  SELECT 1 FROM ConteoPasajeros cp2
                  INNER JOIN BlueVoxs bve ON bve.NumeroSerie = cp2.NumeroSerieBlueVox
                    AND bve.IdCliente = ?
                  WHERE cp2.IdViaje = v.Id
                    AND cp2.FechaHora BETWEEN ? AND ?
                )
                OR EXISTS (
                  SELECT 1 FROM HistoricoTransaccionesDebito td2
                  INNER JOIN Dispositivos de ON de.NumeroSerie = td2.NumeroSerieDispositivo
                    AND de.IdCliente = ?
                  WHERE td2.IdViajes = v.Id
                    AND td2.FechaHoraFinal BETWEEN ? AND ?
                    AND td2.IdTipoTransaccion = ${tipoDebito}
                )
              )`,
            buildParamsData: () => [
              cliente, // totalAscensosSub
              cliente, // totalBoletosSub
              cliente, // bvJoinExtra
              cliente, // v.IdCliente
              cliente, // EXISTS cp2
              fechaInicioParam,
              fechaFinParam,
              cliente, // EXISTS td2
              fechaInicioParam,
              fechaFinParam,
              limit,
              offset,
            ],
            buildParamsCount: () => [
              cliente, // bvJoinExtra
              cliente, // v.IdCliente
              cliente, // EXISTS cp2
              fechaInicioParam,
              fechaFinParam,
              cliente, // EXISTS td2
              fechaInicioParam,
              fechaFinParam,
            ],
          };
          break;
        }
      }

      const sqlData = `
SELECT
  v.Id AS idViaje,
  v.Inicio AS inicioViaje,
  v.Fin AS finViaje,
  v.IdCliente AS idCliente,
  (${pieces.totalAscensosSub}
  ) AS totalAscensos,
  (${pieces.totalBoletosSub}
  ) AS totalBoletos,
  JSON_OBJECT(
    'idVehiculo', veh.Id,
    'placa', veh.Placa,
    'marca', veh.Marca,
    'modelo', veh.Modelo,
    'numeroEconomico', veh.NumeroEconomico
  ) AS vehiculoJson,
  COALESCE(
    JSON_ARRAYAGG(
      JSON_OBJECT(
        'idBlueVox', bv.Id,
        'numeroSerie', bv.NumeroSerie,
        'conteos',
        COALESCE(
          (${pieces.conteosSub}
          ),
          JSON_ARRAY()
        )
      )
    ),
    JSON_ARRAY()
  ) AS blueVoxsJson
FROM Viajes v
INNER JOIN Turnos t ON t.Id = v.IdTurno
INNER JOIN Instalaciones i ON i.Id = t.IdInstalacion
INNER JOIN Vehiculos veh ON veh.Id = i.IdVehiculo AND veh.IdCliente = i.IdCliente
INNER JOIN InstalacionesBlueVoxs ibv ON ibv.IdInstalacion = i.Id AND ibv.Estatus = 1
INNER JOIN BlueVoxs bv ON bv.Id = ibv.IdBlueVox ${pieces.bvJoinExtra}
${pieces.whereClause}
GROUP BY ${groupBy}
ORDER BY v.Id DESC
LIMIT ? OFFSET ?`;

      const sqlCount = `
SELECT COUNT(*) AS total
FROM (
  SELECT v.Id
  FROM Viajes v
  INNER JOIN Turnos t ON t.Id = v.IdTurno
  INNER JOIN Instalaciones i ON i.Id = t.IdInstalacion
  INNER JOIN Vehiculos veh ON veh.Id = i.IdVehiculo AND veh.IdCliente = i.IdCliente
  INNER JOIN InstalacionesBlueVoxs ibv ON ibv.IdInstalacion = i.Id AND ibv.Estatus = 1
  INNER JOIN BlueVoxs bv ON bv.Id = ibv.IdBlueVox ${pieces.bvJoinExtra}
  ${pieces.whereClause}
  GROUP BY ${groupBy}
) cnt`;

      const rows: Record<string, unknown>[] =
        await this.conteopasajeroRepository.query(
          sqlData,
          pieces.buildParamsData(),
        );
      const totalResult: { total: string | number }[] =
        await this.conteopasajeroRepository.query(
          sqlCount,
          pieces.buildParamsCount(),
        );

      const total = Number(totalResult[0]?.total || 0);
      const data = rows.map((item) => {
        const asc = Number(item.totalAscensos) || 0;
        const bol = Number(item.totalBoletos) || 0;
        return {
          idViaje: Number(item.idViaje),
          inicioViaje: item.inicioViaje,
          finViaje: item.finViaje,
          idCliente: Number(item.idCliente),
          totalAscensos: asc,
          totalBoletos: bol,
          diferenciaAscensoBoleto: asc - bol,
          vehiculo: parseJson(item.vehiculoJson),
          blueVoxs: parseJson(item.blueVoxsJson),
        };
      });

      return {
        data,
        paginated: {
          total,
          page,
          lastPage: limit > 0 ? Math.ceil(total / limit) : 0,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtener resumen ascensos vs boletos por viaje',
        error: (error as Error).message,
      });
    }
  }

  private async consultarConteoPasajerosPaginadoRango(
    fechaInicio: string,
    fechaFin: string,
    cliente: number,
    limit: number,
    offset: number,
  ) {
    const { ids, placeholders } = await this.clienteHijos(cliente);
    const fechaInicioParam = `${fechaInicio}T00:00:00`;
    const fechaFinParam = `${fechaFin}T23:59:59`;
    const query = `
-- Parámetros:
-- :fechaInicio -> '2025-11-01'
-- :fechaFin -> '2025-11-14'
-- :limit -> cantidad de registros por página
-- :offset -> (page - 1) * limit

SELECT
    cp.Id AS id,
    cp.Entradas AS entradas,
    cp.Salidas AS salidas,
    cp.Diferencia AS diferencia,
    cp.FechaHora AS fechaHora,
    cp.FHRegistro AS fhRegistro,
    cp.Estatus AS estatus,
    cp.NumeroSerieBlueVox AS numeroSerieBlueVox,
    cp.IdViaje AS idViaje,
    bv.Marca AS marcaBlueVox,
    bv.Modelo AS modeloBlueVox,
    c.Id AS idCliente,
    CONCAT(
        c.Nombre,
        IFNULL(CONCAT(' ', c.ApellidoPaterno), ''),
        IFNULL(CONCAT(' ', c.ApellidoMaterno), '')
    ) AS NombreCompletoCliente
FROM ConteoPasajeros cp
INNER JOIN BlueVoxs bv
    ON cp.NumeroSerieBlueVox = bv.NumeroSerie
INNER JOIN Clientes c
    ON bv.IdCliente = c.Id
WHERE cp.FechaHora BETWEEN ? AND ?
AND c.Id IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar

ORDER BY cp.FechaHora DESC
LIMIT ? OFFSET ?;
    `;
    return this.conteopasajeroRepository.query(query, [
      fechaInicioParam,
      fechaFinParam,
      ...ids,
      limit,
      offset,
    ]);
  }

  private async consultarTotalConteoPasajerosPaginadosRango(
    fechaInicio: string,
    fechaFin: string,
    cliente: number,
  ) {
    const { ids, placeholders } = await this.clienteHijos(cliente);
    const fechaInicioParam = `${fechaInicio}T00:00:00`;
    const fechaFinParam = `${fechaFin}T23:59:59`;
    const query = `  
    SELECT COUNT(*) AS total
FROM ConteoPasajeros cp
INNER JOIN BlueVoxs bv
    ON cp.NumeroSerieBlueVox = bv.NumeroSerie
INNER JOIN Clientes c
    ON bv.IdCliente = c.Id
WHERE cp.FechaHora BETWEEN ? AND ?
AND c.Id IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar
`;
    return await this.conteopasajeroRepository.query(query, [
      fechaInicioParam,
      fechaFinParam,
      ...ids,
    ]);
  }

  private async consultarConteoPasajerosPaginadoRangoCL(
    fechaInicio: string,
    fechaFin: string,
    cliente: number,
    limit: number,
    offset: number,
  ) {
    const fechaInicioParam = `${fechaInicio}T00:00:00`;
    const fechaFinParam = `${fechaFin}T23:59:59`;
    const query = `
-- Parámetros:
-- :fechaInicio -> '2025-11-01'
-- :fechaFin -> '2025-11-14'
-- :limit -> cantidad de registros por página
-- :offset -> (page - 1) * limit

SELECT
    cp.Id AS id,
    cp.Entradas AS entradas,
    cp.Salidas AS salidas,
    cp.Diferencia AS diferencia,
    cp.FechaHora AS fechaHora,
    cp.FHRegistro AS fhRegistro,
    cp.Estatus AS estatus,
    cp.NumeroSerieBlueVox AS numeroSerieBlueVox,
    cp.IdViaje AS idViaje,
    bv.Marca AS marcaBlueVox,
    bv.Modelo AS modeloBlueVox,
    c.Id AS idCliente,
    CONCAT(
        c.Nombre,
        IFNULL(CONCAT(' ', c.ApellidoPaterno), ''),
        IFNULL(CONCAT(' ', c.ApellidoMaterno), '')
    ) AS NombreCompletoCliente
FROM ConteoPasajeros cp
INNER JOIN BlueVoxs bv
    ON cp.NumeroSerieBlueVox = bv.NumeroSerie
INNER JOIN Clientes c
    ON bv.IdCliente = c.Id
WHERE cp.FechaHora BETWEEN ? AND ?
AND c.Id = ?   -- 🔹 aquí colocas el ID del cliente que quieres consultar

ORDER BY cp.FechaHora DESC
LIMIT ? OFFSET ?;
    `;
    return this.conteopasajeroRepository.query(query, [
      fechaInicioParam,
      fechaFinParam,
      cliente,
      limit,
      offset,
    ]);
  }

  private async consultarTotalConteoPasajerosPaginadosRangoCl(
    fechaInicio: string,
    fechaFin: string,
    cliente: number,
  ) {
    const fechaInicioParam = `${fechaInicio}T00:00:00`;
    const fechaFinParam = `${fechaFin}T23:59:59`;
    const query = `  
    SELECT COUNT(*) AS total
FROM ConteoPasajeros cp
INNER JOIN BlueVoxs bv
    ON cp.NumeroSerieBlueVox = bv.NumeroSerie
INNER JOIN Clientes c
    ON bv.IdCliente = c.Id
WHERE cp.FechaHora BETWEEN ? AND ?
AND c.Id = ?   -- 🔹 aquí colocas el ID del cliente que quieres consultar
`;
    return await this.conteopasajeroRepository.query(query, [
      fechaInicioParam,
      fechaFinParam,
      cliente,
    ]);
  }

  async findAllList(): Promise<ApiResponseCommon> {
    try {
      const conteopasajero = await this.conteopasajeroRepository.find({
        order: { fechaHora: 'DESC' },
      });
      if (conteopasajero.length === 0) {
        throw new NotFoundException('ConteoPasajeros no encontrado');
      }

      const data = conteopasajero.map((item) => ({
        ...item,
        id: Number(item.id),
      }));

      return { data: data };
    } catch (error) {
      console.log(error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtener conteo pasajeros',
        error: error.message,
      });
    }
  }

  // ========================================
  // 🔹 OBTENER UN DATO CONTEOPASAJEROS
  // ========================================
  async findOne(id: number) {
    try {
      const conteopasajero = await this.conteopasajeroRepository.findOne({
        where: { id: id },
      });
      if (!conteopasajero) {
        throw new NotFoundException('ConteoPasajeros no encontrado');
      }

      conteopasajero.id = Number(conteopasajero.id);
      return { data: conteopasajero };
    } catch (error) {
      console.log(error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtener conteo pasajeros',
        error: error.message,
      });
    }
  }

  // ========================================
  // 🔹 OBTENER DATOS DE UN RANGO DE FECHAS
  // ========================================
  async findByDateRangePaginated(
    idUser: number,
    cliente: number,
    rol: number,
    fechaInicio: string,
    fechaFin: string,
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    try {
      let conteoPasajeros;
      const offset = (page - 1) * limit;
      let totalResult;
      const startDate = new Date(`${fechaInicio} 00:00:00`);
      const endDate = new Date(`${fechaFin} 23:59:59`);
      switch (rol) {
        case 1:
          const fechaInicioParam = `${fechaInicio}T00:00:00`;
          const fechaFinParam = `${fechaFin}T23:59:59`;
          conteoPasajeros = await this.conteopasajeroRepository.query(
            `
-- Parámetros:
-- :fechaInicio -> '2025-11-01'
-- :fechaFin -> '2025-11-14'
-- :limit -> cantidad de registros por página
-- :offset -> (page - 1) * limit

SELECT
    cp.Id AS id,
    cp.Entradas AS entradas,
    cp.Salidas AS salidas,
    cp.Diferencia AS diferencia,
    cp.FechaHora AS fechaHora,
    cp.FHRegistro AS fhRegistro,
    cp.Estatus AS estatus,
    cp.NumeroSerieBlueVox AS numeroSerieBlueVox,
    cp.IdViaje AS idViaje,
    bv.Marca AS marcaBlueVox,
    bv.Modelo AS modeloBlueVox,
    c.Id AS idCliente,
    CONCAT(
        c.Nombre,
        IFNULL(CONCAT(' ', c.ApellidoPaterno), ''),
        IFNULL(CONCAT(' ', c.ApellidoMaterno), '')
    ) AS NombreCompletoCliente
FROM ConteoPasajeros cp
INNER JOIN BlueVoxs bv
    ON cp.NumeroSerieBlueVox = bv.NumeroSerie
INNER JOIN Clientes c
    ON bv.IdCliente = c.Id
WHERE cp.FechaHora BETWEEN ? AND ?

ORDER BY cp.FechaHora DESC
LIMIT ? OFFSET ?;
        `,
            [fechaInicioParam, fechaFinParam, limit, offset],
          );

          // Query para total (sin paginación)
          totalResult = await this.conteopasajeroRepository.query(
            `
  SELECT COUNT(*) AS total
FROM ConteoPasajeros cp
INNER JOIN BlueVoxs bv
    ON cp.NumeroSerieBlueVox = bv.NumeroSerie
INNER JOIN Clientes c
    ON bv.IdCliente = c.Id
WHERE cp.FechaHora BETWEEN ? AND ?

  `,
            [fechaInicioParam, fechaFinParam],
          );
          break;

        case 2:
          // Consulta de datos paginados Usuario Administrador
          conteoPasajeros = await this.consultarConteoPasajerosPaginadoRango(
            fechaInicio,
            fechaFin,
            cliente,
            limit,
            offset,
          );

          // Query para total (sin paginación)
          totalResult = await this.consultarTotalConteoPasajerosPaginadosRango(
            fechaInicio,
            fechaFin,
            cliente,
          );
          break;

        case 3:
          // Consulta de datos paginados Usuario Operador
          conteoPasajeros = await this.consultarConteoPasajerosPaginadoRangoCL(
            fechaInicio,
            fechaFin,
            cliente,
            limit,
            offset,
          );

          // Query para total (sin paginación)
          totalResult =
            await this.consultarTotalConteoPasajerosPaginadosRangoCl(
              fechaInicio,
              fechaFin,
              cliente,
            );
          break;

        case 8:
          // Consulta de datos paginados Usuario Reportes
          conteoPasajeros = await this.consultarConteoPasajerosPaginadoRango(
            fechaInicio,
            fechaFin,
            cliente,
            limit,
            offset,
          );

          // Query para total (sin paginación)
          totalResult = await this.consultarTotalConteoPasajerosPaginadosRango(
            fechaInicio,
            fechaFin,
            cliente,
          );
          break;

        case 10:
          // Consulta de datos paginados Usuario Capturista
          conteoPasajeros = await this.consultarConteoPasajerosPaginadoRango(
            fechaInicio,
            fechaFin,
            cliente,
            limit,
            offset,
          );

          // Query para total (sin paginación)
          totalResult = await this.consultarTotalConteoPasajerosPaginadosRango(
            fechaInicio,
            fechaFin,
            cliente,
          );
          break;

        default:
          // Consulta de datos paginados Usuario Operador
          conteoPasajeros = await this.consultarConteoPasajerosPaginadoRangoCL(
            fechaInicio,
            fechaFin,
            cliente,
            limit,
            offset,
          );

          // Query para total (sin paginación)
          totalResult =
            await this.consultarTotalConteoPasajerosPaginadosRangoCl(
              fechaInicio,
              fechaFin,
              cliente,
            );
          break;
      }

      const total = Number(totalResult[0]?.total || 0);

      const data = conteoPasajeros.map((item) => ({
        ...item,
        id: Number(item.id),
        idCliente: Number(item.idCliente),
      }));

      const result: ApiResponseCommon = {
        data: data,
        paginated: {
          total,
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
        message: 'Error al obtener conteo pasajeros',
        error: error.message,
      });
    }
  }

  // ========================================
  // 🔹 ACTUALIZAR CONTEOPASAJERO
  // ========================================
  /**
   * Actualiza un registro de conteo de pasajeros existente.
   *
   * Reglas de negocio:
   * - El registro de conteo debe existir
   * - NO se puede actualizar si el registro de conteo tiene estatus = 0 (inactivo)
   * - Si el conteo tiene un viaje asociado (idViaje), NO se puede actualizar si el viaje tiene estatus INACTIVO
   * - Si se proporciona idViaje en el DTO, el viaje debe existir y no estar INACTIVO
   * - Todos los campos del DTO son opcionales (solo se actualizan los proporcionados)
   *
   * @param id ID del registro de conteo a actualizar
   * @param idUser ID del usuario que realiza la operación (para bitácora)
   * @param cliente ID del cliente (obtenido del token, para validaciones si aplica)
   * @param rol Rol del usuario (obtenido del token, para validaciones si aplica)
   * @param updateConteoPasajerosDto DTO con los campos a actualizar (todos opcionales)
   * @returns Respuesta de la operación con el conteo actualizado
   * @throws NotFoundException Si el registro de conteo o el viaje (si se proporciona) no existen
   * @throws BadRequestException Si el conteo tiene estatus 0 o si el viaje asociado está INACTIVO
   * @throws InternalServerErrorException Si ocurre un error al actualizar el conteo
   */
  async update(
    id: number,
    idUser: number,
    cliente: number,
    rol: number,
    updateConteoPasajerosDto: UpdateConteoPasajerosDto,
  ) {
    try {
      // 🔹 BÚSQUEDA DEL REGISTRO: Se valida que el registro de conteo exista
      const conteoPasajero = await this.conteopasajeroRepository.findOne({
        where: { id: id },
      });
      if (!conteoPasajero)
        throw new NotFoundException('Conteo Pasajero no encontrada.');

      // 🔹 VALIDACIÓN: No se puede actualizar si el conteo tiene estatus = 0 (inactivo)
      // Esto previene la modificación de registros que ya han sido finalizados
      if (conteoPasajero.estatus === 0) {
        throw new BadRequestException(
          `No se puede actualizar el conteo de pasajeros con ID: ${id} porque tiene estatus inactivo (0).`,
        );
      }

      // 🔹 VALIDACIÓN: Si el conteo tiene un viaje asociado, verificar que el viaje no esté INACTIVO
      // Si el viaje está finalizado (INACTIVO), no se deben modificar los conteos asociados
      if (
        conteoPasajero.idViaje !== null &&
        conteoPasajero.idViaje !== undefined
      ) {
        const viajeAsociado = await this.viajesRepository.findOne({
          where: { id: conteoPasajero.idViaje },
        });

        if (!viajeAsociado) {
          throw new NotFoundException(
            `No se encontró el viaje asociado con ID: ${conteoPasajero.idViaje}.`,
          );
        }

        // Verificar si el viaje está INACTIVO (estatus = 0 o EstatusEnum.INACTIVO)
        if (
          viajeAsociado.estatus === EstatusEnum.INACTIVO ||
          viajeAsociado.estatus === 0
        ) {
          throw new BadRequestException(
            `No se puede actualizar el conteo de pasajeros con ID: ${id} porque el viaje asociado (ID: ${conteoPasajero.idViaje}) está inactivo.`,
          );
        }
      }

      // 🔹 RESOLUCIÓN AUTOMÁTICA DE idViaje (misma lógica que create):
      // BlueVox del registro -> Instalación -> Turno activo de hoy -> Viaje activo de hoy
      const instalacionResult = await this.conteopasajeroRepository.query(
        `
SELECT i.Id AS idInstalacion
FROM BlueVoxs bx
INNER JOIN InstalacionesBlueVoxs ibv ON ibv.IdBlueVox = bx.Id
INNER JOIN Instalaciones i ON i.Id = ibv.IdInstalacion
WHERE bx.NumeroSerie = ?
  AND ibv.Estatus = 1
  AND i.Estatus = 1
ORDER BY i.Id DESC
LIMIT 1
        `,
        [conteoPasajero.numeroSerieBlueVox],
      );

      if (!instalacionResult.length) {
        throw new NotFoundException(
          `No se encontró instalación activa para el BlueVox: ${conteoPasajero.numeroSerieBlueVox}.`,
        );
      }

      const idInstalacion = Number(instalacionResult[0].idInstalacion);

      const turnoResult = await this.conteopasajeroRepository.query(
        `
SELECT t.Id AS idTurno
FROM Turnos t
WHERE t.IdInstalacion = ?
  AND t.Estatus = 1
  AND DATE(t.Inicio) = CURDATE()
ORDER BY t.Inicio DESC, t.Id DESC
LIMIT 1
        `,
        [idInstalacion],
      );

      if (!turnoResult.length) {
        throw new NotFoundException(
          `No se encontró turno activo del día para la instalación: ${idInstalacion}.`,
        );
      }

      const idTurno = Number(turnoResult[0].idTurno);

      const viajeResult = await this.conteopasajeroRepository.query(
        `
SELECT v.Id AS idViaje
FROM Viajes v
WHERE v.IdTurno = ?
  AND v.Estatus = 1
  AND DATE(v.Inicio) = CURDATE()
ORDER BY v.Inicio DESC, v.Id DESC
LIMIT 1
        `,
        [idTurno],
      );

      if (!viajeResult.length) {
        throw new NotFoundException(
          `No se encontró viaje activo del día para el turno: ${idTurno}.`,
        );
      }

      updateConteoPasajerosDto.idViaje = Number(viajeResult[0].idViaje);

      // 🔹 VALIDACIÓN: Si se proporciona idViaje en el DTO, se verifica que el viaje exista y no esté INACTIVO
      // Esto previene la asociación a viajes finalizados o inexistentes
      if (
        updateConteoPasajerosDto.idViaje !== undefined &&
        updateConteoPasajerosDto.idViaje !== null
      ) {
        const viaje = await this.viajesRepository.findOne({
          where: { id: updateConteoPasajerosDto.idViaje },
        });

        if (!viaje) {
          throw new NotFoundException(
            `No se encontró el viaje con ID: ${updateConteoPasajerosDto.idViaje}.`,
          );
        }

        // Verificar si el viaje nuevo está INACTIVO
        if (viaje.estatus === EstatusEnum.INACTIVO || viaje.estatus === 0) {
          throw new BadRequestException(
            `No se puede actualizar el conteo de pasajeros para asociarlo al viaje con ID: ${updateConteoPasajerosDto.idViaje} porque el viaje está inactivo.`,
          );
        }
      }

      // 🔹 ACTUALIZACIÓN EN LA BASE DE DATOS: Solo se actualizan los campos enviados
      // Los campos que no se envían en el DTO permanecen sin cambios
      await this.conteopasajeroRepository.update(id, updateConteoPasajerosDto);

      const querylogger = { updateConteoPasajerosDto };
      await this.bitacoraLogger.logToBitacora(
        'ConteoPasajeros',
        `Se actualizo un ConteoPasajeros con ID ${id}, Numero de serie BlueVoxs: ${conteoPasajero.numeroSerieBlueVox}`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.CONTEOPASAJEROS,
        EstatusEnumBitcora.SUCCESS,
      );

      // API response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'ConteoPasajero fue actualizada correctamente',
        data: {
          id: id,
          nombre: `ConteoPasajero ${id} `,
        },
      };
      return result;
    } catch (error) {
      console.log(error);
      const querylogger = { updateConteoPasajerosDto };
      await this.bitacoraLogger.logToBitacora(
        'ConteoPasajeros',
        `Se actualizo un ConteoPasajeros con ID ${id}.`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.CONTEOPASAJEROS,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al actualizar conteopasajero',
        error: error.message,
      });
    }
  }
}
