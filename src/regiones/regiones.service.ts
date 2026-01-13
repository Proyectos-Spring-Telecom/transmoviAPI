import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateRegionesDto } from './dto/create-regione.dto';
import { UpdateRegioneDto } from './dto/update-regione.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Regiones } from 'src/entities/Regiones';
import { Repository } from 'typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { UsuariosRegiones } from 'src/entities/UsuariosRegiones';
import { UpdateRegionesEstatusDto } from './dto/update-regione-estatus.dto';
import { Clientes } from 'src/entities/Clientes';

@Injectable()
export class RegionesService {
  constructor(
    @InjectRepository(Regiones)
    private readonly regionesRepository: Repository<Regiones>,
    @InjectRepository(UsuariosRegiones)
    private readonly usuarioregionesRepository: Repository<UsuariosRegiones>,
    @InjectRepository(Clientes)
    private readonly clienteRepository: Repository<Clientes>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) { }

  //Crear Region
  async create(
    idUser: number,
    cliente: number,
    rol: number,
    createRegionesDto: CreateRegionesDto,
  ): Promise<ApiCrudResponse> {
    try {
      let rootPermisos;
      createRegionesDto.nombre = createRegionesDto.nombre.toUpperCase();

      const newRegion = await this.regionesRepository.create(createRegionesDto);
      const regionSave = await this.regionesRepository.save(newRegion);

      //Asignamos a root la region
      switch (rol) {
        case 1:
          rootPermisos = {
            idUsuario: 1, //Se asigna al usuario supremo
            idRegion: regionSave.id,
          };
          await this.usuarioregionesRepository.save(rootPermisos);
          break;

        case 2:
          rootPermisos = {
            idUsuario: 1, //Se asigna al usuario supremo SuperAdministrador
            idRegion: regionSave.id,
          };
          await this.usuarioregionesRepository.save(rootPermisos);
          const userPermisos = {
            idUsuario: idUser, //Se asigna al Administrador
            idRegion: regionSave.id,
          };
          await this.usuarioregionesRepository.save(userPermisos);
          break;

        default:
          rootPermisos = {
            idUsuario: 1, //Se asigna al usuario supremo SuperAdministrador
            idRegion: regionSave.id,
          };
          await this.usuarioregionesRepository.save(rootPermisos);
          break;
      }

      // Registro en la bitácora SUCCESS
      const querylogger = { createRegionesDto };
      await this.bitacoraLogger.logToBitacora(
        'Regiones',
        `Se creó una Region con nombre: ${regionSave.nombre}`,
        'CREATE',
        querylogger,
        idUser,
        16,
        EstatusEnumBitcora.SUCCESS,
      );

      // API response (con mensajes corregidos)
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Region creada correctamente',
        data: {
          id: Number(regionSave.id),
          nombre: `Region ${regionSave.id} Nombre: ${regionSave.nombre} Descripción:${regionSave.descripcion}`, // ✅ Mejorado
        },
      };
      return result;
    } catch (error) {
      console.log(error);
      // Registro en la bitácora en caso ERROR
      const querylogger = { createRegionesDto };
      await this.bitacoraLogger.logToBitacora(
        'Regiones',
        `Se creó una Region con nombre: ${createRegionesDto.nombre}`,
        'CREATE',
        querylogger,
        idUser,
        16,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException({
        message: 'Error al crear Region',
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

  //Funcion para obtener paginado por clientes
  private async consultarRegionesPagina(
    cliente: number,
    limit: number,
    offset: number,
  ) {
    const { ids, placeholders } = await this.clienteHijos(cliente);
    const query = `
SELECT
  -- Región
  r.Id AS id,
  r.Nombre AS nombre,
  r.Descripcion AS descripcion,
  r.Geocerca AS geocerca,
  r.FechaCreacion AS fechaCreacion,
  r.FechaActualizacion AS fechaActualizacion,
  r.Estatus AS estatus,

  -- Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM Regiones r
INNER JOIN Clientes c ON r.IdCliente = c.Id

WHERE 
  r.IdCliente IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar

ORDER BY r.Id DESC
  LIMIT ? OFFSET ?;
    `;
    return this.regionesRepository.query(query, [...ids, limit, offset]);
  }

  //Obtener total para la funcion de paginado
  private async consultarTotalRegionesPaginados(cliente: number) {
    const { ids, placeholders } = await this.clienteHijos(cliente);
    const query = `  
  SELECT COUNT(*) AS total
  FROM Regiones r
INNER JOIN Clientes c ON r.IdCliente = c.Id
WHERE 
  r.IdCliente IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar

`;
    return await this.regionesRepository.query(query, [...ids]);
  }

  //Paginado
  async findAll(
    cliente: number,
    idUser: number,
    rol: number,
    page: number,
    limit: number,
  ) {
    try {
      const offset = (page - 1) * limit;
      let totalResult;
      let regiones;
      //Obtenemos ConteoPasajeros
      switch (rol) {
        case 1:
          // Usuario SuperAdministrador - obtiene todas las regiones
          regiones = await this.regionesRepository.query(
            `
SELECT
  -- Región
  r.Id AS id,
  r.Nombre AS nombre,
  r.Descripcion AS descripcion,
  r.Geocerca AS geocerca,
  r.FechaCreacion AS fechaCreacion,
  r.FechaActualizacion AS fechaActualizacion,
  r.Estatus AS estatus,

  -- Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM Regiones r
INNER JOIN Clientes c ON r.IdCliente = c.Id

ORDER BY r.Id DESC
  LIMIT ? OFFSET ?;

            `,
            [limit, offset],
          );

          // Query para total (sin paginación)
          totalResult = await this.regionesRepository.query(
            `
  SELECT COUNT(*) AS total
  FROM Regiones r
INNER JOIN Clientes c ON r.IdCliente = c.Id

  `,
          );
          break;

        case 2:
          // Usuario administrador - obtiene todas las regiones de su cliente
          regiones = await this.consultarRegionesPagina(cliente, limit, offset);

          // Query para total (sin paginación)
          totalResult = await this.consultarTotalRegionesPaginados(cliente);
          break;

        case 3:
          // Usuario operador - obtiene todas las regiones de su cliente
          regiones = await this.consultarRegionesPagina(cliente, limit, offset);

          // Query para total (sin paginación)
          totalResult = await this.consultarTotalRegionesPaginados(cliente);
          break;

        case 8:
          // Usuario Reportes - obtiene todas las regiones de su cliente
          regiones = await this.consultarRegionesPagina(cliente, limit, offset);

          // Query para total (sin paginación)
          totalResult = await this.consultarTotalRegionesPaginados(cliente);
          break;

        case 10:
          // Usuario Capturistas - obtiene todas las regiones de su cliente
          regiones = await this.consultarRegionesPagina(cliente, limit, offset);

          // Query para total (sin paginación)
          totalResult = await this.consultarTotalRegionesPaginados(cliente);
          break;

        default:
          // Usuarios normales - solo sus regiones asignadas
          regiones = await this.regionesRepository.query(
            `
SELECT
  -- Región
  r.Id AS id,
  r.Nombre AS nombre,
  r.Descripcion AS descripcion,
  r.Geocerca AS geocerca,
  r.FechaCreacion AS fechaCreacion,
  r.FechaActualizacion AS fechaActualizacion,
  r.Estatus AS estatus,

  -- Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM Regiones r
INNER JOIN Clientes c ON r.IdCliente = c.Id
INNER JOIN UsuariosRegiones ur ON ur.IdRegion = r.Id
INNER JOIN Usuarios u ON ur.IdUsuario = u.Id

WHERE 
  ur.IdUsuario = ?       -- 🔹 ID del usuario a filtrar
  AND ur.Estatus = 1

ORDER BY r.Id DESC
  LIMIT ? OFFSET ?;

            `,
            [idUser, limit, offset],
          );

          // Query para total (sin paginación)
          totalResult = await this.regionesRepository.query(
            `
  SELECT COUNT(*) AS total
FROM Regiones r
INNER JOIN Clientes c ON r.IdCliente = c.Id
INNER JOIN UsuariosRegiones ur ON ur.IdRegion = r.Id
INNER JOIN Usuarios u ON ur.IdUsuario = u.Id

WHERE 
  ur.IdUsuario = ?       -- 🔹 ID del usuario a filtrar
  AND ur.Estatus = 1

  `,
            [idUser],
          );
          break;
      }

      const total = Number(totalResult[0]?.total || 0);

      // 🔥 Forzamos ids a number y agregamos nombreCompleto
      const data = regiones.map((item) => ({
        ...item,
        id: Number(item.id),
        idCliente: Number(item.idCliente),
      }));

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
      console.log(error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtener paginado Regiones',
        error: error.message,
      });
    }
  }

  //Funcion Obtener listado por cliente
  private async consultarRegionesListado(cliente: number) {
    const { ids, placeholders } = await this.clienteHijos(cliente);
    const query = `
SELECT
  -- Región
  r.Id AS id,
  r.Nombre AS nombre,
  r.Descripcion AS descripcion,
  r.Geocerca AS geocerca,
  r.FechaCreacion AS fechaCreacion,
  r.FechaActualizacion AS fechaActualizacion,
  r.Estatus AS estatus,

  -- Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM Regiones r
INNER JOIN Clientes c ON r.IdCliente = c.Id

WHERE 
  r.IdCliente IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar
  AND r.Estatus = 1
  AND c.Estatus = 1

ORDER BY r.Id DESC
    `;
    return this.regionesRepository.query(query, [...ids]);
  }

  //Obtener listado por idCliente recibido por ruta (solo del cliente, sin hijos)
  async findByCliente(idCliente: number, idUser: number, rol: number) {
    try {
      // Consulta directa sin incluir clientes hijos
      const regiones = await this.regionesRepository.query(
        `
SELECT
  -- Región
  r.Id AS id,
  r.Nombre AS nombre,
  r.Descripcion AS descripcion,
  r.Geocerca AS geocerca,
  r.FechaCreacion AS fechaCreacion,
  r.FechaActualizacion AS fechaActualizacion,
  r.Estatus AS estatus,

  -- Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM Regiones r
INNER JOIN Clientes c ON r.IdCliente = c.Id

WHERE 
  r.IdCliente = ?
  AND r.Estatus = 1
  AND c.Estatus = 1

ORDER BY r.Id DESC
        `,
        [idCliente],
      );

      // 🔥 Forzamos ids a number
      const data = regiones.map((item) => ({
        ...item,
        id: Number(item.id),
        idCliente: Number(item.idCliente),
      }));

      const result: ApiResponseCommon = {
        data: data,
      };

      return result;
    } catch (error) {
      console.log(error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtener regiones por cliente',
        error: error.message,
      });
    }
  }

  //Obtener listado
  async findAllList(cliente: number, idUser: number, rol: number) {
    try {
      let regiones;
      switch (rol) {
        case 1:
          // Usuario SuperAdministrador - obtiene todas las regiones
          regiones = await this.regionesRepository.query(
            `
SELECT
  -- Región
  r.Id AS id,
  r.Nombre AS nombre,
  r.Descripcion AS descripcion,
  r.Geocerca AS geocerca,
  r.FechaCreacion AS fechaCreacion,
  r.FechaActualizacion AS fechaActualizacion,
  r.Estatus AS estatus,

  -- Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM Regiones r
INNER JOIN Clientes c ON r.IdCliente = c.Id

WHERE 
  r.Estatus = 1
  AND c.Estatus = 1
  

ORDER BY r.Id DESC;

            `,
          );
          break;

        case 2:
          // Usuario administrador - obtiene todas las regiones de su cliente
          regiones = await this.consultarRegionesListado(cliente);
          break;
        case 3:
          // Usuario Operador - obtiene todas las regiones de su cliente
          regiones = await this.consultarRegionesListado(cliente);
          break;
        case 8:
          // Usuario Reportes - obtiene todas las regiones de su cliente
          regiones = await this.consultarRegionesListado(cliente);
          break;

        case 10:
          // Usuario Capturistas - obtiene todas las regiones de su cliente
          regiones = await this.consultarRegionesListado(cliente);
          break;

        default:
          // Usuarios normales - solo sus regiones asignadas
          regiones = await this.regionesRepository.query(
            `
SELECT
  -- Región
  r.Id AS id,
  r.Nombre AS nombre,
  r.Descripcion AS descripcion,
  r.Geocerca AS geocerca,
  r.FechaCreacion AS fechaCreacion,
  r.FechaActualizacion AS fechaActualizacion,
  r.Estatus AS estatus,

  -- Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM Regiones r
INNER JOIN Clientes c ON r.IdCliente = c.Id
INNER JOIN UsuariosRegiones ur ON ur.IdRegion = r.Id
INNER JOIN Usuarios u ON ur.IdUsuario = u.Id

WHERE 
  ur.IdUsuario = ?       -- 🔹 ID del usuario a filtrar
  AND ur.Estatus = 1
  AND r.Estatus = 1
  AND c.Estatus = 1

ORDER BY r.Id DESC;

            `,
            [idUser],
          );
          break;
      }

      // 🔥 Forzamos ids a number y agregamos nombreCompleto
      const data = regiones.map((item) => ({
        ...item,
        id: Number(item.id),
        idCliente: Number(item.idCliente),
      }));

      const result: ApiResponseCommon = {
        data: data,
      };

      return result;
    } catch (error) {
      console.log(error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtener listado Regiones',
        error: error.message,
      });
    }
  }

  private async consultarRegionesOne(cliente: number, id: number) {
    const { ids, placeholders } = await this.clienteHijos(cliente);
    const query = `
SELECT
  -- Región
  r.Id AS id,
  r.Nombre AS nombre,
  r.Descripcion AS descripcion,
  r.Geocerca AS geocerca,
  r.FechaCreacion AS fechaCreacion,
  r.FechaActualizacion AS fechaActualizacion,
  r.Estatus AS estatus,

  -- Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM Regiones r
INNER JOIN Clientes c ON r.IdCliente = c.Id

WHERE 
  r.IdCliente IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar
  AND r.Id = ?

ORDER BY r.Id DESC
    `;
    return this.regionesRepository.query(query, [...ids, id]);
  }


  async findOne(idUser: number, id: number, cliente: number, rol: number) {
    try {
      let regiones;
      //Obtenemos ConteoPasajeros

      switch (rol) {
        case 1:
          // Usuario SuperAdministrador - obtiene todas las regiones
          regiones = await this.regionesRepository.query(
            `
SELECT
  -- Región
  r.Id AS id,
  r.Nombre AS nombre,
  r.Descripcion AS descripcion,
  r.Geocerca AS geocerca,
  r.FechaCreacion AS fechaCreacion,
  r.FechaActualizacion AS fechaActualizacion,
  r.Estatus AS estatus,

  -- Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM Regiones r
INNER JOIN Clientes c ON r.IdCliente = c.Id

WHERE 
  r.Id = ?
  

ORDER BY r.Id DESC;

            `,
            [id],
          );
          break;

        case 2:
          // Usuario administrador - obtiene todas las regiones de su cliente
          regiones = await this.consultarRegionesOne(cliente, id)
          break;
        case 3:
          // Usuario operador - obtiene todas las regiones de su cliente
          regiones = await this.consultarRegionesOne(cliente, id)
          break;
        case 8:
          // Usuario Reportes - obtiene todas las regiones de su cliente
          regiones = await this.consultarRegionesOne(cliente, id)
          break;

        case 10:
          // Usuario Capturistas - obtiene todas las regiones de su cliente
          regiones = await this.consultarRegionesOne(cliente, id)
          break;

        default:
          // Usuarios normales - solo sus regiones asignadas
          regiones = await this.regionesRepository.query(
            `
SELECT
  -- Región
  r.Id AS id,
  r.Nombre AS nombre,
  r.Descripcion AS descripcion,
  r.Geocerca AS geocerca,
  r.FechaCreacion AS fechaCreacion,
  r.FechaActualizacion AS fechaActualizacion,
  r.Estatus AS estatus,

  -- Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM Regiones r
INNER JOIN Clientes c ON r.IdCliente = c.Id
INNER JOIN UsuariosRegiones ur ON ur.IdRegion = r.Id
INNER JOIN Usuarios u ON ur.IdUsuario = u.Id

WHERE 
  ur.IdUsuario = ?       -- 🔹 ID del usuario a filtrar
  AND ur.Estatus = 1
  AND r.Id = ?

ORDER BY r.Id DESC;

            `,
            [idUser, id],
          );
          break;
      }

      if (regiones.length === 0) {
        throw new NotFoundException('region no encontrado');
      }

      // 🔥 Forzamos ids a number y agregamos nombreCompleto
      const data = regiones.map((item) => ({
        ...item,
        id: Number(item.id),
        idCliente: Number(item.idCliente),
      }));

      const result: ApiResponseCommon = {
        data: data,
      };

      return result;
    } catch (error) {
      console.log(error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtener una region',
        error: error.message,
      });
    }
  }

  async updateEstatus(
    id: number,
    idUser: number,
    cliente: number,
    rol: number,
    updateRegionesEstatusDto: UpdateRegionesEstatusDto,
  ) {
    try {
      let regiones;
      switch (rol) {
        case 1:
          // Usuario SuperAdministrador - obtiene todas las regiones
          regiones = await this.regionesRepository.findOne({
            where: { id: id },
          });
          break;

        case 2:
          // Usuario administrador - obtiene todas las regiones
          regiones = await this.regionesRepository.findOne({
            where: { id: id, idCliente: cliente },
          });
          break;

        default:
          // Usuarios normales - solo sus regiones asignadas
          regiones = await this.regionesRepository.findOne({
            where: { id: id },
          });
          break;
      }
      if (!regiones) {
        throw new NotFoundException('Region no encontrado');
      }

      const estatus = updateRegionesEstatusDto.estatus;

      await this.regionesRepository.update(id, { estatus: estatus });

      // Registro en la bitácora SUCESS
      const querylogger = { updateRegionesEstatusDto };
      await this.bitacoraLogger.logToBitacora(
        'Regiones',
        `Se actualizo estatus a ${estatus} una Region con nombre: ${regiones.nombre}  y Id ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        16,
        EstatusEnumBitcora.SUCCESS,
      );

      // API response (con mensajes corregidos)
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Estatus de region actualizado correctamente', // ✅ Corregido
        data: {
          id: id,
          nombre: `Region ${id} Nombre: ${regiones.nombre} Descripción:${regiones.descripcion}`, // ✅ Mejorado
        },
      };
      return result;
    } catch (error) {
      console.log(error);
      // Registro en la bitácora ERROR
      const querylogger = { updateRegionesEstatusDto };
      await this.bitacoraLogger.logToBitacora(
        'Regiones',
        `Se actualizo estatus a ${updateRegionesEstatusDto.estatus} en Region con ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        16,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al actualizar estatus de una region',
        error: error.message,
      });
    }
  }

  async update(
    id: number,
    cliente: number,
    idUser: number,
    rol: number,
    updateRegioneDto: UpdateRegioneDto,
  ): Promise<ApiCrudResponse> {
    try {
      let regiones;

      switch (rol) {
        case 1:
          // Usuario SuperAdministrador - obtiene todas las regiones
          regiones = await this.regionesRepository.findOne({
            where: { id: id },
          });
          break;

        case 2:
          // Usuario Administrador - obtiene todas las regiones
          regiones = await this.regionesRepository.findOne({
            where: { id: id, idCliente: cliente },
          });
          break;

        default:
          // Usuarios normales - solo sus regiones asignadas
          regiones = await this.regionesRepository.findOne({
            where: { id: id, idCliente: cliente },
          });
          break;
      }
      if (!regiones) {
        throw new NotFoundException('Region no encontrado');
      }

      //actualizamos datos
      await this.regionesRepository.update(id, updateRegioneDto);

      // Registro en la bitácora SUCCESS
      const querylogger = { updateRegioneDto };
      await this.bitacoraLogger.logToBitacora(
        'Regiones',
        `Se actualizo una Region con nombre: ${updateRegioneDto.nombre} y Id ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        16,
        EstatusEnumBitcora.SUCCESS,
      );

      // API response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Region actualizada correctamente', // ✅ Corregido
        data: {
          id: id,
          nombre: `Region ${id} Nombre: ${updateRegioneDto.nombre} Descripción: ${updateRegioneDto.descripcion}`, // ✅ Mejorado
        },
      };
      return result;
    } catch (error) {
      console.log(error);
      // Registro en la bitácora ERROR
      const querylogger = { updateRegioneDto };
      await this.bitacoraLogger.logToBitacora(
        'Regiones',
        `Se actualizo una Region con nombre: ${updateRegioneDto.nombre}  y Id ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        16,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al actualizar una region',
        error: error.message,
      });
    }
  }

  async remove(id: number, cliente: number, idUser: number, rol: number) {
    try {
      let regiones;
      switch (rol) {
        case 1:
          // Usuario SuperAdministrador - obtiene todas las regiones
          regiones = await this.regionesRepository.findOne({
            where: { id: id },
          });
          break;

        case 2:
          // Usuario administrador - obtiene todas las regiones
          regiones = await this.regionesRepository.findOne({
            where: { id: id, idCliente: cliente },
          });
          break;

        default:
          // Usuarios normales - solo sus regiones asignadas
          regiones = await this.regionesRepository.findOne({
            where: { id: id, idCliente: cliente },
          });
          break;
      }
      if (!regiones) {
        throw new NotFoundException('Region no encontrado');
      }

      await this.regionesRepository.update(id, { estatus: 0 });

      // Registro en la bitácora SUCCESS
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Regiones',
        `Se elimino una Region con nombre: ${regiones.nombre} y Id ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        16,
        EstatusEnumBitcora.SUCCESS,
      );

      // API response (con mensajes corregidos)
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Region eliminada correctamente', // ✅ Corregido
        data: {
          id: id,
          nombre: `Region ${id} Nombre: ${regiones.nombre} Descripción:${regiones.descripcion}`, // ✅ Mejorado
        },
      };
      return result;
    } catch (error) {
      console.log(error);
      // Registro en la bitácora ERROR
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Regiones',
        `Se elimino una Region con ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        16,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al eliminar una region',
        error: error.message,
      });
    }
  }
}
