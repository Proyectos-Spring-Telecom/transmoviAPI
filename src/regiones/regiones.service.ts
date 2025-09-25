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
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { UsuariosRegiones } from 'src/entities/UsuariosRegiones';
import { UpdateRegionesEstatusDto } from './dto/update-regione-estatus.dto';

@Injectable()
export class RegionesService {
  constructor(
    @InjectRepository(Regiones)
    private readonly regionesRepository: Repository<Regiones>,
    @InjectRepository(UsuariosRegiones)
    private readonly usuarioregionesRepository: Repository<UsuariosRegiones>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  async create(
    idUser: string,
    createRegionesDto: CreateRegionesDto,
  ): Promise<ApiCrudResponse> {
    try {
      const nombre = createRegionesDto.nombre.toUpperCase();
      const region = await this.regionesRepository.find({
        where: { nombre: nombre },
      });
      if ((region.length = 0)) {
        throw new BadRequestException(
          `Region con nombre: ${nombre} ha sido registrada`,
        );
      }

      createRegionesDto.nombre = nombre;

      const newRegion = await this.regionesRepository.create(createRegionesDto);
      const regionSave = await this.regionesRepository.save(createRegionesDto);

      //Asignamos a root la region
      const rootPermisos = {
        idUsuario: 1, //Se asigna al usuario supremo
        idRegion: regionSave.id,
      };

      await this.usuarioregionesRepository.save(rootPermisos);

      // Registro en la bitácora (con mensaje corregido)
      await this.bitacoraLogger.logToBitacora(
        'Regiones',
        `Se creó una Region con nombre: ${regionSave.nombre}`,
        'CREATE',
        `INSERT INTO Regiones (...) VALUES (...) -> id: ${regionSave.id}, Nombre: ${regionSave.nombre}, Descripcion: ${regionSave.descripcion}, Estatus: ${regionSave.estatus}, IdCliente: ${regionSave.idCliente}`,
        Number(idUser),
        16,
      );

      // API response (con mensajes corregidos)
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Region creada correctamente', // ✅ Corregido
        data: {
          id: Number(regionSave.id),
          nombre: `Region ${regionSave.id} Nombre: ${regionSave.nombre} Descripción:${regionSave.descripcion}`, // ✅ Mejorado
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException({
        message: 'Error al crear Region',
        error: error.message,
      });
    }
  }

  async findAll(cliente: number, idUser: number, page: number, limit: number) {
    try {
      let [data, total]: any[] = [];
      //Obtenemos ConteoPasajeros
      switch (idUser) {
        case 1:
          // Usuario administrador - obtiene todas las regiones
          [data, total] = await this.usuarioregionesRepository.findAndCount({
            skip: (page - 1) * limit,
            take: limit,
            relations: ['idRegion2', 'idRegion2.idCliente2'],
            where: {
              idUsuario: idUser,
              estatus: 1,
            },
            select: {
              id: true,
              idUsuario: true,
              idRegion: true,
              idRegion2: {
                id: true,
                nombre: true,
                descripcion: true,
                fechaCreacion: true,
                fechaActualizacion: true,
                estatus: true,
                idCliente: true,
                idCliente2: {
                  id: true,
                  nombre: true,
                  apellidoPaterno: true,
                  apellidoMaterno: true,
                },
              },
            },
          });
          break;

        default:
          // Usuarios normales - solo sus regiones asignadas
          [data, total] = await this.usuarioregionesRepository.findAndCount({
            skip: (page - 1) * limit,
            take: limit,
            relations: ['idRegion2', 'idRegion2.idCliente2'],
            where: {
              idUsuario: idUser,
              estatus: 1,
              idRegion2: {
                idCliente: cliente,
              },
            },
            select: {
              id: true,
              idUsuario: true,
              idRegion: true,
              idRegion2: {
                id: true,
                nombre: true,
                descripcion: true,
                fechaCreacion: true,
                fechaActualizacion: true,
                estatus: true,
                idCliente: true,
                idCliente2: {
                  id: true,
                  nombre: true,
                  apellidoPaterno: true,
                  apellidoMaterno: true,
                },
              },
            },
          });
          break;
      }
      if (data.length === 0) {
        throw new NotFoundException('Region no encontrado');
      }

      // 🔥 Normalizamos ids y agregamos nombreCompleto
      const regiones = data.map((item) => ({
        ...item,
        id: Number(item.id),
        idUsuario: Number(item.idUsuario),
        idRegion: Number(item.idRegion),
        idRegion2: item.idRegion2
          ? {
              ...item.idRegion2,
              id: Number(item.idRegion2.id),
              idCliente: Number(item.idRegion2.idCliente),
              idCliente2: item.idRegion2.idCliente2
                ? {
                    ...item.idRegion2.idCliente2,
                    id: Number(item.idRegion2.idCliente2.id),
                    nombreCompleto:
                      `${item.idRegion2.idCliente2.nombre ?? ''} ${
                        item.idRegion2.idCliente2.apellidoPaterno ?? ''
                      } ${item.idRegion2.idCliente2.apellidoMaterno ?? ''}`.trim(),
                  }
                : null,
            }
          : null,
      }));

      //APi response
      const result: ApiResponseCommon = {
        data: regiones,
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
        message: 'Error al obtener paginado Regiones',
        error,
      });
    }
  }

  async findAllList(cliente: number, idUser: number) {
    try {
      let regiones: any[] = [];
      switch (idUser) {
        case 1:
          // Usuario administrador - obtiene todas las regiones
          regiones = await this.usuarioregionesRepository.find({
            relations: ['idRegion2', 'idRegion2.idCliente2'],
            where: { estatus: 1, idUsuario: idUser, idRegion2: { estatus: 1 } },
            select: {
              id: true,
              idUsuario: true,
              idRegion: true,
              idRegion2: {
                id: true,
                nombre: true,
                descripcion: true,
                fechaCreacion: true,
                fechaActualizacion: true,
                estatus: true,
                idCliente: true,
                idCliente2: {
                  id: true,
                  nombre: true,
                  apellidoPaterno: true,
                  apellidoMaterno: true,
                },
              },
            },
          });
          break;

        default:
          // Usuarios normales - solo sus regiones asignadas
          regiones = await this.usuarioregionesRepository.find({
            relations: ['idRegion2', 'idRegion2.idCliente2'],
            where: {
              idUsuario: idUser,
              estatus: 1,
              idRegion2: {
                idCliente: cliente,
                estatus: 1,
              },
            },
            select: {
              id: true,
              idUsuario: true,
              idRegion: true,
              idRegion2: {
                id: true,
                nombre: true,
                descripcion: true,
                fechaCreacion: true,
                fechaActualizacion: true,
                estatus: true,
                idCliente: true,
                idCliente2: {
                  id: true,
                  nombre: true,
                  apellidoPaterno: true,
                  apellidoMaterno: true,
                },
              },
            },
          });
          break;
      }

      if (regiones.length == 0) {
        throw new NotFoundException('Regiones no encontrado');
      }

      // 🔥 Forzamos ids a number y agregamos nombreCompleto
      const data = regiones.map((item) => ({
        ...item,
        id: Number(item.id),
        idUsuario: Number(item.idUsuario),
        idRegion: Number(item.idRegion),
        idRegion2: item.idRegion2
          ? {
              ...item.idRegion2,
              id: Number(item.idRegion2.id),
              idCliente: Number(item.idRegion2.idCliente),
              idCliente2: item.idRegion2.idCliente2
                ? {
                    ...item.idRegion2.idCliente2,
                    id: Number(item.idRegion2.idCliente2.id),
                    nombreCompleto:
                      `${item.idRegion2.idCliente2.nombre ?? ''} ${
                        item.idRegion2.idCliente2.apellidoPaterno ?? ''
                      } ${item.idRegion2.idCliente2.apellidoMaterno ?? ''}`.trim(),
                  }
                : null,
            }
          : null,
      }));

      const result: ApiResponseCommon = {
        data: data,
      };

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtener listado Regiones',
        error,
      });
    }
  }

  async findOne(idUser: number, id: number, cliente: number) {
    try {
      let regiones;
      //Obtenemos ConteoPasajeros
      switch (idUser) {
        case 1:
          // Usuario administrador - obtiene todas las regiones
          regiones = await this.usuarioregionesRepository.findOne({
            relations: ['idRegion2', 'idRegion2.idCliente2'],
            where: { idUsuario: idUser, idRegion: id },
            select: {
              id: true,
              idUsuario: true,
              idRegion: true,
              idRegion2: {
                id: true,
                nombre: true,
                descripcion: true,
                fechaCreacion: true,
                fechaActualizacion: true,
                estatus: true,
                idCliente: true,
                idCliente2: {
                  id: true,
                  nombre: true,
                  apellidoPaterno: true,
                  apellidoMaterno: true,
                },
              },
            },
          });
          break;

        default:
          // Usuarios normales - solo sus regiones asignadas
          const permiso = await this.usuarioregionesRepository.findOne({
            relations: ['idRegion2', 'idRegion2.idCliente2'],
            where: { idUsuario: idUser, idRegion: id, estatus: 1 },
            select: {
              id: true,
              idUsuario: true,
              idRegion: true,
              idRegion2: {
                id: true,
                nombre: true,
                descripcion: true,
                fechaCreacion: true,
                fechaActualizacion: true,
                estatus: true,
                idCliente: true,
                idCliente2: {
                  id: true,
                  nombre: true,
                  apellidoPaterno: true,
                  apellidoMaterno: true,
                },
              },
            },
          });
          if (!permiso) throw new BadRequestException(`Acceso denegado`);

          regiones = await this.regionesRepository.findOne({
            where: { id: id, idCliente: cliente },
          });
          break;
      }
      if (!regiones) {
        throw new NotFoundException('instalaciones no encontrado');
      }

      // 🔥 Transformación: IDs como number + nombreCompleto en cliente
      const data = {
        ...regiones,
        id: Number(regiones.id),
        idUsuario: Number(regiones.idUsuario),
        idRegion: Number(regiones.idRegion),
        idRegion2: regiones.idRegion2
          ? {
              ...regiones.idRegion2,
              id: Number(regiones.idRegion2.id),
              idCliente: Number(regiones.idRegion2.idCliente),
              idCliente2: regiones.idRegion2.idCliente2
                ? {
                    ...regiones.idRegion2.idCliente2,
                    id: Number(regiones.idRegion2.idCliente2.id),
                    nombreCompleto:
                      `${regiones.idRegion2.idCliente2.nombre ?? ''} ${
                        regiones.idRegion2.idCliente2.apellidoPaterno ?? ''
                      } ${regiones.idRegion2.idCliente2.apellidoMaterno ?? ''}`.trim(),
                  }
                : null,
            }
          : null,
      };

      const result: ApiResponseCommon = {
        data: data,
      };

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtener una region',
        error,
      });
    }
  }

  async updateEstatus(
    id: number,
    idUser: number,
    cliente: number,
    updateRegionesEstatusDto: UpdateRegionesEstatusDto,
  ) {
    try {
      let regiones;
      switch (idUser) {
        case 1:
          // Usuario administrador - obtiene todas las regiones
          regiones = await this.regionesRepository.findOne({
            where: { id: id },
          });
          break;

        default:
          // Usuarios normales - solo sus regiones asignadas
          const permiso = await this.usuarioregionesRepository.find({
            where: { idUsuario: idUser, idRegion: id, estatus: 1 },
          });
          if (permiso.length === 0)
            throw new BadRequestException(`Acceso denegado`);
          regiones = await this.regionesRepository.findOne({
            where: { id: id, idCliente: cliente },
          });
          break;
      }
      if (!regiones) {
        throw new NotFoundException('Region no encontrado');
      }

      const estatus = updateRegionesEstatusDto.estatus;

      await this.regionesRepository.update(id, { estatus: estatus });

      // Registro en la bitácora (con mensaje corregido)
      await this.bitacoraLogger.logToBitacora(
        'Regiones',
        `Se actualizo estatus a ${estatus} en Region con nombre: ${regiones.nombre}`,
        'UPDATE',
        `UPDATE FROM Regiones SET Estatus= ${estatus} WHERE Id=${id}`,
        Number(idUser),
        16,
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
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al actualizar estatus de una region',
        error,
      });
    }
  }

  async update(
    id: number,
    cliente: number,
    idUser: number,
    updateRegioneDto: UpdateRegioneDto,
  ): Promise<ApiCrudResponse> {
    try {
      let regiones;

      switch (idUser) {
        case 1:
          // Usuario administrador - obtiene todas las regiones
          regiones = await this.regionesRepository.findOne({
            where: { id: id },
          });
          break;

        default:
          // Usuarios normales - solo sus regiones asignadas
          const permiso = await this.usuarioregionesRepository.find({
            where: { idUsuario: idUser, idRegion: id, estatus: 1 },
          });
          if (permiso.length === 0)
            throw new BadRequestException(`Acceso denegado`);
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

      // Registro en la bitácora (con mensaje corregido)
      await this.bitacoraLogger.logToBitacora(
        'Regiones',
        `Se creó una Region con nombre: ${updateRegioneDto.nombre}`,
        'UPDATE',
        `UPDATE Regiones (...) VALUES (...) -> id: ${id}, Nombre: ${updateRegioneDto.nombre}, Descripcion: ${updateRegioneDto.descripcion}, IdCliente: ${updateRegioneDto.idCliente}`,
        Number(idUser),
        16,
      );

      // API response (con mensajes corregidos)
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
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al actualizar una region',
        error,
      });
    }
  }

  async remove(id: number, cliente: number, idUser: number) {
    try {
      let regiones;
      switch (idUser) {
        case 1:
          // Usuario administrador - obtiene todas las regiones
          regiones = await this.regionesRepository.findOne({
            where: { id: id },
          });
          break;

        default:
          // Usuarios normales - solo sus regiones asignadas
          const permiso = await this.usuarioregionesRepository.find({
            where: { idUsuario: idUser, idRegion: id },
          });
          if (permiso.length === 0)
            throw new BadRequestException(`Acceso denegado`);
          regiones = await this.regionesRepository.find({
            where: { id: id, idCliente: cliente },
          });
          break;
      }
      if (!regiones) {
        throw new NotFoundException('Region no encontrado');
      }

      await this.regionesRepository.update(id, { estatus: 0 });

      // Registro en la bitácora (con mensaje corregido)
      await this.bitacoraLogger.logToBitacora(
        'Regiones',
        `Se elimino una Region con nombre: ${regiones.nombre}`,
        'DELETE',
        `DELETE Regiones (...) VALUES (...) -> id: ${id}, Nombre: ${regiones.nombre}, Descripcion: ${regiones.descripcion}, IdCliente: ${regiones.idCliente}`,
        Number(idUser),
        16,
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
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al eliminar una region',
        error,
      });
    }
  }
}
