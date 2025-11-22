import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateVerificacionesDto } from './dto/create-verificaciones.dto';
import { UpdateVerificacionesDto } from './dto/update-verificaciones.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Verificaciones } from 'src/entities/Verificaciones';
import { Instalaciones } from 'src/entities/Instalaciones';
import { Operadores } from 'src/entities/Operadores';
import { CatTipoVerificaciones } from 'src/entities/CatTipoVerificaciones';
import { Repository, In } from 'typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { S3Service } from 'src/s3/s3.service';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';

@Injectable()
export class VerificacionesService {
  constructor(
    @InjectRepository(Verificaciones)
    private readonly verificacionesRepository: Repository<Verificaciones>,
    @InjectRepository(Instalaciones)
    private readonly instalacionesRepository: Repository<Instalaciones>,
    @InjectRepository(Operadores)
    private readonly operadoresRepository: Repository<Operadores>,
    @InjectRepository(CatTipoVerificaciones)
    private readonly catTipoVerificacionesRepository: Repository<CatTipoVerificaciones>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly s3Service: S3Service,
  ) {}

  async create(
    createVerificacionesDto: CreateVerificacionesDto,
    idUser: number,
    notaVerificacionFile?: Express.Multer.File,
  ): Promise<ApiCrudResponse> {
    try {
      // Validar claves foráneas si se proporcionan
      if (createVerificacionesDto.idInstalacion !== undefined && createVerificacionesDto.idInstalacion !== null) {
        const instalacionExists = await this.instalacionesRepository.findOne({
          where: { id: createVerificacionesDto.idInstalacion },
        });
        if (!instalacionExists) {
          throw new BadRequestException(
            `La instalación con ID ${createVerificacionesDto.idInstalacion} no existe.`,
          );
        }
      }

      if (createVerificacionesDto.idOperador !== undefined && createVerificacionesDto.idOperador !== null) {
        const operadorExists = await this.operadoresRepository.findOne({
          where: { id: createVerificacionesDto.idOperador },
        });
        if (!operadorExists) {
          throw new BadRequestException(
            `El operador con ID ${createVerificacionesDto.idOperador} no existe.`,
          );
        }
      }

      if (createVerificacionesDto.idTipoVerificacion !== undefined && createVerificacionesDto.idTipoVerificacion !== null) {
        const tipoVerificacionExists = await this.catTipoVerificacionesRepository.findOne({
          where: { id: createVerificacionesDto.idTipoVerificacion },
        });
        if (!tipoVerificacionExists) {
          throw new BadRequestException(
            `El tipo de verificación con ID ${createVerificacionesDto.idTipoVerificacion} no existe.`,
          );
        }
      }

      // Subir imagen de notaVerificacion a S3 si se proporciona
      let notaVerificacionUrl: string | null = null;
      if (notaVerificacionFile) {
        const uploadResult = await this.s3Service.uploadFile(
          notaVerificacionFile,
          'Verificaciones',
          idUser,
          6, // ID del módulo de verificaciones (ajustar según corresponda)
        );
        notaVerificacionUrl = uploadResult.url;
      }

      // Crear el registro con los datos del DTO
      const dataToCreate = {
        ...createVerificacionesDto,
        notaVerificacion: notaVerificacionUrl,
      };

      const create = this.verificacionesRepository.create(
        dataToCreate,
      );
      const savedResult = await this.verificacionesRepository.save(create);
      const saved = Array.isArray(savedResult) ? savedResult[0] : savedResult;

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { createVerificacionesDto };
      await this.bitacoraLogger.logToBitacora(
        'Verificaciones',
        `Se creó una verificación con ID: ${saved.id}`,
        'CREATE',
        querylogger,
        idUser,
        6, // ID del módulo de verificaciones
        EstatusEnumBitcora.SUCCESS,
      );

      const idVerificacion = saved.id;
      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Verificación creada correctamente',
        data: {
          id: Number(idVerificacion),
          nombre: `Verificación #${idVerificacion}`,
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      console.log(error); 
      const querylogger = { createVerificacionesDto };
      await this.bitacoraLogger.logToBitacora(
        'Verificaciones',
        `Error al crear verificación`,
        'CREATE',
        querylogger,
        idUser,
        6, // ID del módulo de verificaciones
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException(
        'Se produjo un error al crear la verificación.',
      );
    }
  }

  async findAll(page: number, limit: number, idCliente: number, rol: number): Promise<ApiResponseCommon> {
    try {
      const whereCondition: any = {};
      
      // Filtrar por idCliente si el rol no es 1 o 2
      if (rol !== 1 && rol !== 2) {
        // Obtener las instalaciones del cliente
        const instalaciones = await this.instalacionesRepository.find({
          where: { idCliente: idCliente },
          select: ['id'],
        });
        const idsInstalaciones = instalaciones.map(inst => inst.id);
        
        // Si no hay instalaciones, retornar vacío
        if (idsInstalaciones.length === 0) {
          return {
            data: [],
            paginated: {
              total: 0,
              page,
              lastPage: 0,
            },
          };
        }
        
        whereCondition.idInstalacion = In(idsInstalaciones);
      }

      const [data, total] = await this.verificacionesRepository.findAndCount({
        where: Object.keys(whereCondition).length > 0 ? whereCondition : undefined,
        relations: ['instalacion', 'instalacion.vehiculos', 'instalacion.idCliente2', 'operador', 'operador.idUsuario2', 'tipoVerificacion'],
        order: { fhRegistro: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

      // Forzamos ids a number
      const verificaciones = data.map((item) => {
        const nombreOperador = item.operador?.idUsuario2 
          ? `${item.operador.idUsuario2.nombre || ''} ${item.operador.idUsuario2.apellidoPaterno || ''} ${item.operador.idUsuario2.apellidoMaterno || ''}`.trim() || null
          : null;

        const nombreCliente = item.instalacion?.idCliente2
          ? `${item.instalacion.idCliente2.nombre || ''} ${item.instalacion.idCliente2.apellidoPaterno || ''} ${item.instalacion.idCliente2.apellidoMaterno || ''}`.trim() || null
          : null;

        return {
          id: Number(item.id),
          verificacionActual: item.verificacionActual,
          proximaVerificacion: item.proximaVerificacion,
          idInstalacion: item.idInstalacion ? Number(item.idInstalacion) : null,
          idOperador: item.idOperador ? Number(item.idOperador) : null,
          estatus: item.estatus,
          notaVerificacion: item.notaVerificacion,
          fhRegistro: item.fhRegistro,
          idTipoVerificacion: item.idTipoVerificacion ? Number(item.idTipoVerificacion) : null,
          nombreTipoVerificacion: item.tipoVerificacion?.nombre || null,
          placaVehiculo: item.instalacion?.vehiculos?.placa || null,
          imagenVehiculo: item.instalacion?.vehiculos?.foto || null,
          nombreOperador: nombreOperador,
          nombreCliente: nombreCliente,
        };
      });

      const result: ApiResponseCommon = {
        data: verificaciones,
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
      throw new BadRequestException(
        error.message || 'Error al obtener las verificaciones',
      );
    }
  }

  async findOne(id: number, idCliente: number, rol: number): Promise<ApiResponseCommon> {
    try {
      const verificacion = await this.verificacionesRepository.findOne({
        where: { id: id },
        relations: ['instalacion', 'instalacion.vehiculos', 'instalacion.idCliente2', 'operador', 'operador.idUsuario2', 'tipoVerificacion'],
      });

      // Verificar que la verificación pertenece al cliente si el rol no es 1 o 2
      if (rol !== 1 && rol !== 2) {
        if (!verificacion || verificacion.instalacion?.idCliente !== idCliente) {
          throw new NotFoundException('Verificación no encontrada');
        }
      }

      if (!verificacion) {
        throw new NotFoundException('Verificación no encontrada');
      }

      const nombreOperador = verificacion.operador?.idUsuario2 
        ? `${verificacion.operador.idUsuario2.nombre || ''} ${verificacion.operador.idUsuario2.apellidoPaterno || ''} ${verificacion.operador.idUsuario2.apellidoMaterno || ''}`.trim() || null
        : null;

      const nombreCliente = verificacion.instalacion?.idCliente2
        ? `${verificacion.instalacion.idCliente2.nombre || ''} ${verificacion.instalacion.idCliente2.apellidoPaterno || ''} ${verificacion.instalacion.idCliente2.apellidoMaterno || ''}`.trim() || null
        : null;

      const result: ApiResponseCommon = {
        data: [
          {
            id: Number(verificacion.id),
            verificacionActual: verificacion.verificacionActual,
            proximaVerificacion: verificacion.proximaVerificacion,
            idInstalacion: verificacion.idInstalacion ? Number(verificacion.idInstalacion) : null,
            idOperador: verificacion.idOperador ? Number(verificacion.idOperador) : null,
            estatus: verificacion.estatus,
            notaVerificacion: verificacion.notaVerificacion,
            fhRegistro: verificacion.fhRegistro,
            idTipoVerificacion: verificacion.idTipoVerificacion ? Number(verificacion.idTipoVerificacion) : null,
            nombreTipoVerificacion: verificacion.tipoVerificacion?.nombre || null,
            placaVehiculo: verificacion.instalacion?.vehiculos?.placa || null,
            imagenVehiculo: verificacion.instalacion?.vehiculos?.foto || null,
            nombreOperador: nombreOperador,
            nombreCliente: nombreCliente,
          },
        ],
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error interno al buscar la verificación',
      );
    }
  }

  async update(
    id: number,
    updateVerificacionesDto: UpdateVerificacionesDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const verificacion = await this.verificacionesRepository.findOne({
        where: { id: id },
      });
      if (!verificacion) {
        throw new NotFoundException('Verificación no encontrada');
      }

      // Validar claves foráneas si se proporcionan
      if (updateVerificacionesDto.idInstalacion !== undefined && updateVerificacionesDto.idInstalacion !== null) {
        const instalacionExists = await this.instalacionesRepository.findOne({
          where: { id: updateVerificacionesDto.idInstalacion },
        });
        if (!instalacionExists) {
          throw new BadRequestException(
            `La instalación con ID ${updateVerificacionesDto.idInstalacion} no existe.`,
          );
        }
      }

      if (updateVerificacionesDto.idOperador !== undefined && updateVerificacionesDto.idOperador !== null) {
        const operadorExists = await this.operadoresRepository.findOne({
          where: { id: updateVerificacionesDto.idOperador },
        });
        if (!operadorExists) {
          throw new BadRequestException(
            `El operador con ID ${updateVerificacionesDto.idOperador} no existe.`,
          );
        }
      }

      if (updateVerificacionesDto.idTipoVerificacion !== undefined && updateVerificacionesDto.idTipoVerificacion !== null) {
        const tipoVerificacionExists = await this.catTipoVerificacionesRepository.findOne({
          where: { id: updateVerificacionesDto.idTipoVerificacion },
        });
        if (!tipoVerificacionExists) {
          throw new BadRequestException(
            `El tipo de verificación con ID ${updateVerificacionesDto.idTipoVerificacion} no existe.`,
          );
        }
      }

      await this.verificacionesRepository.update(
        id,
        updateVerificacionesDto,
      );
      const verificacionResult = await this.verificacionesRepository.findOne({
        where: { id: id },
      });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { updateVerificacionesDto };
      await this.bitacoraLogger.logToBitacora(
        'Verificaciones',
        `Se actualizó la verificación con ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        6, // ID del módulo de verificaciones
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Verificación actualizada correctamente',
        data: {
          id: id,
          nombre: `Verificación #${id}`,
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { updateVerificacionesDto };
      await this.bitacoraLogger.logToBitacora(
        'Verificaciones',
        `Error al actualizar verificación con ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        6, // ID del módulo de verificaciones
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException(
        'Se produjo un error al actualizar la verificación.',
      );
    }
  }

  async desactivar(id: number, idUser: number): Promise<ApiCrudResponse> {
    try {
      const verificacion = await this.verificacionesRepository.findOne({
        where: { id: id },
      });

      if (!verificacion) {
        throw new NotFoundException('Verificación no encontrada');
      }

      await this.verificacionesRepository.update(id, { estatus: 0 });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Verificaciones',
        `Se desactivó la verificación con ID: ${id}`,
        'UPDATE',
        querylogger,
        Number(idUser),
        6, // ID del módulo de verificaciones
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Verificación desactivada correctamente',
        estatus: { estatus: 0 },
        data: {
          id: id,
          nombre: `Verificación #${id}`,
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Verificaciones',
        `Error al desactivar verificación con ID: ${id}`,
        'UPDATE',
        querylogger,
        Number(idUser),
        6, // ID del módulo de verificaciones
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al desactivar la verificación.',
        error: error.message,
      });
    }
  }

  async activar(id: number, idUser: number): Promise<ApiCrudResponse> {
    try {
      const verificacion = await this.verificacionesRepository.findOne({
        where: { id: id },
      });

      if (!verificacion) {
        throw new NotFoundException('Verificación no encontrada');
      }

      if (verificacion.estatus === 1) {
        throw new BadRequestException('La verificación ya está activa');
      }

      await this.verificacionesRepository.update(id, { estatus: 1 });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { id: id, estatus: 1 };
      await this.bitacoraLogger.logToBitacora(
        'Verificaciones',
        `Se activó la verificación con ID: ${id}`,
        'UPDATE',
        querylogger,
        Number(idUser),
        6, // ID del módulo de verificaciones
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Verificación activada correctamente',
        estatus: { estatus: 1 },
        data: {
          id: id,
          nombre: `Verificación #${id}`,
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { id: id, estatus: 1 };
      await this.bitacoraLogger.logToBitacora(
        'Verificaciones',
        `Error al activar verificación con ID: ${id}`,
        'UPDATE',
        querylogger,
        Number(idUser),
        6, // ID del módulo de verificaciones
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al activar la verificación.',
        error: error.message,
      });
    }
  }
}

