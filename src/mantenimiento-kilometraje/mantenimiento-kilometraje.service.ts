import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateMantenimientoKilometrajeDto } from './dto/create-mantenimiento-kilometraje.dto';
import { UpdateMantenimientoKilometrajeDto } from './dto/update-mantenimiento-kilometraje.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { MantenimientoKilometraje } from 'src/entities/MantenimientoKilometraje';
import { Repository } from 'typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';

@Injectable()
export class MantenimientoKilometrajeService {
  constructor(
    @InjectRepository(MantenimientoKilometraje)
    private readonly mantenimientoKilometrajeRepository: Repository<MantenimientoKilometraje>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  async create(
    createMantenimientoKilometrajeDto: CreateMantenimientoKilometrajeDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const create = await this.mantenimientoKilometrajeRepository.create(
        createMantenimientoKilometrajeDto,
      );
      const saved = await this.mantenimientoKilometrajeRepository.save(create);

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { createMantenimientoKilometrajeDto };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoKilometraje',
        `Se creó un registro de mantenimiento por kilometraje con ID: ${saved.id}`,
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
        message: 'Mantenimiento por kilometraje creado correctamente',
        data: {
          id: Number(idMantenimiento),
          nombre: `Mantenimiento KM #${idMantenimiento}`,
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { createMantenimientoKilometrajeDto };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoKilometraje',
        `Error al crear mantenimiento por kilometraje`,
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
        'Se produjo un error al crear el mantenimiento por kilometraje.',
      );
    }
  }

  async findAll(page: number, limit: number): Promise<ApiResponseCommon> {
    try {
      const [data, total] = await this.mantenimientoKilometrajeRepository.findAndCount({
        relations: ['instalacion', 'instalacion.validadores', 'instalacion.contadores', 'instalacion.vehiculos', 'instalacion.idCliente2'],
        order: { fhRegistro: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

      // Forzamos ids a number
      const mantenimientos = data.map((item) => ({
        id: Number(item.id),
        idInstalacion: item.idInstalacion ? Number(item.idInstalacion) : null,
        kmInicial: item.kmInicial ? Number(item.kmInicial) : null,
        kmDeseado: item.kmDeseado ? Number(item.kmDeseado) : null,
        periodo: item.periodo,
        anio: item.anio,
        fhRegistro: item.fhRegistro,
        estatus: item.estatus,
        instalacion: item.instalacion ? {
          id: Number(item.instalacion.id),
        } : null,
        instalacionValidador: item.instalacion?.validadores ? {
          id: Number(item.instalacion.validadores.id),
          numeroSerie: item.instalacion.validadores.numeroSerie,
          marca: item.instalacion.validadores.marca,
          modelo: item.instalacion.validadores.modelo,
        } : null,
        instalacionContador: item.instalacion?.contadores ? {
          id: Number(item.instalacion.contadores.id),
          numeroSerie: item.instalacion.contadores.numeroSerie,
          marca: item.instalacion.contadores.marca,
          modelo: item.instalacion.contadores.modelo,
        } : null,
        instalacionVehiculo: item.instalacion?.vehiculos ? {
          id: Number(item.instalacion.vehiculos.id),
          marca: item.instalacion.vehiculos.marca,
          modelo: item.instalacion.vehiculos.modelo,
        } : null,
        instalacionCliente: item.instalacion?.idCliente2 ? {
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
        error.message || 'Error al obtener los mantenimientos por kilometraje',
      );
    }
  }

  async findOne(id: number): Promise<ApiResponseCommon> {
    try {
      const mantenimiento = await this.mantenimientoKilometrajeRepository.findOne({
        where: { id: id },
        relations: ['instalacion', 'instalacion.validadores', 'instalacion.contadores', 'instalacion.vehiculos', 'instalacion.idCliente2'],
      });
      if (!mantenimiento) {
        throw new NotFoundException('Mantenimiento por kilometraje no encontrado');
      }

      const result: ApiResponseCommon = {
        data: [
          {
            id: Number(mantenimiento.id),
            idInstalacion: mantenimiento.idInstalacion ? Number(mantenimiento.idInstalacion) : null,
            kmInicial: mantenimiento.kmInicial ? Number(mantenimiento.kmInicial) : null,
            kmDeseado: mantenimiento.kmDeseado ? Number(mantenimiento.kmDeseado) : null,
            periodo: mantenimiento.periodo,
            anio: mantenimiento.anio,
            fhRegistro: mantenimiento.fhRegistro,
            estatus: mantenimiento.estatus,
            instalacion: mantenimiento.instalacion ? {
              id: Number(mantenimiento.instalacion.id),
            } : null,
            instalacionValidador: mantenimiento.instalacion?.validadores ? {
              id: Number(mantenimiento.instalacion.validadores.id),
              numeroSerie: mantenimiento.instalacion.validadores.numeroSerie,
              marca: mantenimiento.instalacion.validadores.marca,
              modelo: mantenimiento.instalacion.validadores.modelo,
            } : null,
            instalacionContador: mantenimiento.instalacion?.contadores ? {
              id: Number(mantenimiento.instalacion.contadores.id),
              numeroSerie: mantenimiento.instalacion.contadores.numeroSerie,
              marca: mantenimiento.instalacion.contadores.marca,
              modelo: mantenimiento.instalacion.contadores.modelo,
            } : null,
            instalacionVehiculo: mantenimiento.instalacion?.vehiculos ? {
              id: Number(mantenimiento.instalacion.vehiculos.id),
              marca: mantenimiento.instalacion.vehiculos.marca,
              modelo: mantenimiento.instalacion.vehiculos.modelo,
            } : null,
            instalacionCliente: mantenimiento.instalacion?.idCliente2 ? {
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
        'Error interno al buscar el mantenimiento por kilometraje',
      );
    }
  }

  async update(
    id: number,
    updateMantenimientoKilometrajeDto: UpdateMantenimientoKilometrajeDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const mantenimiento = await this.mantenimientoKilometrajeRepository.findOne({
        where: { id: id },
      });
      if (!mantenimiento) {
        throw new NotFoundException('Mantenimiento por kilometraje no encontrado');
      }

      await this.mantenimientoKilometrajeRepository.update(
        id,
        updateMantenimientoKilometrajeDto,
      );
      const mantenimientoResult = await this.mantenimientoKilometrajeRepository.findOne({
        where: { id: id },
      });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { updateMantenimientoKilometrajeDto };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoKilometraje',
        `Se actualizó el mantenimiento por kilometraje con ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        5,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Mantenimiento por kilometraje actualizado correctamente',
        data: {
          id: id,
          nombre: `Mantenimiento KM #${id}`,
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { updateMantenimientoKilometrajeDto };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoKilometraje',
        `Error al actualizar mantenimiento por kilometraje con ID: ${id}`,
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
        'Se produjo un error al actualizar el mantenimiento por kilometraje.',
      );
    }
  }

  async desactivar(id: number, idUser: number): Promise<ApiCrudResponse> {
    try {
      const mantenimiento = await this.mantenimientoKilometrajeRepository.findOne({
        where: { id: id },
      });

      if (!mantenimiento) {
        throw new NotFoundException('Mantenimiento por kilometraje no encontrado');
      }

      await this.mantenimientoKilometrajeRepository.update(id, { estatus: 0 });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoKilometraje',
        `Se desactivó el mantenimiento por kilometraje con ID: ${id}`,
        'UPDATE',
        querylogger,
        Number(idUser),
        5,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Mantenimiento por kilometraje desactivado correctamente',
        estatus: { estatus: 0 },
        data: {
          id: id,
          nombre: `Mantenimiento KM #${id}`,
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoKilometraje',
        `Error al desactivar mantenimiento por kilometraje con ID: ${id}`,
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
        message: 'Error al desactivar el mantenimiento por kilometraje.',
        error: error.message,
      });
    }
  }

  async activar(id: number, idUser: number): Promise<ApiCrudResponse> {
    try {
      const mantenimiento = await this.mantenimientoKilometrajeRepository.findOne({
        where: { id: id },
      });

      if (!mantenimiento) {
        throw new NotFoundException('Mantenimiento por kilometraje no encontrado');
      }

      if (mantenimiento.estatus === 1) {
        throw new BadRequestException('El mantenimiento por kilometraje ya está activo');
      }

      await this.mantenimientoKilometrajeRepository.update(id, { estatus: 1 });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { id: id, estatus: 1 };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoKilometraje',
        `Se activó el mantenimiento por kilometraje con ID: ${id}`,
        'UPDATE',
        querylogger,
        Number(idUser),
        5,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Mantenimiento por kilometraje activado correctamente',
        estatus: { estatus: 1 },
        data: {
          id: id,
          nombre: `Mantenimiento KM #${id}`,
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { id: id, estatus: 1 };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoKilometraje',
        `Error al activar mantenimiento por kilometraje con ID: ${id}`,
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
        message: 'Error al activar el mantenimiento por kilometraje.',
        error: error.message,
      });
    }
  }
}
