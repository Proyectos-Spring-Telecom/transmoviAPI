import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateInstalacionesDto } from './dto/create-instalacione.dto';
import { UpdateInstalacioneDto } from './dto/update-instalacione.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Instalaciones } from 'src/entities/Instalaciones';
import { Repository } from 'typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { UpdateInstalacioneEstatusDto } from './dto/update-instalacione-estatus.dto';
import { UsuariosInstalaciones } from 'src/entities/UsuariosInstalaciones';
import { error } from 'console';

@Injectable()
export class InstalacionesService {
  constructor(
    @InjectRepository(Instalaciones)
    private readonly instalacionesRepository: Repository<Instalaciones>,
    @InjectRepository(UsuariosInstalaciones)
    private readonly usuariosinstalacionesRepository: Repository<UsuariosInstalaciones>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  async create(
    idUser: string,
    createInstalacioneDto: CreateInstalacionesDto,
  ): Promise<ApiCrudResponse> {
    try {
      // ✅ VALIDACIÓN MEJORADA: Verificar todos los conflictos con relaciones
      const errores: string[] = [];

      // Verificar dispositivo CON relaciones
      const dispositivoEnUso = await this.instalacionesRepository.findOne({
        where: {
          idDispositivo: createInstalacioneDto.idDispositivo,
          estatus: 1,
        },
        relations: ['dispositivos'],
      });
      if (dispositivoEnUso) {
        errores.push(
          `Dispositivo "${dispositivoEnUso.dispositivos.numeroSerie}" ya está en uso`,
        );
      }

      // Verificar BlueVox CON relaciones
      const blueVoxEnUso = await this.instalacionesRepository.findOne({
        where: { idBlueVox: createInstalacioneDto.idBlueVox, estatus: 1 },
        relations: ['blueVoxs'],
      });
      if (blueVoxEnUso) {
        errores.push(
          `BlueVox "${blueVoxEnUso.blueVoxs.numeroSerie}" ya está en uso`,
        );
      }

      // Verificar Vehículo CON relaciones
      const vehiculoEnUso = await this.instalacionesRepository.findOne({
        where: { idVehiculo: createInstalacioneDto.idVehiculo, estatus: 1 },
        relations: ['vehiculos'],
      });
      if (vehiculoEnUso) {
        errores.push(
          `Vehículo con placa "${vehiculoEnUso.vehiculos.placa}" ya está en uso`,
        );
      }

      // Si hay conflictos, lanzar error con todos los detalles
      if (errores.length > 0) {
        throw new BadRequestException({
          message:
            'No se puede crear la instalación debido a los siguientes conflictos',
          errors: errores,
          conflictsCount: errores.length,
        });
      }

      // Crear instalación y guardarla en la base de datos
      const newInstalaciones = await this.instalacionesRepository.create(
        createInstalacioneDto,
      );
      const instalacionSave =
        await this.instalacionesRepository.save(newInstalaciones);

      //Asignamos a root la region
      const rootPermisos = {
        estatus: 1,
        idUsuario: 1, //Se asigna al usuario supremo
        idInstalacion: instalacionSave.id,
      };

      await this.usuariosinstalacionesRepository.save(rootPermisos);
      // Registro en la bitácora (con mensaje corregido)
      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `Se creó una Instalación con id: ${instalacionSave.id}`, // ✅ Corregido
        'CREATE',
        `INSERT INTO Instalaciones (...) VALUES (...) -> id: ${instalacionSave.id}, Estatus: ${instalacionSave.estatus}, IdDispositivo: ${instalacionSave.idDispositivo}, IdBlueVox: ${instalacionSave.idBlueVox}, IdVehiculo: ${instalacionSave.idVehiculo}, IdCliente: ${instalacionSave.idCliente}`,
        Number(idUser),
        13,
      );

      // API response (con mensajes corregidos)
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Instalación creada correctamente', // ✅ Corregido
        data: {
          id: Number(instalacionSave.id),
          nombre: `Instalación ${instalacionSave.id} - Dispositivo:${instalacionSave.idDispositivo} BlueVox:${instalacionSave.idBlueVox} Vehículo:${instalacionSave.idVehiculo}`, // ✅ Mejorado
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      // ✅ Manejo específico para errores de FK (del error original que tenías)
      if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        throw new BadRequestException({
          message: 'Error de referencia en la base de datos',
          details:
            'Verifica que los IDs de Cliente, Dispositivo, BlueVox y Vehículo sean válidos y existan en el sistema',
          sqlError: 'La combinación Cliente-Dispositivo no es válida',
        });
      }

      throw new InternalServerErrorException({
        message: 'Error al crear Instalación',
        error: error.message, // ✅ Solo el mensaje, no todo el objeto
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
        // Usuario administrador - obtiene todas las instalaciones
        case 1:
          [data, total] =
            await this.usuariosinstalacionesRepository.findAndCount({
              skip: (page - 1) * limit,
              take: limit,
              relations: [
                'idInstalacion2',
                'idInstalacion2.dispositivos',
                'idInstalacion2.blueVoxs',
                'idInstalacion2.vehiculos',
                'idInstalacion2.idCliente2',
              ],
              where: {
                idUsuario: idUser,
                estatus: 1,
              },
              select: {
                id: true,
                idUsuario: true,
                idInstalacion: true,
                idInstalacion2: {
                  id: true,
                  fechaCreacion: true,
                  fechaActualizacion: true,
                  estatus: true,
                  idCliente: true,
                  dispositivos: { id: true, numeroSerie: true },
                  blueVoxs: { id: true, numeroSerie: true },
                  vehiculos: { id: true, placa: true },
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
          // Usuarios normales - solo sus instalaciones asignadas
          [data, total] =
            await this.usuariosinstalacionesRepository.findAndCount({
              skip: (page - 1) * limit,
              take: limit,
              relations: [
                'idInstalacion2',
                'idInstalacion2.dispositivos',
                'idInstalacion2.blueVoxs',
                'idInstalacion2.vehiculos',
                'idInstalacion2.idCliente2',
              ],
              where: {
                idUsuario: idUser,
                estatus: 1,
                idInstalacion2: {
                  idCliente: cliente,
                },
              },
              select: {
                id: true,
                idUsuario: true,
                idInstalacion: true,
                idInstalacion2: {
                  id: true,
                  fechaCreacion: true,
                  fechaActualizacion: true,
                  estatus: true,
                  idCliente: true,
                  dispositivos: { id: true, numeroSerie: true },
                  blueVoxs: { id: true, numeroSerie: true },
                  vehiculos: { id: true, placa: true },
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
        throw new NotFoundException('Instalaciones no encontrado');
      }

      // 🔥 Transformación de datos (ids → number, nombreCompleto)
      const instalaciones = data.map((item) => ({
        ...item,
        id: Number(item.id),
        idUsuario: Number(item.idUsuario),
        idInstalacion: Number(item.idInstalacion),
        idInstalacion2: item.idInstalacion2
          ? {
              ...item.idInstalacion2,
              id: Number(item.idInstalacion2.id),
              idCliente: Number(item.idInstalacion2.idCliente),
              dispositivos: item.idInstalacion2.dispositivos
                ? {
                    ...item.idInstalacion2.dispositivos,
                    id: Number(item.idInstalacion2.dispositivos.id),
                  }
                : null,
              blueVoxs: item.idInstalacion2.blueVoxs
                ? {
                    ...item.idInstalacion2.blueVoxs,
                    id: Number(item.idInstalacion2.blueVoxs.id),
                  }
                : null,
              vehiculos: item.idInstalacion2.vehiculos
                ? {
                    ...item.idInstalacion2.vehiculos,
                    id: Number(item.idInstalacion2.vehiculos.id),
                  }
                : null,
              idCliente2: item.idInstalacion2.idCliente2
                ? {
                    ...item.idInstalacion2.idCliente2,
                    id: Number(item.idInstalacion2.idCliente2.id),
                    nombreCompleto:
                      `${item.idInstalacion2.idCliente2.nombre ?? ''} ${item.idInstalacion2.idCliente2.apellidoPaterno ?? ''} ${item.idInstalacion2.idCliente2.apellidoMaterno ?? ''}`.trim(),
                  }
                : null,
            }
          : null,
      }));
      //APi response
      const result: ApiResponseCommon = {
        data: instalaciones,
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
        message: 'Error al obtener paginado Instalaciones',
        error,
      });
    }
  }

  async findAllList(
    cliente: number,
    idUser: number,
  ): Promise<ApiResponseCommon> {
    try {
      let instalaciones: any[] = [];
      switch (idUser) {
        case 1:
          // Usuario administrador - obtiene todas las instalaciones
          instalaciones = await this.usuariosinstalacionesRepository.find({
            relations: [
              'idInstalacion2',
              'idInstalacion2.dispositivos',
              'idInstalacion2.blueVoxs',
              'idInstalacion2.vehiculos',
              'idInstalacion2.idCliente2',
            ],
            where: {
              estatus: 1,
              idUsuario: idUser,
              idInstalacion2: { estatus: 1 },
            },
            select: {
              id: true,
              idUsuario: true,
              idInstalacion: true,
              idInstalacion2: {
                id: true,
                fechaCreacion: true,
                fechaActualizacion: true,
                estatus: true,
                idCliente: true,
                dispositivos: { id: true, numeroSerie: true },
                blueVoxs: { id: true, numeroSerie: true },
                vehiculos: { id: true, placa: true },
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
          // Usuarios normales - solo sus instalaciones asignadas
          instalaciones = await this.usuariosinstalacionesRepository.find({
            relations: [
              'idInstalacion2',
              'idInstalacion2.dispositivos',
              'idInstalacion2.blueVoxs',
              'idInstalacion2.vehiculos',
              'idInstalacion2.idCliente2',
            ],
            where: {
              idUsuario: idUser,
              estatus: 1,
              idInstalacion2: {
                idCliente: cliente,
                estatus: 1,
              },
            },
            select: {
              id: true,
              idUsuario: true,
              idInstalacion: true,
              idInstalacion2: {
                id: true,
                fechaCreacion: true,
                fechaActualizacion: true,
                estatus: true,
                idCliente: true,
                dispositivos: { id: true, numeroSerie: true },
                blueVoxs: { id: true, numeroSerie: true },
                vehiculos: { id: true, placa: true },
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

      if (instalaciones.length === 0) {
        throw new NotFoundException('Instalaciones no encontrado');
      }

      // 🔥 Transformación de datos (ids → number, nombreCompleto)
      const data = instalaciones.map((item) => ({
        ...item,
        id: Number(item.id),
        idUsuario: Number(item.idUsuario),
        idInstalacion: Number(item.idInstalacion),
        idInstalacion2: item.idInstalacion2
          ? {
              ...item.idInstalacion2,
              id: Number(item.idInstalacion2.id),
              idCliente: Number(item.idInstalacion2.idCliente),
              dispositivos: item.idInstalacion2.dispositivos
                ? {
                    ...item.idInstalacion2.dispositivos,
                    id: Number(item.idInstalacion2.dispositivos.id),
                  }
                : null,
              blueVoxs: item.idInstalacion2.blueVoxs
                ? {
                    ...item.idInstalacion2.blueVoxs,
                    id: Number(item.idInstalacion2.blueVoxs.id),
                  }
                : null,
              vehiculos: item.idInstalacion2.vehiculos
                ? {
                    ...item.idInstalacion2.vehiculos,
                    id: Number(item.idInstalacion2.vehiculos.id),
                  }
                : null,
              idCliente2: item.idInstalacion2.idCliente2
                ? {
                    ...item.idInstalacion2.idCliente2,
                    id: Number(item.idInstalacion2.idCliente2.id),
                    nombreCompleto:
                      `${item.idInstalacion2.idCliente2.nombre ?? ''} ${item.idInstalacion2.idCliente2.apellidoPaterno ?? ''} ${item.idInstalacion2.idCliente2.apellidoMaterno ?? ''}`.trim(),
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
        message: 'Error al obtener listado Instalaciones',
        error,
      });
    }
  }

  async findOne(id: number, idUser: number, cliente: number) {
    try {
      let instalaciones;
      switch (idUser) {
        case 1:
          // Usuario administrador - obtiene todas las instalaciones
          instalaciones = await this.instalacionesRepository.findOne({
            relations: ['blueVoxs', 'idCliente2', 'dispositivos', 'vehiculos'],
            where: { id: id },
            select: {
              id: true,
              fechaCreacion: true,
              fechaActualizacion: true,
              estatus: true,
              dispositivos: { id: true, numeroSerie: true },
              blueVoxs: { id: true, numeroSerie: true },
              vehiculos: { id: true, placa: true },
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
          // Usuarios normales - solo sus instalaciones asignadas
          const permiso = await this.usuariosinstalacionesRepository.find({
            where: { idUsuario: idUser, idInstalacion: id, estatus: 1 },
          });
          if (permiso.length === 0)
            throw new BadRequestException(`Acceso denegado`);

          instalaciones = await this.instalacionesRepository.findOne({
            relations: ['blueVoxs', 'idCliente2', 'dispositivos', 'vehiculos'],

            where: { id: id, idCliente: cliente },
            select: {
              id: true,
              fechaCreacion: true,
              fechaActualizacion: true,
              estatus: true,
              dispositivos: { id: true, numeroSerie: true },
              blueVoxs: { id: true, numeroSerie: true },
              vehiculos: { id: true, placa: true },
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
      if (!instalaciones) {
        throw new NotFoundException('instalaciones no encontrado');
      }

      // 🔥 Transformamos ids a number y añadimos nombreCompleto
    const transformado = {
      ...instalaciones,
      id: Number(instalaciones.id),
      dispositivos: instalaciones.dispositivos
        ? {
            ...instalaciones.dispositivos,
            id: Number(instalaciones.dispositivos.id),
          }
        : null,
      blueVoxs: instalaciones.blueVoxs
        ? {
            ...instalaciones.blueVoxs,
            id: Number(instalaciones.blueVoxs.id),
          }
        : null,
      vehiculos: instalaciones.vehiculos
        ? {
            ...instalaciones.vehiculos,
            id: Number(instalaciones.vehiculos.id),
          }
        : null,
      idCliente2: instalaciones.idCliente2
        ? {
            ...instalaciones.idCliente2,
            id: Number(instalaciones.idCliente2.id),
            nombreCompleto: `${instalaciones.idCliente2.nombre ?? ''} ${
              instalaciones.idCliente2.apellidoPaterno ?? ''
            } ${instalaciones.idCliente2.apellidoMaterno ?? ''}`.trim(),
          }
        : null,
    };

    return { data: transformado };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtener Instalaciones Por ID',
        error,
      });
    }
  }

  async updateEstatus(
    id: number,
    idUser: number,
    cliente: number,
    updateInstalacioneEstatusDto: UpdateInstalacioneEstatusDto,
  ) {
    try {
      let instalacion;
      switch (idUser) {
        case 1:
          // Usuario administrador - obtiene todas las instalaciones
          instalacion = await this.instalacionesRepository.findOne({
            where: { id: id },
          });
          break;

        default:
          // Usuarios normales - solo sus instalaciones asignadas
          const permiso = await this.usuariosinstalacionesRepository.find({
            where: { idUsuario: idUser, idInstalacion: id, estatus: 1 },
          });
          if (permiso.length === 0)
            throw new BadRequestException(`Acceso denegado`);

          instalacion = await this.instalacionesRepository.findOne({
            where: { id: id, idCliente: cliente },
          });
          break;
      }

      if (!instalacion) {
        throw new NotFoundException(
          `Instalaciones con id: ${id} no encontrado`,
        );
      }

      //Actualizamos el estatus
      const estatus = updateInstalacioneEstatusDto.estatus;
      await this.instalacionesRepository.update(id, { estatus: estatus });

      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `Se cambio el estatus de instalacion con id: ${instalacion.id}`,
        'UPDATE',
        `UPDATE CLIENTE SET Estatus = ${estatus} WHERE id = ${id}`,
        Number(idUser),
        13,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Estatus instalaciones actualizado correctamente',
        estatus: { estatus: estatus },
        data: {
          id: id,
          nombre:
            `${instalacion.id} dispositivo:${instalacion.idDispositivo} bluevox: ${instalacion.blueVoxs} vehiculo: ${instalacion.idVehiculo}` ||
            '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al cambiar estatus de instalaciones con id: ${id}`,
      );
    }
  }

  async update(
    id: number,
    idUser: number,
    cliente: number,
    updateInstalacioneDto: UpdateInstalacioneDto,
  ): Promise<ApiCrudResponse> {
    try {
      let instalacion;
      switch (idUser) {
        case 1:
          // Usuario administrador - obtiene todas las instalaciones
          instalacion = await this.instalacionesRepository.findOne({
            where: { id: id },
          });
          break;

        default:
          // Usuarios normales - solo sus instalaciones asignadas
          const permiso = await this.usuariosinstalacionesRepository.find({
            where: { idUsuario: idUser, idInstalacion: id, estatus: 1 },
          });
          if (permiso.length === 0)
            throw new BadRequestException(`Acceso denegado`);

          instalacion = await this.instalacionesRepository.findOne({
            where: { id: id, idCliente: cliente },
          });

          //Se asigna el idCliente obtenido del Token
          updateInstalacioneDto.idCliente = cliente;
          break;
      }
      if (!instalacion) {
        throw new NotFoundException(
          `Instalaciones con id: ${id} no encontrado`,
        );
      }

      //Actualizamos datos
      await this.instalacionesRepository.update(id, updateInstalacioneDto);

      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `Se actualizo instalacion con id: ${instalacion.id}`,
        'UPDATE',
        `UPDATE Instalaciones (...) VALUES (...) -> id:  ${instalacion.id}, Estatus: ${instalacion.estatus}, IdDispositivo: ${updateInstalacioneDto.idDispositivo}, IdBlueVox: ${updateInstalacioneDto.idBlueVox}, IdVehiculo: ${updateInstalacioneDto.idVehiculo}, IdCliente: ${updateInstalacioneDto.idCliente}`,
        Number(idUser),
        13,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Instalaciones actualizado correctamente',
        data: {
          id: id,
          nombre:
            `${instalacion.id} dispositivo:${instalacion.idDispositivo} bluevox: ${instalacion.idBlueVox} vehiculo: ${instalacion.idVehiculo}` ||
            '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al actualizar Instalación',
        error: error, // ✅ Solo el mensaje, no todo el objeto
      });
    }
  }

  async remove(
    id: number,
    cliente: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      let instalacion;
      switch (idUser) {
        case 1:
          // Usuario administrador - obtiene todas las instalaciones
          instalacion = await this.instalacionesRepository.findOne({
            where: { id: id },
          });
          break;

        default:
          // Usuarios normales - solo sus instalaciones asignadas
          const permiso = await this.usuariosinstalacionesRepository.find({
            where: { idUsuario: idUser, idInstalacion: id, estatus: 1 },
          });
          if (permiso.length === 0)
            throw new BadRequestException(`Acceso denegado`);

          instalacion = await this.instalacionesRepository.findOne({
            where: { id: id, idCliente: cliente },
          });
          break;
      }
      if (!instalacion) {
        throw new NotFoundException(
          `Instalaciones con id: ${id} no encontrado,`,
        );
      }

      //Actualizamos datos
      await this.instalacionesRepository.update(id, { estatus: 0 });

      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `Se elimino instalacion con id: ${instalacion.id}`,
        'DELETE',
        `DELETE FROM Instalaciones WHERE Id=${id}`,
        Number(idUser),
        13,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Instalaciones eliminado correctamente',
        data: {
          id: id,
          nombre:
            `${instalacion.id} dispositivo:${instalacion.idDispositivo} bluevox: ${instalacion.blueVoxs} vehiculo: ${instalacion.idVehiculo}` ||
            '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al eliminar de instalaciones con id: ${id}`,
      );
    }
  }
}
