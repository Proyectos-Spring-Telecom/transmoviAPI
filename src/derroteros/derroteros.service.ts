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
    cliente: number, // por ahora no lo usas, pero queda disponible
    idUser: number,
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    try {
      const offset = (page - 1) * limit; // cálculo del desplazamiento

      // Query principal: obtiene los derroteros relacionados al usuario
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
        AND ur.Estatus = 1
        AND r.Estatus = 1
        AND ru.Estatus = 1
        AND d.Estatus = 1
      ORDER BY d.FechaCreacion DESC
      LIMIT ? OFFSET ?
      `,
        [idUser, limit, offset], // parámetros seguros
      );

      // Query para el total de registros (sin paginación)
      const totalResult = await this.usuariosregionesRepository.query(
        `
      SELECT COUNT(*) AS total
      FROM UsuariosRegiones ur
      INNER JOIN Regiones r ON ur.IdRegion = r.Id
      INNER JOIN Rutas ru ON ru.IdRegion = r.Id
      INNER JOIN Derroteros d ON d.IdRuta = ru.Id
      WHERE ur.IdUsuario = ?
        AND ur.Estatus = 1
        AND r.Estatus = 1
        AND ru.Estatus = 1
        AND d.Estatus = 1
      `,
        [idUser],
      );

      const total = Number(totalResult[0]?.total ?? 0);

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
      switch (rol) {
        case 1:
          // Usuario SuperAdministrador
          break;

        case 2:
          // Usuario Administrador
         

          break;
      }
    } catch (error) {}
  }

  update(id: number, updateDerroteroDto: UpdateDerroteroDto) {
    return `This action updates a #${id} derrotero`;
  }

  remove(id: number) {
    return `This action removes a #${id} derrotero`;
  }
}
