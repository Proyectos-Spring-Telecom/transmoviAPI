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
      const idRegionRuta = createRutaDto.idRegion;
      switch (rol) {
        case 1:
          // Usuario SuperAdministrador
          break;

        case 2:
          // Usuario Administrador
          const region = await this.regionesRepository.findOne({
            where: { id: createRutaDto.idRegion, idCliente: cliente },
          });
          if (!region) throw new NotFoundException('Region no encontrada');
          break;

        default:
          // Usuarios normales - solo sus regiones asignadas
          const permiso = await this.usuarioregionesRepository.find({
            where: { idUsuario: idUser, idRegion: idRegionRuta, estatus: 1 },
          });
          if (permiso.length === 0)
            throw new BadRequestException(`Acceso denegado`);
          break;
      }

      const newRuta = await this.rutasRepository.create(createRutaDto);
      const rutaSave = await this.rutasRepository.save(newRuta);

      // Registro en la bitácora SUCCESS
      await this.bitacoraLogger.logToBitacora(
        'Rutas',
        `Se creó una ruta con nombre: ${rutaSave.nombre}`,
        'CREATE',
        `${createRutaDto}`,
        idUser,
        17,
        EstatusEnumBitcora.SUCCESS,
      );

      // API response (con mensajes corregidos)
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Ruta creada correctamente', // ✅ Corregido
        data: {
          id: Number(rutaSave.id),
          nombre: `Ruta ${rutaSave.id} Nombre: ${rutaSave.nombre}`, // ✅ Mejorado
        },
      };
      return result;
    } catch (error) {
      // Registro en la bitácora ERROR
      await this.bitacoraLogger.logToBitacora(
        'Rutas',
        `Se creó una ruta con nombre: ${createRutaDto.nombre}`,
        'CREATE',
        `${createRutaDto}`,
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
    ru.Id AS id,
    ru.Nombre AS nombreRuta,
    ru.NombreInicio AS nombreInicio,
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

    -- Datos del cliente
    c.Id AS idCliente,
    CONCAT(c.Nombre, ' ', c.ApellidoPaterno, ' ', c.ApellidoMaterno) AS nombreCompletoCliente

  FROM UsuariosRegiones ur
  INNER JOIN Regiones r ON ur.IdRegion = r.Id
  INNER JOIN Rutas ru ON ru.IdRegion = r.Id
  LEFT JOIN Regiones rf ON ru.IdRegionFin = rf.Id
  INNER JOIN Clientes c ON r.IdCliente = c.Id

  WHERE ur.IdUsuario = ?
    AND ur.Estatus = 1
    AND r.Estatus = 1
  
  ORDER BY ru.Id DESC
  LIMIT ? OFFSET ?;
  `,
          [idUser, limit, offset],
        );

        // Query para total (sin paginación)
        totalResult = await this.usuarioregionesRepository.query(
          `
  SELECT COUNT(*) AS total
  FROM UsuariosRegiones ur
  INNER JOIN Regiones r ON ur.IdRegion = r.Id
  INNER JOIN Rutas ru ON ru.IdRegion = r.Id
  WHERE ur.IdUsuario = ?
    AND ur.Estatus = 1
    AND r.Estatus = 1
    AND ru.Estatus = 1
  `,
          [idUser],
        );
        break;

      case 2:
        // Consulta de datos paginados Usuario Administrador
        data = await this.usuarioregionesRepository.query(
          `
  SELECT 
    ru.Id AS id,
    ru.Nombre AS nombreRuta,
    ru.NombreInicio AS nombreInicio,
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

    -- Datos del cliente
    c.Id AS idCliente,
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
  WHERE ur.IdUsuario = ?
    AND ur.Estatus = 1
    AND r.Estatus = 1
    AND ru.Estatus = 1
    AND r.IdCliente = ?
  `,
          [idUser, cliente],
        );
        break;

      default:
        // Consulta de datos paginados resto Usuario
        data = await this.usuarioregionesRepository.query(
          `
  SELECT 
    ru.Id AS id,
    ru.Nombre AS nombreRuta,
    ru.NombreInicio AS nombreInicio,
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

    -- Datos del cliente
    c.Id AS idCliente,
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
  WHERE ur.IdUsuario = ?
    AND ur.Estatus = 1
    AND r.Estatus = 1
    AND ru.Estatus = 1
    AND r.IdCliente = ?
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

  async findAllList(idUser: number, cliente: number, rol: number) {
    try {
      let rutas;
      switch (rol) {
        case 1:
          rutas = await this.usuarioregionesRepository.query(
            `
            SELECT 
    ru.Id AS id,
    ru.Nombre AS nombreRuta,
    ru.NombreInicio AS nombreInicio,
    ru.NombreFin AS nombreFin,
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

ORDER BY ru.Id DESC;

            `,
            [idUser],
          );
          break;

        case 2:
          rutas = await this.usuarioregionesRepository.query(
            `
            SELECT 
    ru.Id AS id,
    ru.Nombre AS nombreRuta,
    ru.NombreInicio AS nombreInicio,
    ru.NombreFin AS nombreFin,
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
  AND c.Id = ? -- filtro por cliente

ORDER BY ru.Id DESC;

            `,
            [idUser, cliente],
          );
          break;

        default:
          rutas = await this.usuarioregionesRepository.query(
            `
            SELECT 
    ru.Id AS id,
    ru.Nombre AS nombreRuta,
    ru.NombreInicio AS nombreInicio,
    ru.NombreFin AS nombreFin,
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
        data:data,
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

  async findOne(id: number, idUser: number, cliente: number, rol: number) {
    try {
      let ruta;
      switch (rol) {
        case 1:
          // Usuario administrador
          ruta = await this.rutasRepository.findOne({
            relations: ['idRegion2'],
            where: {
              id: id,
            },
          });
          break;

        default:
          // Usuarios normales - solo sus regiones asignadas
          ruta = await this.rutasRepository.findOne({
            relations: ['idRegion2'],
            where: {
              id: id,
              idRegion2: {
                idCliente: cliente,
                estatus: 1,
              },
            },
          });
          break;
      }

      if (!ruta) {
        throw new NotFoundException('Rutas no encontrado');
      }

      // Conversión directa de IDs
      const region = ruta.idRegion2;

      const data = {
        ...ruta,
        id: Number(ruta.id),
        idRegion: Number(ruta.idRegion),
        idRegion2: region
          ? {
              ...region,
              id: Number(region.id),
              idCliente: Number(region.idCliente),
            }
          : null,
      };

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
      switch (rol) {
        case 1:
          // Usuario SuperAdministrador
          break;

        case 2:
          // Usuario Administrador
          break;

        default:
          // Usuarios normales - solo sus regiones asignadas
          const permiso = await this.usuarioregionesRepository.find({
            where: { idUsuario: idUser, idRegion: ruta.idRegion, estatus: 1 },
          });
          if (permiso.length === 0)
            throw new BadRequestException(`Acceso denegado`);
          break;
      }
      const estatus = updateRutasEstatusDto.estatus;
      await this.rutasRepository.update(id, { estatus: estatus });

      // Registro en la bitácora SUCCESS
      await this.bitacoraLogger.logToBitacora(
        'Rutas',
        `Se actualizo estatus a ${estatus}  de una Region con nombre: ${ruta.id}`,
        'UPDATE',
        `UPDATE FROM Rutas SET Estatus = ${estatus} WHERE Id= ${id}`,
        idUser,
        17,
        EstatusEnumBitcora.SUCCESS,
      );

      // API response (con mensajes corregidos)
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Estatus de la ruta actualizada correctamente', // ✅ Corregido
        data: {
          id: id,
          nombre: `Ruta ${id} `, // ✅ Mejorado
        },
      };
      return result;
    } catch (error) {
      // Registro en la bitácora ERROR
      await this.bitacoraLogger.logToBitacora(
        'Rutas',
        `Se actualizo estatus a ${updateRutasEstatusDto.estatus}  de una Region con ID: ${id}`,
        'UPDATE',
        `UPDATE FROM Rutas SET Estatus = ${updateRutasEstatusDto.estatus} WHERE Id= ${id}`,
        idUser,
        17,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al actualizar una ruta',
        error: error.message,
      });
    }
  }

  async update(
    id: number,
    idUser: number,
    cliente: number,
    updateRutaDto: UpdateRutaDto,
  ) {
    try {
      const ruta = await this.rutasRepository.findOne({ where: { id: id } });
      if (!ruta) throw new NotFoundException('Ruta no encontrada');
      switch (idUser) {
        case 1:
          // Usuario SuperAdministrador
          break;

        case 2:
          // Usuario Administrador
          break;

        default:
          // Usuarios normales - solo sus regiones asignadas
          const permiso = await this.usuarioregionesRepository.find({
            where: { idUsuario: idUser, idRegion: ruta.idRegion, estatus: 1 },
          });
          if (permiso.length === 0)
            throw new BadRequestException(`Acceso denegado`);
          break;
      }

      await this.rutasRepository.update(id, updateRutaDto);

      // Registro en la bitácora SUCCESS
      await this.bitacoraLogger.logToBitacora(
        'Rutas',
        `Se actualizo una Region con nombre: ${ruta.id}`,
        'UPDATE',
        `${updateRutaDto}`,
        idUser,
        17,
        EstatusEnumBitcora.SUCCESS,
      );

      // API response (con mensajes corregidos)
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
      await this.bitacoraLogger.logToBitacora(
        'Rutas',
        `Se actualizo una Region con ID: ${id}`,
        'UPDATE',
        `${updateRutaDto}`,
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

  async remove(id: number, idUser: number) {
    try {
      const ruta = await this.rutasRepository.findOne({ where: { id: id } });
      if (!ruta) throw new NotFoundException('Ruta no encontrada');
      switch (idUser) {
        case 1:
          // Usuario SuperAdministrador
          break;

        case 2:
          // Usuario Administrador
          break;

        default:
          // Usuarios normales - solo sus regiones asignadas
          const permiso = await this.usuarioregionesRepository.find({
            where: { idUsuario: idUser, idRegion: ruta.idRegion, estatus: 1 },
          });
          if (permiso.length === 0)
            throw new BadRequestException(`Acceso denegado`);
          break;
      }

      await this.rutasRepository.update(id, { estatus: 0 });

      // Registro en la bitácora SUCCESS
      await this.bitacoraLogger.logToBitacora(
        'Rutas',
        `Se elimino una Region con nombre: ${ruta.id}`,
        'DELETE',
        `DELETE FROM Rutas WHERE Id= ${id}`,
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
      await this.bitacoraLogger.logToBitacora(
        'Rutas',
        `Se elimino una Region con ID: ${id}`,
        'DELETE',
        `DELETE FROM Rutas WHERE Id= ${id}`,
        idUser,
        17,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al actualizar una ruta',
        error: error.message,
      });
    }
  }
}
