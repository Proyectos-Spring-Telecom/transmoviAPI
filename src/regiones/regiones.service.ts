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
    idUser: number,
    cliente: number,
    rol: number,
    createRegionesDto: CreateRegionesDto,
  ): Promise<ApiCrudResponse> {
    try {
      let rootPermisos
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
        `${querylogger}`,
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
      // Registro en la bitácora en caso ERROR
      const querylogger = { createRegionesDto };
      await this.bitacoraLogger.logToBitacora(
        'Regiones',
        `Se creó una Region con nombre: ${createRegionesDto.nombre}`,
        'CREATE',
        `${querylogger}`,
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

  async findAll(
    cliente: number,
    idUser: number,
    rol: number,
    page: number,
    limit: number,
  ) {
    try {
      let [data, total]: any[] = [];
      //Obtenemos ConteoPasajeros
      switch (rol) {
        case 1:
          // Usuario SuperAdministrador - obtiene todas las regiones
          [data, total] = await this.usuarioregionesRepository.findAndCount({
            skip: (page - 1) * limit,
            take: limit,
            relations: ['idRegion2', 'idRegion2.idCliente2'],
            order: { idRegion2: { id: 'DESC' } },
            where: {
              idUsuario: idUser,
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

        case 2:
          // Usuarios Administrador - solo sus regiones asignadas
          [data, total] = await this.usuarioregionesRepository.findAndCount({
            skip: (page - 1) * limit,
            take: limit,
            relations: ['idRegion2', 'idRegion2.idCliente2'],
            order: { idRegion2: { id: 'DESC' } },
            where: {
              idUsuario: idUser,
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

        default:
          // Usuarios normales - solo sus regiones asignadas
          [data, total] = await this.usuarioregionesRepository.findAndCount({
            skip: (page - 1) * limit,
            take: limit,
            relations: ['idRegion2', 'idRegion2.idCliente2'],
            order: { idRegion2: { id: 'DESC' } },
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
        error: error.message,
      });
    }
  }

  async findAllList(cliente: number, idUser: number, rol: number) {
    try {
      let regiones: any[] = [];
      switch (rol) {
        case 1:
          // Usuario administrador - obtiene todas las regiones
          regiones = await this.usuarioregionesRepository.find({
            relations: ['idRegion2', 'idRegion2.idCliente2'],
            where: { estatus: 1, idUsuario: idUser, idRegion2: { estatus: 1 } },
            order: { idRegion2: { id: 'DESC' } },
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
            order: { idRegion2: { id: 'DESC' } },
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
        error: error.message,
      });
    }
  }

  async findOne(idUser: number, id: number, cliente: number, rol: number) {
    try {
      let regiones;
      //Obtenemos ConteoPasajeros
      switch (rol) {
        case 1:
          // Usuario administrador - obtiene todas las regiones
          regiones = await this.regionesRepository.findOne({
            relations: ['idCliente2'],
            where: { id: id },
            select: {
              id: true,
              nombre: true,
              descripcion: true,
              fechaCreacion: true,
              fechaActualizacion: true,
              estatus: true,
              idCliente2: {
                id: true,
                nombre: true,
                apellidoPaterno: true,
                apellidoMaterno: true,
              },
            },
          });
          break;

        case 2:
          regiones = await this.regionesRepository.findOne({
            relations: ['idCliente2'],
            where: { id: id, idCliente: cliente },
            select: {
              id: true,
              nombre: true,
              descripcion: true,
              fechaCreacion: true,
              fechaActualizacion: true,
              estatus: true,
              idCliente2: {
                id: true,
                nombre: true,
                apellidoPaterno: true,
                apellidoMaterno: true,
              },
            },
          });
          break;

        default:
          // Usuarios normales - solo sus regiones asignadas
          const permiso = await this.usuarioregionesRepository.findOne({
            relations: ['idRegion2', 'idRegion2.idCliente2'],
            where: { idUsuario: idUser, idRegion: id, estatus: 1 },
          });
          if (!permiso) throw new BadRequestException(`Acceso denegado`);

          regiones = await this.regionesRepository.findOne({
            relations: ['idCliente2'],
            where: { id: id, idCliente: cliente },
            select: {
              id: true,
              nombre: true,
              descripcion: true,
              fechaCreacion: true,
              fechaActualizacion: true,
              estatus: true,
              idCliente2: {
                id: true,
                nombre: true,
                apellidoPaterno: true,
                apellidoMaterno: true,
              },
            },
          });
          break;
      }

      if (!regiones) {
        throw new NotFoundException('regiones no encontrado');
      }

      // 🔥 Transformación: IDs como number + nombreCompleto en cliente
      const data = {
        ...regiones,
        id: Number(regiones.id), // Convertir id a number
        idCliente2: regiones.idCliente2
          ? {
              ...regiones.idCliente2,
              id: Number(regiones.idCliente2.id), // Convertir idCliente2.id a number
              nombreCompleto: [
                regiones.idCliente2.nombre,
                regiones.idCliente2.apellidoPaterno,
                regiones.idCliente2.apellidoMaterno,
              ]
                .filter(Boolean)
                .join(' ')
                .trim(), // Generar nombreCompleto
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

      // Registro en la bitácora SUCESS
      const querylogger = { updateRegionesEstatusDto };
      await this.bitacoraLogger.logToBitacora(
        'Regiones',
        `Se actualizo estatus a ${estatus} una Region con nombre: ${regiones.nombre}  y Id ${id}`,
        'UPDATE',
        `${querylogger}`,
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
      // Registro en la bitácora ERROR
      const querylogger = { updateRegionesEstatusDto };
      await this.bitacoraLogger.logToBitacora(
        'Regiones',
        `Se actualizo estatus a ${updateRegionesEstatusDto.estatus} en Region con ID: ${id}`,
        'UPDATE',
        `${querylogger}`,
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

      // Registro en la bitácora SUCCESS
      const querylogger = { updateRegioneDto };
      await this.bitacoraLogger.logToBitacora(
        'Regiones',
        `Se actualizo una Region con nombre: ${updateRegioneDto.nombre} y Id ${id}`,
        'UPDATE',
        `${querylogger}`,
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
      // Registro en la bitácora ERROR
      const querylogger = { updateRegioneDto };
      await this.bitacoraLogger.logToBitacora(
        'Regiones',
        `Se actualizo una Region con nombre: ${updateRegioneDto.nombre}  y Id ${id}`,
        'UPDATE',
        `${querylogger}`,
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

      // Registro en la bitácora SUCCESS
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Regiones',
        `Se elimino una Region con nombre: ${regiones.nombre} y Id ${id}`,
        'UPDATE',
        `${querylogger}`,
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
      // Registro en la bitácora ERROR
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Regiones',
        `Se elimino una Region con ID: ${id}`,
        'UPDATE',
        `${querylogger}`,
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
