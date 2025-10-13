import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateRutaDto } from './dto/create-ruta.dto';
import { UpdateRutaDto } from './dto/update-ruta.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Regiones } from 'src/entities/Regiones';
import { Rutas } from 'src/entities/Rutas';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { UsuariosRegiones } from 'src/entities/UsuariosRegiones';
import { UpdateRutasEstatusDto } from './dto/update-ruta-estatus.dto';

@Injectable()
export class RutasService {
  constructor(
    @InjectRepository(Regiones)
    private readonly regionesRepository: Repository<Regiones>,
    @InjectRepository(Rutas)
    private readonly rutasRepository: Repository<Rutas>,
    @InjectRepository(UsuariosRegiones)
    private readonly usuarioregionesRepository: Repository<UsuariosRegiones>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  async create(
    idUser: number,
    cliente: number,
    rol: number,
    createRutaDto: CreateRutaDto,
  ): Promise<ApiCrudResponse> {
    try {
      let region;
      const idRegionRuta = createRutaDto.idRegion;

      region = await this.regionesRepository.findOne({
        where: { id: createRutaDto.idRegion },
      });
      if (!region) throw new NotFoundException('Region no encontrada');

      const newRuta = this.rutasRepository.create(createRutaDto);
      const rutaSave = await this.rutasRepository.save(newRuta);

      // Registro en la bitácora SUCCESS
      const querylogger = { createRutaDto };
      await this.bitacoraLogger.logToBitacora(
        'Rutas',
        `Se creó una ruta con nombre: ${rutaSave.nombre}  y Id ${rutaSave.id}`,
        'CREATE',
        querylogger,
        idUser,
        17,
        EstatusEnumBitcora.SUCCESS,
      );

      // API response (con mensajes corregidos)
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Ruta creada correctamente',
        data: {
          id: Number(rutaSave.id),
          nombre: `Ruta ${rutaSave.id} Nombre: ${rutaSave.nombre}`,
        },
      };
      return result;
    } catch (error) {
      // Registro en la bitácora ERROR
      const querylogger = { createRutaDto };
      await this.bitacoraLogger.logToBitacora(
        'Rutas',
        `Se creó una ruta con nombre: ${createRutaDto.nombre}`,
        'CREATE',
        querylogger,
        idUser,
        17,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al crear ruta',
        error: error.message,
      });
    }
  }

  private async consultarRutasPaginado(cliente: number, limit: number, offset: number) {
    const query = `
SELECT 
  -- RUTA
    ru.Id AS id,
    ru.Nombre AS nombre,
    ru.PuntoInicio AS puntoInicio,
    ru.NombreInicio AS nombreInicio,
    ru.PuntoFin AS puntoFin,
    ru.NombreFin AS nombreFin,
    ru.FechaCreacion AS fechaCreacionRuta,
    ru.Estatus AS estatusRuta,
    ru.IdRegionFin AS idRegionFin,

  -- REGIÓN INICIAL
  r.Id AS idRegion,
  r.Nombre AS nombreRegion,
  r.Descripcion AS descripcionRegion,
  r.FechaCreacion AS fechaCreacionRegion,
  r.FechaActualizacion AS fechaActualizacionRegion,
  r.Estatus AS estatusRegion,

  -- REGIÓN FINAL (si existe)
  rf.Id AS idRegionFinDetalle,
  rf.Nombre AS nombreRegionFinDetalle,
  rf.Descripcion AS descripcionRegionFin,
  rf.FechaCreacion AS fechaCreacionRegionFin,
  rf.FechaActualizacion AS fechaActualizacionRegionFin,
  rf.Estatus AS estatusRegionFin,

  -- CLIENTE
  c.Id AS idCliente,
  c.Nombre As nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente,
  CONCAT(c.Nombre, ' ', c.ApellidoPaterno, ' ', c.ApellidoMaterno) AS nombreCompletoCliente

FROM Rutas ru
INNER JOIN Regiones r ON ru.IdRegion = r.Id
LEFT JOIN Regiones rf ON ru.IdRegionFin = rf.Id
INNER JOIN Clientes c ON r.IdCliente = c.Id

WHERE 
  c.Id = ?        -- 🔹 aquí filtras por el Id del cliente
  AND r.Estatus = 1
  AND c.Estatus = 1
ORDER BY ru.Id DESC

  LIMIT ? OFFSET ?;
    `;
    return this.usuarioregionesRepository.query(query, [cliente,limit, offset]);
  }

  private async consultarTotalRutasPaginados(cliente: number) {
    const query = `  
    SELECT COUNT(*) AS total
FROM Rutas ru
INNER JOIN Regiones r ON ru.IdRegion = r.Id
LEFT JOIN Regiones rf ON ru.IdRegionFin = rf.Id
INNER JOIN Clientes c ON r.IdCliente = c.Id

WHERE 
  c.Id = ?        -- 🔹 aquí filtras por el Id del cliente
  AND r.Estatus = 1
  AND c.Estatus = 1
`;
    return await this.usuarioregionesRepository.query(query, [cliente]);
  }
  async obtenerRutasPorUsuarioSQL(
    idUser: number,
    cliente: number,
    rol: number,
    page: number,
    limit: number,
  ) {
    const offset = (page - 1) * limit;
    let data;
    let totalResult;
    switch (rol) {
      case 1:
        // Consulta de datos paginados Usuario SuperAdministrador
        data = await this.usuarioregionesRepository.query(
          `
SELECT 
  -- RUTA
    ru.Id AS id,
    ru.Nombre AS nombre,
    ru.PuntoInicio AS puntoInicio,
    ru.NombreInicio AS nombreInicio,
    ru.PuntoFin AS puntoFin,
    ru.NombreFin AS nombreFin,
    ru.FechaCreacion AS fechaCreacionRuta,
    ru.Estatus AS estatusRuta,
    ru.IdRegionFin AS idRegionFin,

  -- REGIÓN INICIAL
  r.Id AS idRegion,
  r.Nombre AS nombreRegion,
  r.Descripcion AS descripcionRegion,
  r.FechaCreacion AS fechaCreacionRegion,
  r.FechaActualizacion AS fechaActualizacionRegion,
  r.Estatus AS estatusRegion,

  -- REGIÓN FINAL (si existe)
  rf.Id AS idRegionFinDetalle,
  rf.Nombre AS nombreRegionFinDetalle,
  rf.Descripcion AS descripcionRegionFin,
  rf.FechaCreacion AS fechaCreacionRegionFin,
  rf.FechaActualizacion AS fechaActualizacionRegionFin,
  rf.Estatus AS estatusRegionFin,

  -- CLIENTE
  c.Id AS idCliente,
  c.Nombre As nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente,
  CONCAT(c.Nombre, ' ', c.ApellidoPaterno, ' ', c.ApellidoMaterno) AS nombreCompletoCliente

FROM Rutas ru
INNER JOIN Regiones r ON ru.IdRegion = r.Id
LEFT JOIN Regiones rf ON ru.IdRegionFin = rf.Id
INNER JOIN Clientes c ON r.IdCliente = c.Id

WHERE 
  r.Estatus = 1
ORDER BY ru.Id DESC

  LIMIT ? OFFSET ?;
  `,
          [limit, offset],
        );

        // Query para total (sin paginación)
        totalResult = await this.usuarioregionesRepository.query(
          `
  SELECT COUNT(*) AS total
FROM Rutas ru
INNER JOIN Regiones r ON ru.IdRegion = r.Id
LEFT JOIN Regiones rf ON ru.IdRegionFin = rf.Id
INNER JOIN Clientes c ON r.IdCliente = c.Id

WHERE 
  r.Estatus = 1
  `,
        );
        break;

      case 2:
        // Consulta de datos paginados Usuario Administrador
        data = await this.consultarRutasPaginado(cliente, limit, offset);

        // Query para total (sin paginación)
        totalResult = await this.consultarTotalRutasPaginados(cliente);
        break;

      case 8:
        // Consulta de datos paginados Usuario Reportes
        data = await this.consultarRutasPaginado(cliente, limit, offset);

        // Query para total (sin paginación)
        totalResult = await this.consultarTotalRutasPaginados(cliente);
        break;

      case 10:
        // Consulta de datos paginados Usuario Capturista
        data = await this.consultarRutasPaginado(cliente, limit, offset);

        // Query para total (sin paginación)
        totalResult = await this.consultarTotalRutasPaginados(cliente);
        break;

      default:
        // Consulta de datos paginados resto Usuario
        data = await this.usuarioregionesRepository.query(
          `
  SELECT 
    ru.Id AS id,
    ru.Nombre AS nombre,
    ru.PuntoInicio AS puntoInicio,
    ru.NombreInicio AS nombreInicio,
    ru.PuntoFin AS puntoFin,
    ru.NombreFin AS nombreFin,
    ru.FechaCreacion AS fechaCreacionRuta,
    ru.Estatus AS estatusRuta,
    ru.IdRegionFin AS idRegionFin,

    -- Datos de la región inicial
    r.Id AS idRegion,
    r.Nombre AS nombreRegion,
    r.Descripcion AS descripcionRegion,
    r.FechaCreacion AS fechaCreacionRegion,
    r.FechaActualizacion AS fechaActualizacionRegion,
    r.Estatus AS estatusRegion,

    -- Datos de la región final (si existe)
    rf.Id AS idRegionFinDetalle,
    rf.Nombre AS nombreRegionFinDetalle,
    rf.Descripcion AS descripcionRegionFin,
    rf.FechaCreacion AS fechaCreacionRegionFin,
    rf.FechaActualizacion AS fechaActualizacionRegionFin,
    rf.Estatus AS estatusRegionFin,

  -- CLIENTE
  c.Id AS idCliente,
  c.Nombre As nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente,
    CONCAT(c.Nombre, ' ', c.ApellidoPaterno, ' ', c.ApellidoMaterno) AS nombreCompletoCliente

  FROM UsuariosRegiones ur
  INNER JOIN Regiones r ON ur.IdRegion = r.Id
  INNER JOIN Rutas ru ON ru.IdRegion = r.Id
  LEFT JOIN Regiones rf ON ru.IdRegionFin = rf.Id
  INNER JOIN Clientes c ON r.IdCliente = c.Id

  WHERE ur.IdUsuario = ?
    AND ur.Estatus = 1
    AND r.Estatus = 1
    AND c.Id = ?
  
  ORDER BY ru.Id DESC
  LIMIT ? OFFSET ?;
  `,
          [idUser, cliente, limit, offset],
        );

        // Query para total (sin paginación)
        totalResult = await this.usuarioregionesRepository.query(
          `
  SELECT COUNT(*) AS total
  FROM UsuariosRegiones ur
  INNER JOIN Regiones r ON ur.IdRegion = r.Id
  INNER JOIN Rutas ru ON ru.IdRegion = r.Id
  LEFT JOIN Regiones rf ON ru.IdRegionFin = rf.Id
  INNER JOIN Clientes c ON r.IdCliente = c.Id

  WHERE ur.IdUsuario = ?
    AND ur.Estatus = 1
    AND r.Estatus = 1
    AND c.Id = ?
  `,
          [idUser, cliente],
        );
        break;
    }

    const total = Number(totalResult[0]?.total || 0);

    // Mapeo de resultados con conversión de tipos y manejo de idRegionFin
    const rutas = data.map((item) => ({
      ...item,
      id: item.id ? Number(item.id) : null,
      idRegion: item.idRegion ? Number(item.idRegion) : null,
      idRegionFin: item.idRegionFin ? Number(item.idRegionFin) : null,
      idRegionFinDetalle: item.idRegionFinDetalle
        ? Number(item.idRegionFinDetalle)
        : null,
      idCliente: item.idCliente ? Number(item.idCliente) : null,
    }));

    return {
      data: rutas,
      pagination: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
      },
    };
  }

  private async consultarRutasListado(cliente: number) {
    const query = `
    SELECT 
  -- RUTA
    ru.Id AS id,
    ru.Nombre AS nombre,
    ru.PuntoInicio AS puntoInicio,
    ru.NombreInicio AS nombreInicio,
    ru.PuntoFin AS puntoFin,
    ru.NombreFin AS nombreFin,
    ru.FechaCreacion AS fechaCreacionRuta,
    ru.Estatus AS estatusRuta,
    ru.IdRegionFin AS idRegionFin,

  -- REGIÓN INICIAL
  r.Id AS idRegion,
  r.Nombre AS nombreRegion,
  r.Descripcion AS descripcionRegion,
  r.FechaCreacion AS fechaCreacionRegion,
  r.FechaActualizacion AS fechaActualizacionRegion,
  r.Estatus AS estatusRegion,

  -- REGIÓN FINAL (si existe)
  rf.Id AS idRegionFinDetalle,
  rf.Nombre AS nombreRegionFinDetalle,
  rf.Descripcion AS descripcionRegionFin,
  rf.FechaCreacion AS fechaCreacionRegionFin,
  rf.FechaActualizacion AS fechaActualizacionRegionFin,
  rf.Estatus AS estatusRegionFin,

  -- CLIENTE
  c.Id AS idCliente,
  c.Nombre As nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente,
  CONCAT(c.Nombre, ' ', c.ApellidoPaterno, ' ', c.ApellidoMaterno) AS nombreCompletoCliente

FROM Rutas ru
INNER JOIN Regiones r ON ru.IdRegion = r.Id
LEFT JOIN Regiones rf ON ru.IdRegionFin = rf.Id
INNER JOIN Clientes c ON r.IdCliente = c.Id

WHERE 
      c.Id = ?
  AND c.Estatus = 1
  AND r.Estatus = 1
  AND ru.Estatus = 1
ORDER BY ru.Id DESC;
    `
    return await this.usuarioregionesRepository.query(query, [cliente]);
  }

  async findAllList(idUser: number, cliente: number, rol: number) {
    try {
      let rutas;
      switch (rol) {
        case 1:
          // Consulta de datos paginados Usuario Administrador
          rutas = await this.usuarioregionesRepository.query(
            `
SELECT 
  -- RUTA
    ru.Id AS id,
    ru.Nombre AS nombre,
    ru.PuntoInicio AS puntoInicio,
    ru.NombreInicio AS nombreInicio,
    ru.PuntoFin AS puntoFin,
    ru.NombreFin AS nombreFin,
    ru.FechaCreacion AS fechaCreacionRuta,
    ru.Estatus AS estatusRuta,
    ru.IdRegionFin AS idRegionFin,

  -- REGIÓN INICIAL
  r.Id AS idRegion,
  r.Nombre AS nombreRegion,
  r.Descripcion AS descripcionRegion,
  r.FechaCreacion AS fechaCreacionRegion,
  r.FechaActualizacion AS fechaActualizacionRegion,
  r.Estatus AS estatusRegion,

  -- REGIÓN FINAL (si existe)
  rf.Id AS idRegionFinDetalle,
  rf.Nombre AS nombreRegionFinDetalle,
  rf.Descripcion AS descripcionRegionFin,
  rf.FechaCreacion AS fechaCreacionRegionFin,
  rf.FechaActualizacion AS fechaActualizacionRegionFin,
  rf.Estatus AS estatusRegionFin,

  -- CLIENTE
  c.Id AS idCliente,
  c.Nombre As nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente,
  CONCAT(c.Nombre, ' ', c.ApellidoPaterno, ' ', c.ApellidoMaterno) AS nombreCompletoCliente

FROM Rutas ru
INNER JOIN Regiones r ON ru.IdRegion = r.Id
LEFT JOIN Regiones rf ON ru.IdRegionFin = rf.Id
INNER JOIN Clientes c ON r.IdCliente = c.Id

WHERE 
  r.Estatus = 1
  AND ru.Estatus = 1
ORDER BY ru.Id DESC
  `,
          );
          break;

        case 2:
          // Consulta de datos paginados Usuario Administrador
          rutas = await this.consultarRutasListado(cliente)
          break;

        case 8:
          // Consulta de datos paginados Usuario Reportes
          rutas = await this.consultarRutasListado(cliente)
          break;

        case 10:
          // Consulta de datos paginados Usuario Capturista
          rutas = await this.consultarRutasListado(cliente)
          break;

        default:
          // Consulta de datos paginados Usuario
          rutas = await this.usuarioregionesRepository.query(
            `
            SELECT 
    ru.Id AS id,
    ru.Nombre AS nombre,
    ru.PuntoInicio AS puntoInicio,
    ru.NombreInicio AS nombreInicio,
    ru.PuntoFin AS puntoFin,
    ru.NombreFin AS nombreFin,
    ru.FechaCreacion AS fechaCreacionRuta,
    ru.Estatus AS estatusRuta,
    ru.IdRegionFin AS idRegionFin,
    
    r.Id AS idRegion,
    r.Nombre AS nombreRegion,
    r.Descripcion AS descripcionRegion,
    r.FechaCreacion AS fechaCreacionRegion,
    r.FechaActualizacion AS fechaActualizacionRegion,
    r.Estatus AS estatusRegion,
    
    rf.Id AS idRegionFinDetalle,
    rf.Nombre AS nombreRegionFinDetalle,
    rf.Descripcion AS descripcionRegionFin,
    rf.FechaCreacion AS fechaCreacionRegionFin,
    rf.FechaActualizacion AS fechaActualizacionRegionFin,
    rf.Estatus AS estatusRegionFin,
    
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    CONCAT(c.Nombre, ' ', c.ApellidoPaterno, ' ', c.ApellidoMaterno) AS nombreCompletoCliente

FROM UsuariosRegiones ur
INNER JOIN Regiones r ON ur.IdRegion = r.Id            -- Región inicial
INNER JOIN Rutas ru ON ru.IdRegion = r.Id              -- Ruta
LEFT JOIN Regiones rf ON ru.IdRegionFin = rf.Id        -- Región final (puede ser null)
INNER JOIN Clientes c ON r.IdCliente = c.Id            -- Cliente

WHERE ur.IdUsuario = ?
  AND ur.Estatus = 1
  AND r.Estatus = 1
  AND ru.Estatus = 1
  AND c.Estatus = 1
  AND c.Id = ? -- filtro por cliente

ORDER BY ru.Id DESC;

            `,
            [idUser, cliente],
          );
          break;
      }

      if (rutas.length === 0) {
        throw new NotFoundException('Rutas no encontradas');
      }

      // Mapeo de resultados con conversión de tipos y manejo de idRegionFin
      const data = rutas.map((item) => ({
        ...item,
        id: item.id ? Number(item.id) : null,
        idRegion: item.idRegion ? Number(item.idRegion) : null,
        idRegionFin: item.idRegionFin ? Number(item.idRegionFin) : null,
        idRegionFinDetalle: item.idRegionFinDetalle
          ? Number(item.idRegionFinDetalle)
          : null,
        idCliente: item.idCliente ? Number(item.idCliente) : null,
      }));

      // API response
      const result: ApiResponseCommon = {
        data: data,
      };

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtener listado de rutas',
        error: error.message,
      });
    }
  }

  private async consultarRutasOne(id: number, cliente: number) {
    const query = `
     SELECT 
  -- RUTA
    ru.Id AS id,
    ru.Nombre AS nombre,
    ru.PuntoInicio AS puntoInicio,
    ru.NombreInicio AS nombreInicio,
    ru.PuntoFin AS puntoFin,
    ru.NombreFin AS nombreFin,
    ru.FechaCreacion AS fechaCreacionRuta,
    ru.Estatus AS estatusRuta,
    ru.IdRegionFin AS idRegionFin,

  -- REGIÓN INICIAL
  r.Id AS idRegion,
  r.Nombre AS nombreRegion,
  r.Descripcion AS descripcionRegion,
  r.FechaCreacion AS fechaCreacionRegion,
  r.FechaActualizacion AS fechaActualizacionRegion,
  r.Estatus AS estatusRegion,

  -- REGIÓN FINAL (si existe)
  rf.Id AS idRegionFinDetalle,
  rf.Nombre AS nombreRegionFinDetalle,
  rf.Descripcion AS descripcionRegionFin,
  rf.FechaCreacion AS fechaCreacionRegionFin,
  rf.FechaActualizacion AS fechaActualizacionRegionFin,
  rf.Estatus AS estatusRegionFin,

  -- CLIENTE
  c.Id AS idCliente,
  c.Nombre As nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente,
  CONCAT(c.Nombre, ' ', c.ApellidoPaterno, ' ', c.ApellidoMaterno) AS nombreCompletoCliente

FROM Rutas ru
INNER JOIN Regiones r ON ru.IdRegion = r.Id
LEFT JOIN Regiones rf ON ru.IdRegionFin = rf.Id
INNER JOIN Clientes c ON r.IdCliente = c.Id

WHERE 
      c.Id = ?
  AND c.Estatus = 1
  AND r.Estatus = 1
  AND ru.Id = ?
ORDER BY ru.Id DESC;
    `
    return await this.usuarioregionesRepository.query(query, [cliente, id]);
  }

  async findOne(id: number, idUser: number, cliente: number, rol: number) {
    try {
      let ruta;
      switch (rol) {
        case 1:
          // Consulta de datos paginados Usuario SuperAdministrador
          ruta = await this.usuarioregionesRepository.query(
            `
     SELECT 
  -- RUTA
    ru.Id AS id,
    ru.Nombre AS nombre,
    ru.PuntoInicio AS puntoInicio,
    ru.NombreInicio AS nombreInicio,
    ru.PuntoFin AS puntoFin,
    ru.NombreFin AS nombreFin,
    ru.FechaCreacion AS fechaCreacionRuta,
    ru.Estatus AS estatusRuta,
    ru.IdRegionFin AS idRegionFin,

  -- REGIÓN INICIAL
  r.Id AS idRegion,
  r.Nombre AS nombreRegion,
  r.Descripcion AS descripcionRegion,
  r.FechaCreacion AS fechaCreacionRegion,
  r.FechaActualizacion AS fechaActualizacionRegion,
  r.Estatus AS estatusRegion,

  -- REGIÓN FINAL (si existe)
  rf.Id AS idRegionFinDetalle,
  rf.Nombre AS nombreRegionFinDetalle,
  rf.Descripcion AS descripcionRegionFin,
  rf.FechaCreacion AS fechaCreacionRegionFin,
  rf.FechaActualizacion AS fechaActualizacionRegionFin,
  rf.Estatus AS estatusRegionFin,

  -- CLIENTE
  c.Id AS idCliente,
  c.Nombre As nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente,
  CONCAT(c.Nombre, ' ', c.ApellidoPaterno, ' ', c.ApellidoMaterno) AS nombreCompletoCliente

FROM Rutas ru
INNER JOIN Regiones r ON ru.IdRegion = r.Id
LEFT JOIN Regiones rf ON ru.IdRegionFin = rf.Id
INNER JOIN Clientes c ON r.IdCliente = c.Id

WHERE 
      c.Estatus = 1
  AND r.Estatus = 1
  AND ru.Id = ?
ORDER BY ru.Id DESC;

            `,
            [id],
          );
          break;

        default:
          // Consulta de datos paginados Usuario SuperAdministrador
          ruta = await this.consultarRutasOne(id, cliente)
          break;
      }

      if (ruta.length == 0) {
        throw new NotFoundException('Ruta no encontrado');
      }

      // Conversión directa de IDs
      const region = ruta.idRegion2;

      const data = ruta.map((item) => ({
        ...item,
        id: Number(item.id),
        idRegion: Number(item.idRegion),
        idRegionFin: Number(item.idRegionFin),
        idRegionFinDetalle: Number(item.idRegionFinDetalle),
        idCliente: Number(item.idCliente),
      }));

      //APi response
      const result: ApiResponseCommon = {
        data: data,
      };

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtener una ruta',
        error: error.message,
      });
    }
  }

  async updateEstatus(
    id: number,
    idUser: number,
    cliente: number,
    rol: number,
    updateRutasEstatusDto: UpdateRutasEstatusDto,
  ) {
    try {
      const ruta = await this.rutasRepository.findOne({ where: { id: id } });
      if (!ruta) throw new NotFoundException('Ruta no encontrada');
      
      const estatus = updateRutasEstatusDto.estatus;
      await this.rutasRepository.update(id, { estatus: estatus });

      // Registro en la bitácora SUCCESS
      const querylogger = { updateRutasEstatusDto };
      await this.bitacoraLogger.logToBitacora(
        'Rutas',
        `Se actualizo estatus a ${estatus}  de una Ruta con Id: ${ruta.id}`,
        'UPDATE',
        querylogger,
        idUser,
        17,
        EstatusEnumBitcora.SUCCESS,
      );

      // API response (con mensajes corregidos)
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Estatus de la ruta actualizada correctamente',
        data: {
          id: id,
          nombre: `Ruta ${id} `,
        },
      };
      return result;
    } catch (error) {
      // Registro en la bitácora ERROR
      const querylogger = { updateRutasEstatusDto };
      await this.bitacoraLogger.logToBitacora(
        'Rutas',
        `Se actualizo estatus a ${updateRutasEstatusDto.estatus}  de una Ruta con ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        17,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al actualizar estatus de una ruta',
        error: error.message,
      });
    }
  }

  async update(
    id: number,
    idUser: number,
    cliente: number,
    rol: number,
    updateRutaDto: UpdateRutaDto,
  ) {
    try {
      const ruta = await this.rutasRepository.findOne({ where: { id: id } });
      if (!ruta) throw new NotFoundException('Ruta no encontrada');
      
      await this.rutasRepository.update(id, updateRutaDto);

      // Registro en la bitácora SUCCESS
      const querylogger = { updateRutaDto };
      await this.bitacoraLogger.logToBitacora(
        'Rutas',
        `Se actualizo una Rutas con Id: ${ruta.id}`,
        'UPDATE',
        querylogger,
        idUser,
        17,
        EstatusEnumBitcora.SUCCESS,
      );

      // API response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Ruta actualizada correctamente',
        data: {
          id: id,
          nombre: `Ruta ${id} `,
        },
      };
      return result;
    } catch (error) {
      // Registro en la bitácora ERROR
      const querylogger = { updateRutaDto };
      await this.bitacoraLogger.logToBitacora(
        'Rutas',
        `Se actualizo una Ruta con ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        17,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al actualizar ruta',
        error: error.message,
      });
    }
  }

  async remove(id: number, idUser: number, rol: number) {
    try {
      const ruta = await this.rutasRepository.findOne({ where: { id: id } });
      if (!ruta) throw new NotFoundException('Ruta no encontrada');

      await this.rutasRepository.update(id, { estatus: 0 });

      // Registro en la bitácora SUCCESS
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Rutas',
        `Se elimino una Ruta con Id: ${ruta.id}`,
        'UPDATE',
        querylogger,
        idUser,
        17,
        EstatusEnumBitcora.SUCCESS,
      );

      // API response (con mensajes corregidos)
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Ruta eliminada logicamente correctamente',
        data: {
          id: id,
          nombre: `Ruta ${id}, Nombre: ${ruta.nombre} `,
        },
      };
      return result;
    } catch (error) {
      // Registro en la bitácora SUCCESS
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Rutas',
        `Se elimino una Ruta con ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        17,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al eliminado logico una ruta',
        error: error.message,
      });
    }
  }

  async removeTotal(id: number, idUser: number, rol: number) {
    try {
      let ruta;
      switch (rol) {
        case 1:
          // Usuario SuperAdministrador
          ruta = await this.rutasRepository.findOne({
            where: { id: id },
          });
          if (!ruta) throw new NotFoundException('Ruta no encontrada');
          break;

        default:
          // Usuarios normales - solo sus regiones asignadas
          throw new BadRequestException(`Acceso denegado`);
          break;
      }

      await this.rutasRepository.delete({ id: id });

      // Registro en la bitácora SUCCESS
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Rutas',
        `Se elimino una Ruta con Id: ${ruta.id}`,
        'DELETE',
        querylogger,
        idUser,
        17,
        EstatusEnumBitcora.SUCCESS,
      );

      // API response (con mensajes corregidos)
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Ruta eliminada correctamente', // ✅ Corregido
        data: {
          id: id,
          nombre: `Ruta ${id}, Nombre: ${ruta.nombre} `, // ✅ Mejorado
        },
      };
      return result;
    } catch (error) {
      // Registro en la bitácora SUCCESS
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Rutas',
        `Se elimino una Ruta con Id: ${id}`,
        'DELETE',
        querylogger,
        idUser,
        17,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al eliminado permanente una ruta',
        error: error.message,
      });
    }
  }
}
