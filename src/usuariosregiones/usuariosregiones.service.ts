import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateUsuariosRegionesDto } from './dto/create-usuariosregione.dto';
import { UpdateUsuariosregioneDto } from './dto/update-usuariosregione.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { UsuariosRegiones } from 'src/entities/UsuariosRegiones';
import { Repository } from 'typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { ApiCrudResponse, ApiResponseCommon, EstatusEnumBitcora } from 'src/common/ApiResponse';
import { UpdateUsuariosRegionesEstatusDto } from './dto/update-usuariosregione-estatus.dto';
import { Regiones } from 'src/entities/Regiones';
import { Usuarios } from 'src/entities/Usuarios';

@Injectable()
export class UsuariosregionesService {
  constructor(
    @InjectRepository(UsuariosRegiones)
    private readonly usuarioregionesRepository: Repository<UsuariosRegiones>,
    @InjectRepository(Regiones)
    private readonly regionesRepository: Repository<Regiones>,
    @InjectRepository(Usuarios)
    private readonly usuariosRepository: Repository<Usuarios>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  async create(
    idUser: number,
    createUsuariosRegionesDto: CreateUsuariosRegionesDto,
  ) {
    try {
      const usuario = await this.usuariosRepository.findOne({
        where: {
          id: createUsuariosRegionesDto.idUsuario,
        },
        select: { idCliente: true },
      });
      if (!usuario) {
        throw new NotFoundException(
          `Usuario con ID ${createUsuariosRegionesDto.idUsuario} no encontrado`,
        );
      }
      const idUsuarioCliente = usuario.idCliente;

      switch (idUser) {
        case 1:
          break;
          // Usuario administrador - obtiene todas las instalaciones
        default:
          // Usuarios normales - solo sus instalaciones asignadas
          for (const i of createUsuariosRegionesDto.idsRegiones) {
            const region = await this.regionesRepository.findOne({
              where: { id: i },
              select: { idCliente: true },
            });
            if (!region) {
              throw new NotFoundException(`Región con ID ${i} no encontrada`);
            }
            if (idUsuarioCliente !== region.idCliente) {
              throw new BadRequestException(
                `La región ${i} no pertenece al mismo cliente que el usuario`,
              );
            }
          }
          break;
      }

      //Creamos y guardamos el permiso para usuarios en region del usuario
      if (createUsuariosRegionesDto.idsRegiones.length > 0) {
        const usuariosregionesPermisos =
          createUsuariosRegionesDto.idsRegiones.map((idsRegiones) =>
            this.usuarioregionesRepository.create({
              idUsuario: createUsuariosRegionesDto.idUsuario,
              idRegion: idsRegiones,
            }),
          );

        const usuariosregioneSave = await this.usuarioregionesRepository.save(
          usuariosregionesPermisos,
        );
      }

      // --- Registro en la bitácora --- SUCCESS
      const querylogger = { createUsuariosRegionesDto };
      await this.bitacoraLogger.logToBitacora(
        'Permisos',
        `Se creó el permiso para usuario: ${createUsuariosRegionesDto.idUsuario} con Id region ${createUsuariosRegionesDto.idsRegiones}`,
        'CREATE',
        querylogger,
        idUser,
        7,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Permiso creado correctamente',
        data: {
          id: Number(createUsuariosRegionesDto.idUsuario),
          nombre:
            `Id Usuario: ${createUsuariosRegionesDto.idUsuario} Id Region: ${createUsuariosRegionesDto.idsRegiones} ` ||
            '',
        },
      };
      return result;
    } catch (error) {
      console.log(error);
      // --- Registro en la bitácora --- ERROR
      const querylogger = { createUsuariosRegionesDto };
      await this.bitacoraLogger.logToBitacora(
        'Permisos',
        `Se creó el permiso para usuario: ${createUsuariosRegionesDto.idUsuario} con Id region ${createUsuariosRegionesDto.idsRegiones}`,
        'CREATE',
        querylogger,
        idUser,
        7,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al crear permiso para el usuario ${createUsuariosRegionesDto.idUsuario} en la region ${createUsuariosRegionesDto.idsRegiones}`,
      );
    }
  }

  async findAllList(): Promise<ApiResponseCommon> {
    try {
      //Obtenemos ConteoPasajeros
      const usuariosregiones = await this.usuarioregionesRepository.find({
        where: { estatus: 1 },
      });
      if (usuariosregiones.length === 0) {
        throw new NotFoundException('UsuariosRegiones no encontrado');
      }

      //Forzamos a cambiar el id a number
      const data = usuariosregiones.map((item) => ({
        ...item,
        id: Number(item.id),
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
        message: 'Error al obtener listado UsuariosRegiones',
        error,
      });
    }
  }

  async findAll(page: number, limit: number): Promise<ApiResponseCommon> {
    try {
      const [data, total] = await this.usuarioregionesRepository.findAndCount({
        skip: (page - 1) * limit,
        take: limit,
      });

      //Forzamos a cambiar el id a number
      const usuariosregiones = data.map((item) => ({
        ...item,
        id: Number(item.id),
      }));

      //APi response
      const result: ApiResponseCommon = {
        data: usuariosregiones,
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
        message: 'Error al obtener Paginado UsuariosRegiones',
        error,
      });
    }
  }

  async findOneUsuario(id: number) {
    try {
      const usuariosregiones = await this.usuarioregionesRepository.find({
        where: { idUsuario: id },
      });
      if (!usuariosregiones) {
        throw new NotFoundException('usuariosregiones no encontrado');
      }

      //Forzamos a cambiar el id a number
      const data = usuariosregiones.map((item) => ({
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
        message: 'Error al obtener UsuariosRegiones Por IdUsuario',
        error,
      });
    }
  }

  async findOne(id: number) {
    try {
      const usuariosregiones = await this.usuarioregionesRepository.findOne({
        where: { id: id },
      });
      if (!usuariosregiones) {
        throw new NotFoundException('usuariosregiones no encontrado');
      }

      //cambiamos el id a number
      usuariosregiones.id = Number(usuariosregiones.id);

      return { data: usuariosregiones };
    } catch (error) {
      console.log(error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtener UsuariosRegiones Por ID',
        error,
      });
    }
  }

  async update(
    id: number,
    idUser: number,
    updateUsuariosregioneDto: UpdateUsuariosregioneDto,
  ): Promise<ApiCrudResponse> {
    try {
      // Extraer regiones del DTO
      const { idsRegiones, ...usuarioRegioneUpdate } = updateUsuariosregioneDto;

      // ----- ACTUALIZACIÓN DE REGIONES -----
      if (idsRegiones && Array.isArray(idsRegiones)) {
        const nuevaLista: number[] = idsRegiones.map(Number); // lista nueva de regiones (ej. [1,2,3])

        // Regiones actuales en BD
        const creadaLista = await this.usuarioregionesRepository.find({
          where: { idUsuario: id },
        });

        const nuevaSet = new Set<number>(nuevaLista);
        const creadaMap = new Map<number, any>(
          creadaLista.map((r) => [Number(r.idRegion), r] as const),
        );

        // Unimos todos los ids (de la nueva lista y de la creada)
        const todosIds = new Set<number>([
          ...nuevaSet,
          ...creadaLista.map((r) => Number(r.idRegion)),
        ]);

        for (const regionId of todosIds) {
          const enNueva = nuevaSet.has(regionId);
          const creado = creadaMap.get(regionId);

          if (enNueva && creado) {
            if (creado.estatus === 0) {
              // Caso: existe en ambas y en creada estatus=0 → activar
              await this.usuarioregionesRepository.update(creado.id, {
                estatus: 1,
              });
            } else {
              // Caso: existe en ambas y ya está activo → no hacer nada
              continue;
            }
          } else if (enNueva && !creado) {
            // Caso: existe en nueva pero no en creada → crear
            const existe = await this.usuarioregionesRepository.findOne({
              where: { idUsuario: id, idRegion: regionId },
            });
            if (!existe) {
              await this.usuarioregionesRepository.save({
                idUsuario: id,
                idRegion: regionId,
                estatus: 1,
              });
            }
          } else if (!enNueva && creado) {
            if (creado.estatus === 1) {
              // Caso: no está en nueva pero sí en creada activo → desactivar
              await this.usuarioregionesRepository.update(creado.id, {
                estatus: 0,
              });
            } else {
              // Caso: ya estaba inactivo → nada que hacer
              continue;
            }
          } else {
            // Caso: no existe ni en nueva ni en creada → nada que hacer
            continue;
          }
        }
      }

      // ----- Registro en la bitácora ----- SUCCESS
      const querylogger = { updateUsuariosregioneDto };
      await this.bitacoraLogger.logToBitacora(
        'UsuariosRegiones',
        `Se actualizaron las regiones del usuario: con ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        7,
        EstatusEnumBitcora.SUCCESS,
      );

      // ----- Api response -----
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Regiones del usuario actualizadas correctamente',
        data: {
          id: id,
          nombre:
            `IdUsuario ${id} Regiones ${updateUsuariosregioneDto.idsRegiones}` ||
            '',
        },
      };

      return result;
    } catch (error) {
      console.log(error);
      // ----- Registro en la bitácora ----- ERROR
      const querylogger = { updateUsuariosregioneDto };
      await this.bitacoraLogger.logToBitacora(
        'UsuariosRegiones',
        `Se actualizaron las regiones del usuario: con ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        7,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al actualizar regiones del usuario',
        error,
      });
    }
  }
  //-----********-----*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*
  async updateEstatus(
    id: number,
    idUser: number,
    updateUsuariosRegionesEstatusDto: UpdateUsuariosRegionesEstatusDto,
  ): Promise<ApiCrudResponse> {
    try {
      const usuarioregion = await this.usuarioregionesRepository.findOne({
        where: { id: id },
      });
      if (!usuarioregion) {
        throw new NotFoundException(
          `UsuariosRegiones con id: ${id} no encontrado`,
        );
      }

      const estatus = updateUsuariosRegionesEstatusDto.estatus;

      //Actualizamos datos
      await this.usuarioregionesRepository.update(id, { estatus: estatus });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { updateUsuariosRegionesEstatusDto };
      await this.bitacoraLogger.logToBitacora(
        'UsuariosRegiones',
        `Se actualizo estatus: ${estatus} de usuarioregion con id: ${usuarioregion.id}`,
        'UPDATE',
        querylogger,
        idUser,
        7,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'UsuariosRegiones estatus actualizado correctamente',
        estatus: { estatus: estatus },
        data: {
          id: id,
          nombre:
            `${usuarioregion.id} IdUsuario:${usuarioregion.idUsuario} IdRegion: ${usuarioregion.idRegion}` ||
            '',
        },
      };
      return result;
    } catch (error) {
      console.log(error);
      //-----Registro en la bitacora----- ERROR
      const querylogger = { updateUsuariosRegionesEstatusDto };
      await this.bitacoraLogger.logToBitacora(
        'UsuariosRegiones',
        `Se actualizo estatus: ${updateUsuariosRegionesEstatusDto.estatus} de usuarioregion con id: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        7,
        EstatusEnumBitcora.ERROR,
        error.message,
      );

      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al actualizar estatus de UsuarioRegion con id: ${id}`,
      );
    }
  }

  async remove(id: number, idUser: number): Promise<ApiCrudResponse> {
    try {
      const usuarioregion = await this.usuarioregionesRepository.findOne({
        where: { id: id },
      });
      if (!usuarioregion) {
        throw new NotFoundException(
          `UsuarioRegiones con id: ${id} no encontrado`,
        );
      }

      //Actualizamos datos
      await this.usuarioregionesRepository.update(id, { estatus: 0 });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'UsuariosRegiones',
        `Se elimino usuarioregion con id: ${usuarioregion.id}`,
        'DELETE',
        querylogger,
        idUser,
        7,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'UsuariosRegiones eliminado correctamente',
        data: {
          id: id,
          nombre:
            `${usuarioregion.id} IdUsuario:${usuarioregion.idUsuario} IdRegion: ${usuarioregion.idRegion}` ||
            '',
        },
      };
      return result;
    } catch (error) {
      console.log(error);
      //-----Registro en la bitacora----- ERROR
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'UsuariosRegiones',
        `Se elimino usuarioregion con id: ${id}`,
        'DELETE',
        querylogger,
        idUser,
        7,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al eliminar de UsuarioRegion con id: ${id}`,
      );
    }
  }
}
