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
import { Repository } from 'typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
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
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  async create(
    createMantenimientoVehicularDto: CreateMantenimientoVehicularDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const create = await this.mantenimientoVehicularRepository.create(
        createMantenimientoVehicularDto,
      );
      const saved = await this.mantenimientoVehicularRepository.save(create);

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

  async findAll(page: number, limit: number): Promise<ApiResponseCommon> {
    try {
      const [data, total] = await this.mantenimientoVehicularRepository.findAndCount({
        relations: ['instalacion', 'idEstatusRelacion', 'taller', 'referenciaServicio'],
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
        idCentroServicio: item.idCentroServicio ? Number(item.idCentroServicio) : null,
        costo: item.costo ? Number(item.costo) : null,
        encargado: item.encargado,
        fhRegistro: item.fhRegistro,
        estatus: item.estatus,
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

  async findOne(id: number): Promise<ApiResponseCommon> {
    try {
      const mantenimiento = await this.mantenimientoVehicularRepository.findOne({
        where: { id: id },
        relations: ['instalacion', 'idEstatusRelacion', 'taller', 'referenciaServicio'],
      });
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
            idCentroServicio: mantenimiento.idCentroServicio ? Number(mantenimiento.idCentroServicio) : null,
            costo: mantenimiento.costo ? Number(mantenimiento.costo) : null,
            encargado: mantenimiento.encargado,
            fhRegistro: mantenimiento.fhRegistro,
            estatus: mantenimiento.estatus,
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
