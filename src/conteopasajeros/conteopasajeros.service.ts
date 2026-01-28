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
import { ApiCrudResponse, ApiResponseCommon, EstatusEnumBitcora } from 'src/common/ApiResponse';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { BlueVoxs } from 'src/entities/BlueVoxs';
import { Usuarios } from 'src/entities/Usuarios';
import { EnumModulos, EstatusEnum } from 'src/common/estatus.enum';
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
  ) { }

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
        where: { numeroSerie: createConteopasajeroDto.numeroSerieBlueVox }
      });

      if (!bluevox) {
        throw new NotFoundException('No se encontró el número de serie de Bluevox.')
      }

      // 🔹 VALIDACIÓN: Si se proporciona idViaje, se verifica que el viaje exista
      // El idViaje es opcional, pero si se proporciona debe ser válido
      if (createConteopasajeroDto.idViaje !== undefined && createConteopasajeroDto.idViaje !== null) {
        const viaje = await this.viajesRepository.findOne({
          where: { id: createConteopasajeroDto.idViaje }
        });

        if (!viaje) {
          throw new NotFoundException(`No se encontró el viaje con ID: ${createConteopasajeroDto.idViaje}.`)
        }
      }

      // 🔹 CREACIÓN DEL REGISTRO: Se crea una instancia de ConteoPasajeros con los datos del DTO
      const newConteoPasajero = await this.conteopasajeroRepository.create(
        createConteopasajeroDto,
      );
      // 🔹 GUARDADO EN LA BASE DE DATOS: Se guarda el registro (genera el ID automático)
      const conteoPasajeroSave = await this.conteopasajeroRepository.save(newConteoPasajero);

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
          nombre: `${conteoPasajeroSave.id} ${conteoPasajeroSave.numeroSerieBlueVox}` || '',
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
  ) {
    const { ids, placeholders } = await this.clienteHijos(cliente);
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
ORDER BY cp.Id DESC
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
  ) {
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
ORDER BY cp.Id DESC
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
    limit: number
  ): Promise<ApiResponseCommon> {
    try {
      let conteoPasajeros;
      const offset = (page - 1) * limit;
      let totalResult;
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
ORDER BY cp.Id DESC
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
          conteoPasajeros = await this.consultarConteoPasajerosPaginado(cliente, limit, offset);
          totalResult = await this.consultarTotalConteoPasajerosPaginados(cliente);
          break;

        case 3:
          conteoPasajeros = await this.consultarConteoPasajerosPaginadoCL(cliente, limit, offset);
          totalResult = await this.consultarTotalConteoPasajerosPaginadosCl(cliente);
          break;

        case 8:
          conteoPasajeros = await this.consultarConteoPasajerosPaginado(cliente, limit, offset);
          totalResult = await this.consultarTotalConteoPasajerosPaginados(cliente);
          break;

        case 10:
          conteoPasajeros = await this.consultarConteoPasajerosPaginado(cliente, limit, offset);
          totalResult = await this.consultarTotalConteoPasajerosPaginados(cliente);
          break;

        default:
          conteoPasajeros = await this.consultarConteoPasajerosPaginadoCL(cliente, limit, offset);
          totalResult = await this.consultarTotalConteoPasajerosPaginadosCl(cliente);
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
    return await this.conteopasajeroRepository.query(query, [fechaInicioParam, fechaFinParam, ...ids]);
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
    cliente: number) {
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
    return await this.conteopasajeroRepository.query(query, [fechaInicioParam, fechaFinParam, cliente]);
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

  // MÉTODOS CON PAGINACIÓN
  async findByDatePaginated(fecha: string, page: number, limit: number): Promise<ApiResponseCommon> {
    try {
      const startDate = new Date(`${fecha}T00:00:00`);
      const endDate = new Date(`${fecha}T23:59:59`);

      const [data, total] = await this.conteopasajeroRepository.findAndCount({
        where: { fechaHora: Between(startDate, endDate) },
        skip: (page - 1) * limit,
        take: limit,
        order: { fechaHora: 'DESC' },
      });

      const conteoPasajeros = data.map((item) => ({
        ...item,
        id: Number(item.id),
      }));

      return {
        data: conteoPasajeros,
        paginated: {
          total: total,
          page,
          lastPage: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException({
        message: 'Error al obtener conteo pasajeros por fecha',
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
          conteoPasajeros = await this.consultarConteoPasajerosPaginadoRango(fechaInicio, fechaFin, cliente, limit, offset);

          // Query para total (sin paginación)
          totalResult = await this.consultarTotalConteoPasajerosPaginadosRango(fechaInicio, fechaFin, cliente);
          break;

        case 3:
          // Consulta de datos paginados Usuario Operador
          conteoPasajeros = await this.consultarConteoPasajerosPaginadoRangoCL(fechaInicio, fechaFin, cliente, limit, offset);

          // Query para total (sin paginación)
          totalResult = await this.consultarTotalConteoPasajerosPaginadosRangoCl(fechaInicio, fechaFin, cliente);
          break;

        case 8:
          // Consulta de datos paginados Usuario Reportes
          conteoPasajeros = await this.consultarConteoPasajerosPaginadoRango(fechaInicio, fechaFin, cliente, limit, offset);

          // Query para total (sin paginación)
          totalResult = await this.consultarTotalConteoPasajerosPaginadosRango(fechaInicio, fechaFin, cliente);
          break;

        case 10:
          // Consulta de datos paginados Usuario Capturista
          conteoPasajeros = await this.consultarConteoPasajerosPaginadoRango(fechaInicio, fechaFin, cliente, limit, offset);

          // Query para total (sin paginación)
          totalResult = await this.consultarTotalConteoPasajerosPaginadosRango(fechaInicio, fechaFin, cliente);
          break;

        default:
          // Consulta de datos paginados Usuario Operador
          conteoPasajeros = await this.consultarConteoPasajerosPaginadoRangoCL(fechaInicio, fechaFin, cliente, limit, offset);

          // Query para total (sin paginación)
          totalResult = await this.consultarTotalConteoPasajerosPaginadosRangoCl(fechaInicio, fechaFin, cliente);
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


  // ⏰ 3. OBTENER DATOS DE UNA HORA ESPECÍFICA
  async findByDateTimePaginated(
    fecha: string,
    hora: string,
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    try {
      const dateTime = new Date(`${fecha}T${hora}:00`);
      const endDateTime = new Date(`${fecha}T${hora}:59`);

      const [data, total] = await this.conteopasajeroRepository.findAndCount({
        where: { fechaHora: Between(dateTime, endDateTime) },
        skip: (page - 1) * limit,
        take: limit,
        order: { fechaHora: 'DESC' },
      });

      const conteoPasajeros = data.map((item) => ({
        ...item,
        id: Number(item.id),
      }));

      return {
        data: conteoPasajeros,
        paginated: {
          total: total,
          page,
          lastPage: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException({
        message: 'Error al obtener conteo pasajeros por fecha y hora',
        error: error.message,
      });
    }
  }

  // 📊 4. OBTENER DATOS DE HOY
  async findTodayPaginated(page: number, limit: number): Promise<ApiResponseCommon> {
    try {
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));

      const [data, total] = await this.conteopasajeroRepository.findAndCount({
        where: { fechaHora: Between(startOfDay, endOfDay) },
        skip: (page - 1) * limit,
        take: limit,
        order: { fechaHora: 'DESC' },
      });

      const conteoPasajeros = data.map((item) => ({
        ...item,
        id: Number(item.id),
      }));

      return {
        data: conteoPasajeros,
        paginated: {
          total: total,
          page,
          lastPage: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException({
        message: 'Error al obtener conteo pasajeros de hoy',
        error: error.message,
      });
    }
  }

  // 📅 5. OBTENER DATOS DE LA ÚLTIMA SEMANA
  async findLastWeekPaginated(page: number, limit: number): Promise<ApiResponseCommon> {
    try {
      const today = new Date();
      const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [data, total] = await this.conteopasajeroRepository.findAndCount({
        where: {
          fechaHora: MoreThanOrEqual(lastWeek)
        },
        skip: (page - 1) * limit,
        take: limit,
        order: { fechaHora: 'DESC' }
      });

      const conteoPasajeros = data.map((item) => ({
        ...item,
        id: Number(item.id),
      }));

      return {
        data: conteoPasajeros,
        paginated: {
          total: total,
          page,
          lastPage: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException({
        message: 'Error al obtener conteo pasajeros de la última semana',
        error: error.message,
      });
    }
  }

  // 🔍 6. BUSCAR CON FILTROS ESPECÍFICOS + FECHA
  async findByBlueVoxAndDatePaginated(
    numeroSerie: string,
    fechaInicio: string,
    fechaFin: string,
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    try {
      const startDate = new Date(`${fechaInicio}T00:00:00`);
      const endDate = new Date(`${fechaFin}T23:59:59`);

      const [data, total] = await this.conteopasajeroRepository.findAndCount({
        where: {
          numeroSerieBlueVox: numeroSerie,
          fechaHora: Between(startDate, endDate),
        },
        relations: ['numeroSerieBlueVox2'],
        skip: (page - 1) * limit,
        take: limit,
        order: { fechaHora: 'DESC' },
      });

      const conteoPasajeros = data.map((item) => ({
        ...item,
        id: Number(item.id),
      }));

      return {
        data: conteoPasajeros,
        paginated: {
          total: total,
          page,
          lastPage: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException({
        message: 'Error al obtener conteo pasajeros por BlueVox y fecha',
        error: error.message,
      });
    }
  }

  // 📈 7. OBTENER RESUMEN POR HORAS DE UN DÍA
  async getHourlySummary(fecha: string): Promise<any[]> {
    const startDate = `${fecha} 00:00:00`;
    const endDate = `${fecha} 23:59:59`;

    return await this.conteopasajeroRepository
      .createQueryBuilder('cp')
      .select([
        'HOUR(cp.fechaHora) as hora',
        'SUM(cp.entradas) as totalEntradas',
        'SUM(cp.salidas) as totalSalidas',
        'SUM(cp.diferencia) as totalDiferencia',
        'COUNT(*) as registros',
      ])
      .where('cp.fechaHora BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy('HOUR(cp.fechaHora)')
      .orderBy('hora', 'ASC')
      .getRawMany();
  }

  // 📊 8. OBTENER RESUMEN DIARIO DE UN MES
  async getDailySummary(year: number, month: number): Promise<any[]> {
    return await this.conteopasajeroRepository
      .createQueryBuilder('cp')
      .select([
        'DATE(cp.fechaHora) as fecha',
        'SUM(cp.entradas) as totalEntradas',
        'SUM(cp.salidas) as totalSalidas',
        'SUM(cp.diferencia) as totalDiferencia',
        'COUNT(*) as registros',
      ])
      .where('YEAR(cp.fechaHora) = :year AND MONTH(cp.fechaHora) = :month', {
        year,
        month,
      })
      .groupBy('DATE(cp.fechaHora)')
      .orderBy('fecha', 'ASC')
      .getRawMany();
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
    updateConteoPasajerosDto: UpdateConteoPasajerosDto) {
    try {
      // 🔹 BÚSQUEDA DEL REGISTRO: Se valida que el registro de conteo exista
      const conteoPasajero = await this.conteopasajeroRepository.findOne({
        where: { id: id }
      });
      if (!conteoPasajero) throw new NotFoundException('Conteo Pasajero no encontrada.');

      // 🔹 VALIDACIÓN: No se puede actualizar si el conteo tiene estatus = 0 (inactivo)
      // Esto previene la modificación de registros que ya han sido finalizados
      if (conteoPasajero.estatus === 0) {
        throw new BadRequestException(
          `No se puede actualizar el conteo de pasajeros con ID: ${id} porque tiene estatus inactivo (0).`
        );
      }

      // 🔹 VALIDACIÓN: Si el conteo tiene un viaje asociado, verificar que el viaje no esté INACTIVO
      // Si el viaje está finalizado (INACTIVO), no se deben modificar los conteos asociados
      if (conteoPasajero.idViaje !== null && conteoPasajero.idViaje !== undefined) {
        const viajeAsociado = await this.viajesRepository.findOne({
          where: { id: conteoPasajero.idViaje }
        });

        if (!viajeAsociado) {
          throw new NotFoundException(
            `No se encontró el viaje asociado con ID: ${conteoPasajero.idViaje}.`
          );
        }

        // Verificar si el viaje está INACTIVO (estatus = 0 o EstatusEnum.INACTIVO)
        if (viajeAsociado.estatus === EstatusEnum.INACTIVO || viajeAsociado.estatus === 0) {
          throw new BadRequestException(
            `No se puede actualizar el conteo de pasajeros con ID: ${id} porque el viaje asociado (ID: ${conteoPasajero.idViaje}) está inactivo.`
          );
        }
      }

      // 🔹 VALIDACIÓN: Si se proporciona idViaje en el DTO, se verifica que el viaje exista y no esté INACTIVO
      // Esto previene la asociación a viajes finalizados o inexistentes
      if (updateConteoPasajerosDto.idViaje !== undefined && updateConteoPasajerosDto.idViaje !== null) {
        const viaje = await this.viajesRepository.findOne({
          where: { id: updateConteoPasajerosDto.idViaje }
        });

        if (!viaje) {
          throw new NotFoundException(`No se encontró el viaje con ID: ${updateConteoPasajerosDto.idViaje}.`)
        }

        // Verificar si el viaje nuevo está INACTIVO
        if (viaje.estatus === EstatusEnum.INACTIVO || viaje.estatus === 0) {
          throw new BadRequestException(
            `No se puede actualizar el conteo de pasajeros para asociarlo al viaje con ID: ${updateConteoPasajerosDto.idViaje} porque el viaje está inactivo.`
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