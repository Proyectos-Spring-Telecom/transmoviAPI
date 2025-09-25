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
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
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
    createRutaDto: CreateRutaDto,
  ): Promise<ApiCrudResponse> {
    try {
      const idRegionRuta = createRutaDto.idRegion;
      switch (idUser) {
        case 1:
          // Usuario administrador - obtiene todas las regiones
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

      // Registro en la bitácora (con mensaje corregido)
      await this.bitacoraLogger.logToBitacora(
        'Rutas',
        `Se creó una Region con nombre: ${rutaSave.id}`,
        'CREATE',
        `INSERT INTO Rutas (...) VALUES (...) -> id: ${rutaSave.id}, Nombre: ${rutaSave.nombre}, Estatus: ${rutaSave.estatus}, IdRegion: ${rutaSave.idRegion}`,
        idUser,
        17,
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
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al crear ruta',
        error: error.message,
      });
    }
  }

  async findAllList( idUser: number, cliente: number ) {
    try {
      let rutas;
      switch (idUser) {
        case 1:
          // Usuario administrador - obtiene todas las regiones
          rutas = await this.rutasRepository.find({
            relations: ['idRegion2'],
            where: {
              estatus: 1,
            },
          });
          break;

        default:
          // Usuarios normales - solo sus regiones asignadas
          rutas = await this.rutasRepository.find({
            relations: ['idRegion2'],
            where: {
              estatus: 1,
              idRegion2: {
                idCliente: cliente,
                estatus: 1,
              },
            },
          });
          break;
      }

      if (rutas.length === 0) {
        throw new NotFoundException('Rutas no encontrado');
      }

      // Limpieza y conversión de tipos
    const data = rutas.map((item) => {
      const region = item.idRegion2;

      return {
        ...item,
        id: Number(item.id),
        idRegion: Number(item.idRegion),
        idRegion2: region
          ? {
              ...region,
              id: Number(region.id),
              idCliente: Number(region.idCliente),
            }
          : null,
      };
    });

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
        message: 'Error al obtener listado de rutas',
        error: error.message,
      });
    }
  }

  async findAll(
    cliente: number,
    idUser: number,
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    try {
      let [data, total]: any[] = [];
      switch (idUser) {
        case 1:
          // Usuario administrador - obtiene todas las regiones
          [data, total] = await this.rutasRepository.findAndCount({
            skip: (page - 1) * limit,
            take: limit,
            relations: ['idRegion2'],
          });
          break;

        default:
          // Usuarios normales - solo sus regiones asignadas
          [data, total] = await this.rutasRepository.findAndCount({
            skip: (page - 1) * limit,
            take: limit,
            relations: ['idRegion2'],
            where: {
              idRegion2: {
                idCliente: cliente,
                estatus: 1,
              },
            },
          });
          break;
      }

      if (data.length === 0) {
        throw new NotFoundException('Rutas no encontrado');
      }
      
       // Conversión de IDs
    const rutas = data.map((item) => {
      const region = item.idRegion2;

      return {
        ...item,
        id: Number(item.id),
        idRegion: Number(item.idRegion),
        idRegion2: region
          ? {
              ...region,
              id: Number(region.id),
              idCliente: Number(region.idCliente),
            }
          : null,
      };
    });

      //APi response
      const result: ApiResponseCommon = {
        data: rutas,
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
        message: 'Error al obtener paginado de rutas',
        error: error.message,
      });
    }
  }

  async findOne(id: number, idUser: number, cliente: number) {
    try {
      let ruta;
      switch (idUser) {
        case 1:
          // Usuario administrador - obtiene todas las regiones
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

  async updateEstatus(id: number, idUser: number, cliente: number, updateRutasEstatusDto: UpdateRutasEstatusDto) {
    try {
      const ruta = await this.rutasRepository.findOne({where : { id: id }})
      if (!ruta) throw new NotFoundException('Ruta no encontrada')
      switch (idUser) {
        case 1:
          // Usuario administrador - obtiene todas las regiones
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
      const estatus = updateRutasEstatusDto.estatus
      await this.rutasRepository.update(id,{ estatus: estatus });

      // Registro en la bitácora (con mensaje corregido)
      await this.bitacoraLogger.logToBitacora(
        'Rutas',
        `Se creó una Region con nombre: ${ruta.id}`,
        'UPDATE',
        `UPDATE FROM Rutas SET Estatus = ${estatus} WHERE Id= ${id}`,
        idUser,
        17,
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
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al actualizar una ruta',
        error: error.message,
      });
    }
  }

  async update(id: number, idUser: number, cliente: number, updateRutaDto: UpdateRutaDto) {
    try {
      const ruta = await this.rutasRepository.findOne({where : { id: id }})
      if (!ruta) throw new NotFoundException('Ruta no encontrada')
      switch (idUser) {
        case 1:
          // Usuario administrador - obtiene todas las regiones
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

      await this.rutasRepository.update(id,updateRutaDto);

      // Registro en la bitácora (con mensaje corregido)
      await this.bitacoraLogger.logToBitacora(
        'Rutas',
        `Se creó una Region con nombre: ${ruta.id}`,
        'UPDATE',
        `UPDATE INTO Rutas (...) VALUES (...) -> id: ${ruta.id}, Nombre: ${updateRutaDto.nombre}, Estatus: ${updateRutaDto.estatus}, IdRegion: ${updateRutaDto.idRegion}`,
        idUser,
        17,
      );
      

      // API response (con mensajes corregidos)
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Ruta actualizada correctamente', // ✅ Corregido
        data: {
          id: id,
          nombre: `Ruta ${id} `, // ✅ Mejorado
        },
      };
      return result;
    } catch (error) {
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
      const ruta = await this.rutasRepository.findOne({where : { id: id }})
      if (!ruta) throw new NotFoundException('Ruta no encontrada')
      switch (idUser) {
        case 1:
          // Usuario administrador - obtiene todas las regiones
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

      await this.rutasRepository.update(id,{ estatus: 0 });

      // Registro en la bitácora (con mensaje corregido)
      await this.bitacoraLogger.logToBitacora(
        'Rutas',
        `Se creó una Region con nombre: ${ruta.id}`,
        'DELETE',
        `DELETE FROM Rutas WHERE Id= ${id}`,
        idUser,
        17,
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
