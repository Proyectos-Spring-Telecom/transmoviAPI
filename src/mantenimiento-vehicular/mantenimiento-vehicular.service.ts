import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateMantenimientoVehicularDto } from './dto/create-mantenimiento-vehicular.dto';
import { UpdateMantenimientoVehicularDto } from './dto/update-mantenimiento-vehicular.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { MantenimientoVehicular } from 'src/entities/MantenimientoVehicular';
import { CatEstatusMantenimiento } from 'src/entities/CatEstatusMantenimiento';
import { Talleres } from 'src/entities/Talleres';
import { Instalaciones } from 'src/entities/Instalaciones';
import { CatReferenciaServicio } from 'src/entities/CatReferenciaServicio';
import { Repository, In } from 'typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { S3Service } from 'src/s3/s3.service';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';

@Injectable()
export class MantenimientoVehicularService {
  constructor(
    @InjectRepository(MantenimientoVehicular)
    private readonly mantenimientoVehicularRepository: Repository<MantenimientoVehicular>,
    @InjectRepository(CatEstatusMantenimiento)
    private readonly catEstatusMantenimientoRepository: Repository<CatEstatusMantenimiento>,
    @InjectRepository(Talleres)
    private readonly talleresRepository: Repository<Talleres>,
    @InjectRepository(Instalaciones)
    private readonly instalacionesRepository: Repository<Instalaciones>,
    @InjectRepository(CatReferenciaServicio)
    private readonly catReferenciaServicioRepository: Repository<CatReferenciaServicio>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly s3Service: S3Service,
  ) {}

  async create(
    createMantenimientoVehicularDto: CreateMantenimientoVehicularDto,
    idUser: number,
    notaServicioFile?: Express.Multer.File,
  ): Promise<ApiCrudResponse> {
    try {
      // Validar claves foráneas si se proporcionan
      if (createMantenimientoVehicularDto.idEstatus !== undefined && createMantenimientoVehicularDto.idEstatus !== null) {
        const estatusExists = await this.catEstatusMantenimientoRepository.findOne({
          where: { id: createMantenimientoVehicularDto.idEstatus },
        });
        if (!estatusExists) {
          throw new BadRequestException(
            `El estatus de mantenimiento con ID ${createMantenimientoVehicularDto.idEstatus} no existe.`,
          );
        }
      }

      if (createMantenimientoVehicularDto.idTaller !== undefined && createMantenimientoVehicularDto.idTaller !== null) {
        const tallerExists = await this.talleresRepository.findOne({
          where: { id: createMantenimientoVehicularDto.idTaller },
        });
        if (!tallerExists) {
          throw new BadRequestException(
            `El taller con ID ${createMantenimientoVehicularDto.idTaller} no existe.`,
          );
        }
      }

      if (createMantenimientoVehicularDto.idInstalacion !== undefined && createMantenimientoVehicularDto.idInstalacion !== null) {
        const instalacionExists = await this.instalacionesRepository.findOne({
          where: { id: createMantenimientoVehicularDto.idInstalacion },
        });
        if (!instalacionExists) {
          throw new BadRequestException(
            `La instalación con ID ${createMantenimientoVehicularDto.idInstalacion} no existe.`,
          );
        }
      }

      if (createMantenimientoVehicularDto.idReferencia !== undefined && createMantenimientoVehicularDto.idReferencia !== null) {
        const referenciaExists = await this.catReferenciaServicioRepository.findOne({
          where: { id: createMantenimientoVehicularDto.idReferencia },
        });
        if (!referenciaExists) {
          throw new BadRequestException(
            `La referencia de servicio con ID ${createMantenimientoVehicularDto.idReferencia} no existe.`,
          );
        }
      }

      // Subir imagen de notaServicio a S3 si se proporciona
      let notaServicioUrl: string | null = null;
      if (notaServicioFile) {
        const uploadResult = await this.s3Service.uploadFile(
          notaServicioFile,
          'NotasServicioMantenimiento',
          idUser,
          5, // ID del módulo de mantenimiento vehicular
        );
        notaServicioUrl = uploadResult.url;
      }

      // Crear el registro con los datos del DTO (ya convertidos automáticamente)
      const dataToCreate = {
        ...createMantenimientoVehicularDto,
        notaServicio: notaServicioUrl,
      };

      const create = this.mantenimientoVehicularRepository.create(
        dataToCreate,
      );
      const savedResult = await this.mantenimientoVehicularRepository.save(create);
      const saved = Array.isArray(savedResult) ? savedResult[0] : savedResult;

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { createMantenimientoVehicularDto };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoVehicular',
        `Se creó un mantenimiento vehicular con ID: ${saved.id}`,
        'CREATE',
        querylogger,
        idUser,
        5,
        EstatusEnumBitcora.SUCCESS,
      );

      const idMantenimiento = saved.id;
      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Mantenimiento vehicular creado correctamente',
        data: {
          id: Number(idMantenimiento),
          nombre: `Mantenimiento #${idMantenimiento}`,
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      console.log(error); 
      const querylogger = { createMantenimientoVehicularDto };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoVehicular',
        `Error al crear mantenimiento vehicular`,
        'CREATE',
        querylogger,
        idUser,
        5,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException(
        'Se produjo un error al crear el mantenimiento vehicular.',
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

      const [data, total] = await this.mantenimientoVehicularRepository.findAndCount({
        where: Object.keys(whereCondition).length > 0 ? whereCondition : undefined,
        relations: ['instalacion', 'instalacion.vehiculos', 'instalacion.idCliente2', 'idEstatusRelacion', 'taller', 'referenciaServicio'],
        order: { fhRegistro: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

      // Forzamos ids a number
      const mantenimientos = data.map((item) => ({
        id: Number(item.id),
        idInstalacion: item.idInstalacion ? Number(item.idInstalacion) : null,
        idReferencia: item.idReferencia ? Number(item.idReferencia) : null,
        servicioDescripcion: item.servicioDescripcion,
        notaServicio: item.notaServicio,
        idEstatus: item.idEstatus ? Number(item.idEstatus) : null,
        fechaInicio: item.fechaInicio,
        fechaFinal: item.fechaFinal,
        idTaller: item.idTaller ? Number(item.idTaller) : null,
        costo: item.costo ? Number(item.costo) : null,
        encargado: item.encargado,
        fhRegistro: item.fhRegistro,
        estatus: item.estatus,
        placaVehiculo: item.instalacion?.vehiculos?.placa || null,
        imagenVehiculo: item.instalacion?.vehiculos?.foto || null,
        instalacion: item.instalacion ? {
          id: Number(item.instalacion.id),
        } : null,
        estatusMantenimiento: item.idEstatusRelacion ? {
          id: Number(item.idEstatusRelacion.id),
          nombre: item.idEstatusRelacion.nombre,
        } : null,
        taller: item.taller ? {
          id: Number(item.taller.id),
          nombre: item.taller.nombre,
        } : null,
        referenciaServicio: item.referenciaServicio ? {
          id: Number(item.referenciaServicio.id),
          nombre: item.referenciaServicio.nombre,
        } : null,
        // Incluir datos del cliente cuando el rol es 1 o 2
        cliente: (rol === 1 || rol === 2) && item.instalacion?.idCliente2 ? {
          id: Number(item.instalacion.idCliente2.id),
          nombre: item.instalacion.idCliente2.nombre,
          apellidoPaterno: item.instalacion.idCliente2.apellidoPaterno,
          apellidoMaterno: item.instalacion.idCliente2.apellidoMaterno,
          estatus: item.instalacion.idCliente2.estatus,
        } : null,
      }));

      const result: ApiResponseCommon = {
        data: mantenimientos,
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
        error.message || 'Error al obtener los mantenimientos vehiculares',
      );
    }
  }

  async findOne(id: number, idCliente: number, rol: number): Promise<ApiResponseCommon> {
    try {
      const mantenimiento = await this.mantenimientoVehicularRepository.findOne({
        where: { id: id },
        relations: ['instalacion', 'instalacion.vehiculos', 'instalacion.idCliente2', 'idEstatusRelacion', 'taller', 'referenciaServicio'],
      });

      // Verificar que el mantenimiento pertenece al cliente si el rol no es 1 o 2
      if (rol !== 1 && rol !== 2) {
        if (!mantenimiento || mantenimiento.instalacion?.idCliente !== idCliente) {
          throw new NotFoundException('Mantenimiento vehicular no encontrado');
        }
      }

      if (!mantenimiento) {
        throw new NotFoundException('Mantenimiento vehicular no encontrado');
      }

      const result: ApiResponseCommon = {
        data: [
          {
            id: Number(mantenimiento.id),
            idInstalacion: mantenimiento.idInstalacion ? Number(mantenimiento.idInstalacion) : null,
            idReferencia: mantenimiento.idReferencia ? Number(mantenimiento.idReferencia) : null,
            servicioDescripcion: mantenimiento.servicioDescripcion,
            notaServicio: mantenimiento.notaServicio,
            idEstatus: mantenimiento.idEstatus ? Number(mantenimiento.idEstatus) : null,
            fechaInicio: mantenimiento.fechaInicio,
            fechaFinal: mantenimiento.fechaFinal,
            idTaller: mantenimiento.idTaller ? Number(mantenimiento.idTaller) : null,
            costo: mantenimiento.costo ? Number(mantenimiento.costo) : null,
            encargado: mantenimiento.encargado,
            fhRegistro: mantenimiento.fhRegistro,
            estatus: mantenimiento.estatus,
            placaVehiculo: mantenimiento.instalacion?.vehiculos?.placa || null,
            imagenVehiculo: mantenimiento.instalacion?.vehiculos?.foto || null,
            instalacion: mantenimiento.instalacion ? {
              id: Number(mantenimiento.instalacion.id),
            } : null,
            estatusMantenimiento: mantenimiento.idEstatusRelacion ? {
              id: Number(mantenimiento.idEstatusRelacion.id),
              nombre: mantenimiento.idEstatusRelacion.nombre,
            } : null,
            taller: mantenimiento.taller ? {
              id: Number(mantenimiento.taller.id),
              nombre: mantenimiento.taller.nombre,
            } : null,
            referenciaServicio: mantenimiento.referenciaServicio ? {
              id: Number(mantenimiento.referenciaServicio.id),
              nombre: mantenimiento.referenciaServicio.nombre,
            } : null,
            // Incluir datos del cliente cuando el rol es 1 o 2
            cliente: (rol === 1 || rol === 2) && mantenimiento.instalacion?.idCliente2 ? {
              id: Number(mantenimiento.instalacion.idCliente2.id),
              nombre: mantenimiento.instalacion.idCliente2.nombre,
              apellidoPaterno: mantenimiento.instalacion.idCliente2.apellidoPaterno,
              apellidoMaterno: mantenimiento.instalacion.idCliente2.apellidoMaterno,
              estatus: mantenimiento.instalacion.idCliente2.estatus,
            } : null,
          },
        ],
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error interno al buscar el mantenimiento vehicular',
      );
    }
  }

  async update(
    id: number,
    updateMantenimientoVehicularDto: UpdateMantenimientoVehicularDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const mantenimiento = await this.mantenimientoVehicularRepository.findOne({
        where: { id: id },
      });
      if (!mantenimiento) {
        throw new NotFoundException('Mantenimiento vehicular no encontrado');
      }

      // Validar claves foráneas si se proporcionan
      if (updateMantenimientoVehicularDto.idEstatus !== undefined && updateMantenimientoVehicularDto.idEstatus !== null) {
        const estatusExists = await this.catEstatusMantenimientoRepository.findOne({
          where: { id: updateMantenimientoVehicularDto.idEstatus },
        });
        if (!estatusExists) {
          throw new BadRequestException(
            `El estatus de mantenimiento con ID ${updateMantenimientoVehicularDto.idEstatus} no existe.`,
          );
        }
      }

      if (updateMantenimientoVehicularDto.idTaller !== undefined && updateMantenimientoVehicularDto.idTaller !== null) {
        const tallerExists = await this.talleresRepository.findOne({
          where: { id: updateMantenimientoVehicularDto.idTaller },
        });
        if (!tallerExists) {
          throw new BadRequestException(
            `El taller con ID ${updateMantenimientoVehicularDto.idTaller} no existe.`,
          );
        }
      }

      if (updateMantenimientoVehicularDto.idInstalacion !== undefined && updateMantenimientoVehicularDto.idInstalacion !== null) {
        const instalacionExists = await this.instalacionesRepository.findOne({
          where: { id: updateMantenimientoVehicularDto.idInstalacion },
        });
        if (!instalacionExists) {
          throw new BadRequestException(
            `La instalación con ID ${updateMantenimientoVehicularDto.idInstalacion} no existe.`,
          );
        }
      }

      if (updateMantenimientoVehicularDto.idReferencia !== undefined && updateMantenimientoVehicularDto.idReferencia !== null) {
        const referenciaExists = await this.catReferenciaServicioRepository.findOne({
          where: { id: updateMantenimientoVehicularDto.idReferencia },
        });
        if (!referenciaExists) {
          throw new BadRequestException(
            `La referencia de servicio con ID ${updateMantenimientoVehicularDto.idReferencia} no existe.`,
          );
        }
      }

      await this.mantenimientoVehicularRepository.update(
        id,
        updateMantenimientoVehicularDto,
      );
      const mantenimientoResult = await this.mantenimientoVehicularRepository.findOne({
        where: { id: id },
      });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { updateMantenimientoVehicularDto };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoVehicular',
        `Se actualizó el mantenimiento vehicular con ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        5,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Mantenimiento vehicular actualizado correctamente',
        data: {
          id: id,
          nombre: `Mantenimiento #${id}`,
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { updateMantenimientoVehicularDto };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoVehicular',
        `Error al actualizar mantenimiento vehicular con ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        5,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException(
        'Se produjo un error al actualizar el mantenimiento vehicular.',
      );
    }
  }

  async desactivar(id: number, idUser: number): Promise<ApiCrudResponse> {
    try {
      const mantenimiento = await this.mantenimientoVehicularRepository.findOne({
        where: { id: id },
      });

      if (!mantenimiento) {
        throw new NotFoundException('Mantenimiento vehicular no encontrado');
      }

      await this.mantenimientoVehicularRepository.update(id, { estatus: 0 });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoVehicular',
        `Se desactivó el mantenimiento vehicular con ID: ${id}`,
        'UPDATE',
        querylogger,
        Number(idUser),
        5,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Mantenimiento vehicular desactivado correctamente',
        estatus: { estatus: 0 },
        data: {
          id: id,
          nombre: `Mantenimiento #${id}`,
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoVehicular',
        `Error al desactivar mantenimiento vehicular con ID: ${id}`,
        'UPDATE',
        querylogger,
        Number(idUser),
        5,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al desactivar el mantenimiento vehicular.',
        error: error.message,
      });
    }
  }

  async activar(id: number, idUser: number): Promise<ApiCrudResponse> {
    try {
      const mantenimiento = await this.mantenimientoVehicularRepository.findOne({
        where: { id: id },
      });

      if (!mantenimiento) {
        throw new NotFoundException('Mantenimiento vehicular no encontrado');
      }

      if (mantenimiento.estatus === 1) {
        throw new BadRequestException('El mantenimiento vehicular ya está activo');
      }

      await this.mantenimientoVehicularRepository.update(id, { estatus: 1 });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { id: id, estatus: 1 };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoVehicular',
        `Se activó el mantenimiento vehicular con ID: ${id}`,
        'UPDATE',
        querylogger,
        Number(idUser),
        5,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Mantenimiento vehicular activado correctamente',
        estatus: { estatus: 1 },
        data: {
          id: id,
          nombre: `Mantenimiento #${id}`,
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { id: id, estatus: 1 };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoVehicular',
        `Error al activar mantenimiento vehicular con ID: ${id}`,
        'UPDATE',
        querylogger,
        Number(idUser),
        5,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al activar el mantenimiento vehicular.',
        error: error.message,
      });
    }
  }
}
