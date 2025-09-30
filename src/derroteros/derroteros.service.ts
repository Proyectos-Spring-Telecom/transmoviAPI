import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateDerroteroDto } from './dto/create-derrotero.dto';
import { UpdateDerroteroDto } from './dto/update-derrotero.dto';
import { generarRecorridoDetallado } from '../utils/recorrido.utils';
import {
  ApiDerroteroResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
  Punto,
  ResultadoRecorrido,
} from '../common/ApiResponse';
import { InjectRepository } from '@nestjs/typeorm';
import { Rutas } from 'src/entities/Rutas';
import { Repository } from 'typeorm';
import { Derroteros } from 'src/entities/Derroteros';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { UsuariosRegiones } from 'src/entities/UsuariosRegiones';
import { UpdateDerroterosEstatusDto } from './dto/update-derrotero-estatus.dto';

@Injectable()
export class DerroterosService {
  constructor(
    @InjectRepository(Rutas)
    private readonly rutasRepository: Repository<Rutas>,
    @InjectRepository(UsuariosRegiones)
    private readonly usuariosregionesRepository: Repository<UsuariosRegiones>,
    @InjectRepository(Derroteros)
    private readonly derroterosRepository: Repository<Derroteros>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  async create(
    idUser: number,
    cliente: number,
    rol: number,
    createDerroteroDto: CreateDerroteroDto,
  ) {
    try {
      switch (rol) {
        case 1:
          // Usuario SuperAdministrador
          break;

        case 2:
          // Usuario Administrador
          break;

        default:
          // Usuarios normales - solo sus instalaciones asignadas
          const region = await this.rutasRepository.findOne({
            where: { id: createDerroteroDto.idRuta },
            select: {
              idRegion: true,
            },
          });
          const idRegion = region?.idRegion;
          const permiso = await this.usuariosregionesRepository.findOne({
            where: { idUsuario: idUser, idRegion: idRegion },
          });

          if (!permiso) throw new BadRequestException(`Acceso denegado`);

          break;
      }
      const { recorridoDetallado: puntos } = createDerroteroDto;
      const newDerrotero =
        await this.derroterosRepository.create(createDerroteroDto);

      // Aplicamos interpolación
      const { recorridoDetallado, distanciaKm } =
        await generarRecorridoDetallado(puntos as any);

      newDerrotero.recorridoDetallado = recorridoDetallado;
      newDerrotero.distanciaKm = distanciaKm;

      const derroteroSave = await this.derroterosRepository.save(newDerrotero);

      // Registro en la bitácora SUCCESS
      await this.bitacoraLogger.logToBitacora(
        'Derroteros',
        `Se creó un derrotero con nombre: ${derroteroSave.nombre}`,
        'CREATE',
        `${createDerroteroDto}`,
        idUser,
        18,
        EstatusEnumBitcora.SUCCESS,
      );

      //API response
      const result: ApiDerroteroResponse = {
        status: 'succes',
        message: 'Se creo correctamente derrotero',
        id: Number(derroteroSave.id),
        nombre: derroteroSave.nombre,
        distancia: Number(derroteroSave.distanciaKm),
        estatus: derroteroSave.estatus,
      };

      return result;
    } catch (error) {
      // Registro en la bitácora ERROR
      await this.bitacoraLogger.logToBitacora(
        'Derroteros',
        `Se creó un derrotero con nombre: ${createDerroteroDto.nombre}`,
        'CREATE',
        `${createDerroteroDto}`,
        idUser,
        18,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al crear derrotero',
        error: error.message,
      });
    }
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
      let data;
      let totalResult;
      // Consulta de datos paginados Usuario SuperAdministrador
      data = await this.derroterosRepository.query(
        `
  SELECT 
    -- Datos del derrotero (datos principales)
    d.Id AS id,
    d.Nombre AS nombreDerrotero,
    d.DistanciaKm AS distanciaKm,
    d.FechaCreacion AS fechaCreacionDerrotero,
    d.Estatus AS estatusDerrotero,

    -- Datos de la ruta asociada
    ru.Id AS idRuta,
    ru.Nombre AS nombreRuta,
    ru.NombreInicio AS nombreInicio,
    ru.NombreFin AS nombreFin,
    ru.FechaCreacion AS fechaCreacionRuta,
    ru.Estatus AS estatusRuta,

    -- Región de inicio
    r.Id AS idRegionInicio,
    r.Nombre AS nombreRegionInicio,
    r.Descripcion AS descripcionRegionInicio,
    r.FechaCreacion AS fechaCreacionRegionInicio,
    r.FechaActualizacion AS fechaActualizacionRegionInicio,
    r.Estatus AS estatusRegionInicio,

    -- Región de fin
    rf.Id AS idRegionFin,
    rf.Nombre AS nombreRegionFin,
    rf.Descripcion AS descripcionRegionFin,
    rf.FechaCreacion AS fechaCreacionRegionFin,
    rf.FechaActualizacion AS fechaActualizacionRegionFin,
    rf.Estatus AS estatusRegionFin,

    -- Cliente relacionado
    c.Id AS idCliente,
    CONCAT(c.Nombre, ' ', c.ApellidoPaterno, ' ', c.ApellidoMaterno) AS nombreCompletoCliente

  FROM Derroteros d
  INNER JOIN Rutas ru ON d.IdRuta = ru.Id
  INNER JOIN Regiones r ON ru.IdRegion = r.Id
  LEFT JOIN Regiones rf ON ru.IdRegionFin = rf.Id
  INNER JOIN Clientes c ON r.IdCliente = c.Id
  INNER JOIN UsuariosRegiones ur ON ur.IdRegion = r.Id

  WHERE ur.IdUsuario = ?
    AND ur.Estatus = 1
    AND r.Estatus = 1
    AND ru.Estatus = 1
    AND d.Estatus = 1
    AND c.Id = ? -- Discriminacion de clientes

  ORDER BY d.Id DESC
  LIMIT ? OFFSET ?
  `,
        [idUser, cliente, limit, offset],
      );

      // Query para total (sin paginación)
      totalResult = await this.usuariosregionesRepository.query(
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

      const total = Number(totalResult[0]?.total ?? 0);

      // Transformación de resultados
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
      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException({
        message: 'Error al obtener paginado derroteros',
        error: error.message,
      });
    }
  }

  async findAllList(cliente: number, idUser: number) {
    try {
      const data = await this.usuariosregionesRepository.query(
        `
      SELECT 
        d.Id AS idDerrotero, 
        d.Nombre AS nombreDerrotero, 
        d.DistanciaKm AS distanciaKm, 
        d.FechaCreacion AS fechaCreacionDerrotero, 
        d.FechaActualizacion AS fechaActualizacionDerrotero, 
        d.Estatus AS estatusDerrotero, 
        d.IdRuta AS idRuta
      FROM UsuariosRegiones ur
      INNER JOIN Regiones r ON ur.IdRegion = r.Id
      INNER JOIN Rutas ru ON ru.IdRegion = r.Id
      INNER JOIN Derroteros d ON d.IdRuta = ru.Id
      WHERE ur.IdUsuario = ?
        AND ur.Estatus = 1   -- usuario-región activa
        AND r.Estatus = 1    -- región activa
        AND ru.Estatus = 1   -- ruta activa
        AND d.Estatus = 1    -- derrotero activo
      ORDER BY d.FechaCreacion DESC
      `,
        [idUser], // parámetro seguro
      );

      if (data.length === 0) {
        throw new NotFoundException('No se encontraron derroteros activos');
      }

      // Transformación de resultados
      const result: ApiResponseCommon = {
        data: data.map((d) => ({
          idDerrotero: Number(d.idDerrotero),
          nombreDerrotero: d.nombreDerrotero,
          distanciaKm: d.distanciaKm !== null ? Number(d.distanciaKm) : null,
          fechaCreacionDerrotero: d.fechaCreacionDerrotero,
          fechaActualizacionDerrotero: d.fechaActualizacionDerrotero,
          estatusDerrotero: Number(d.estatusDerrotero),
          idRuta: Number(d.idRuta),
        })),
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException({
        message: 'Error al obtener listado derroteros',
        error: error.message,
      });
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} derrotero`;
  }

  async updateEstatus(
    id: number,
    idUser: number,
    cliente: number,
    rol: number,
    updateDerroterosEstatusDto: UpdateDerroterosEstatusDto,
  ) {
    try {
      let derrotero;
      switch (rol) {
        case 1:
          // Usuario SuperAdministrador
          derrotero = await this.derroterosRepository.findOne({
            where: { id: id },
          });
          if (!derrotero)
            throw new NotFoundException('Derrotero no encontrado');
          break;

        case 2:
          // Usuario Administrador
          derrotero = await this.derroterosRepository.findOne({
            relations: ['idRuta2', 'idRegion2'],
            where: {
              id: id,
              idRuta2: {
                idRegion2: {
                  idCliente: cliente,
                },
              },
            },
          });
          if (!derrotero)
            throw new NotFoundException('Derrotero no encontrado');
          break;

        default:
          derrotero = await this.derroterosRepository.findOne({
            where: { id: id },
            select: {
              idRuta: true,
              nombre: true,
              distanciaKm: true,
              estatus: true,
            },
          });
          const idRuta = derrotero?.idRuta;
          const region = await this.rutasRepository.findOne({
            where: { id: idRuta },
            select: {
              idRegion: true,
            },
          });
          const idRegion = region?.idRegion;
          const permiso = await this.usuariosregionesRepository.findOne({
            where: { idUsuario: idUser, idRegion: idRegion },
          });

          if (!permiso) throw new BadRequestException(`Acceso denegado`);
          break;
      }

      //actualizacion de estatus
      const estatus = updateDerroterosEstatusDto.estatus;
      await this.derroterosRepository.update(id, { estatus: estatus });

      // Registro en la bitácora SUCCESS
      await this.bitacoraLogger.logToBitacora(
        'Derroteros',
        `Se actualizo estatus a ${updateDerroterosEstatusDto.estatus} de un derrotero con nombre: ${derrotero.nombre}`,
        'UPDATE',
        `UPDATE FROM Rutas SET Estatus = ${updateDerroterosEstatusDto.estatus} WHERE Id= ${id}`,
        idUser,
        18,
        EstatusEnumBitcora.SUCCESS,
      );

      //API response
      const result: ApiDerroteroResponse = {
        status: 'succes',
        message: 'Se actualiz correctamente estatus del derrotero',
        id: Number(derrotero.id),
        nombre: derrotero.nombre,
        distancia: Number(derrotero.distanciaKm),
        estatus: estatus,
      };

      return result;
    } catch (error) {
      // Registro en la bitácora ERROR
      await this.bitacoraLogger.logToBitacora(
        'Derroteros',
        `Se actualizo estatus a ${updateDerroterosEstatusDto.estatus} de un derrotero con ID: ${id}`,
        'UPDATE',
        `UPDATE FROM Rutas SET Estatus = ${updateDerroterosEstatusDto.estatus} WHERE Id= ${id}`,
        idUser,
        18,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException({
        message: 'Error al actualizar estatus derroteros',
        error: error.message,
      });
    }
  }

  async update(
    id: number,
    idUser: number,
    cliente: number,
    rol: number,
    updateDerroteroDto: UpdateDerroteroDto,
  ) {
    try {
      switch (rol) {
        case 1:
          // Usuario SuperAdministrador
          break;

        case 2:
          // Usuario Administrador
          break;

        default:
          // Usuarios normales - solo sus instalaciones asignadas
          const region = await this.rutasRepository.findOne({
            where: { id: updateDerroteroDto.idRuta },
            select: {
              idRegion: true,
            },
          });
          const idRegion = region?.idRegion;
          const permiso = await this.usuariosregionesRepository.findOne({
            where: { idUsuario: idUser, idRegion: idRegion },
          });

          if (!permiso) throw new BadRequestException(`Acceso denegado`);

          break;
      }

      let newDerrotero = this.derroterosRepository.create(updateDerroteroDto);

      if (
        Array.isArray(updateDerroteroDto.recorridoDetallado) &&
        updateDerroteroDto.recorridoDetallado.length > 0
      ) {
        const puntos = updateDerroteroDto.recorridoDetallado;

        const { recorridoDetallado: nuevoRecorrido, distanciaKm } =
          await generarRecorridoDetallado(puntos as any);

        newDerrotero.recorridoDetallado = nuevoRecorrido;
        newDerrotero.distanciaKm = distanciaKm;
      }

      const derroteroSave = await this.derroterosRepository.save(newDerrotero);

      // Registro en la bitácora SUCCESS
      await this.bitacoraLogger.logToBitacora(
        'Derroteros',
        `Se actualizo un derrotero con nombre: ${derroteroSave.nombre}`,
        'UPDATE',
        `${updateDerroteroDto}`,
        idUser,
        18,
        EstatusEnumBitcora.SUCCESS,
      );

      //API response
      const result: ApiDerroteroResponse = {
        status: 'succes',
        message: 'Se creo correctamente derrotero',
        id: Number(derroteroSave.id),
        nombre: derroteroSave.nombre,
        distancia: Number(derroteroSave.distanciaKm),
        estatus: derroteroSave.estatus,
      };

      return result;
    } catch (error) {
      // Registro en la bitácora ERROR
      await this.bitacoraLogger.logToBitacora(
        'Derroteros',
        `Se actualizo un derrotero con ID: ${id}`,
        'UPDATE',
        `${updateDerroteroDto}`,
        idUser,
        18,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al crear derrotero',
        error: error.message,
      });
    }
  }

  async remove(id: number, idUser: number, cliente: number, rol: number) {
    try {
      let derrotero;
      switch (rol) {
        case 1:
          // Usuario SuperAdministrador
          derrotero = await this.derroterosRepository.findOne({
            where: { id: id },
          });
          if (!derrotero)
            throw new NotFoundException('Derrotero no encontrado');
          break;

        case 2:
          // Usuario Administrador
          derrotero = await this.derroterosRepository.findOne({
            relations: ['idRuta2', 'idRegion2'],
            where: {
              id: id,
              idRuta2: {
                idRegion2: {
                  idCliente: cliente,
                },
              },
            },
          });
          if (!derrotero)
            throw new NotFoundException('Derrotero no encontrado');
          break;

        default:
          derrotero = await this.derroterosRepository.findOne({
            where: { id: id },
            select: {
              idRuta: true,
              nombre: true,
              distanciaKm: true,
              estatus: true,
            },
          });
          const idRuta = derrotero?.idRuta;
          const region = await this.rutasRepository.findOne({
            where: { id: idRuta },
            select: {
              idRegion: true,
            },
          });
          const idRegion = region?.idRegion;
          const permiso = await this.usuariosregionesRepository.findOne({
            where: { idUsuario: idUser, idRegion: idRegion },
          });

          if (!permiso) throw new BadRequestException(`Acceso denegado`);
          break;
      }

      //eliminado logico
      await this.derroterosRepository.update(id, { estatus: 0 });

      // Registro en la bitácora SUCCESS
      await this.bitacoraLogger.logToBitacora(
        'Derroteros',
        `Se elimino estatus a ${0} de un derrotero con nombre: ${derrotero.nombre}`,
        'UPDATE',
        `UPDATE FROM Rutas SET Estatus = ${0} WHERE Id= ${id}`,
        idUser,
        18,
        EstatusEnumBitcora.SUCCESS,
      );

      //API response
      const result: ApiDerroteroResponse = {
        status: 'succes',
        message: 'Se actualiz correctamente estatus del derrotero',
        id: Number(derrotero.id),
        nombre: derrotero.nombre,
        distancia: Number(derrotero.distanciaKm),
        estatus: 0,
      };

      return result;
    } catch (error) {
      // Registro en la bitácora SUCCESS
      await this.bitacoraLogger.logToBitacora(
        'Derroteros',
        `Se elimino estatus a ${0} de un derrotero con ID: ${id}`,
        'UPDATE',
        `UPDATE FROM Rutas SET Estatus = ${0} WHERE Id= ${id}`,
        idUser,
        18,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException({
        message: 'Error al actualizar estatus derroteros',
        error: error.message,
      });
    }
  }
}
