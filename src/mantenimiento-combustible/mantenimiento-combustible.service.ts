import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateMantenimientoCombustibleDto } from './dto/create-mantenimiento-combustible.dto';
import { UpdateMantenimientoCombustibleDto } from './dto/update-mantenimiento-combustible.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { MantenimientoCombustible } from 'src/entities/MantenimientoCombustible';
import { Repository } from 'typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';

@Injectable()
export class MantenimientoCombustibleService {
  constructor(
    @InjectRepository(MantenimientoCombustible)
    private readonly mantenimientoCombustibleRepository: Repository<MantenimientoCombustible>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  async create(
    createMantenimientoCombustibleDto: CreateMantenimientoCombustibleDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const create = await this.mantenimientoCombustibleRepository.create(
        createMantenimientoCombustibleDto,
      );
      const saved = await this.mantenimientoCombustibleRepository.save(create);

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { createMantenimientoCombustibleDto };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoCombustible',
        `Se creó un registro de mantenimiento de combustible con ID: ${saved.id}`,
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
        message: 'Mantenimiento de combustible creado correctamente',
        data: {
          id: Number(idMantenimiento),
          nombre: `Abastecimiento #${idMantenimiento}`,
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { createMantenimientoCombustibleDto };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoCombustible',
        `Error al crear mantenimiento de combustible`,
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
        'Se produjo un error al crear el mantenimiento de combustible.',
      );
    }
  }

  async findAll(page: number, limit: number): Promise<ApiResponseCommon> {
    try {
      const [data, total] = await this.mantenimientoCombustibleRepository.findAndCount({
        relations: ['tipoCombustible', 'instalacion', 'operador'],
        order: { fhRegistro: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

      // Forzamos ids a number
      const mantenimientos = data.map((item) => ({
        id: Number(item.id),
        idTipoCombustible: item.idTipoCombustible ? Number(item.idTipoCombustible) : null,
        cantidadCombustible: item.cantidadCombustible ? Number(item.cantidadCombustible) : null,
        precioCombustible: item.precioCombustible ? Number(item.precioCombustible) : null,
        idInstalacion: item.idInstalacion ? Number(item.idInstalacion) : null,
        estatus: item.estatus,
        fechaHora: item.fechaHora,
        fhRegistro: item.fhRegistro,
        kilometraje: item.kilometraje ? Number(item.kilometraje) : null,
        idOperador: item.idOperador ? Number(item.idOperador) : null,
        tipoCombustible: item.tipoCombustible ? {
          id: Number(item.tipoCombustible.id),
          nombre: item.tipoCombustible.nombre,
        } : null,
        instalacion: item.instalacion ? {
          id: Number(item.instalacion.id),
        } : null,
        operador: item.operador ? {
          id: Number(item.operador.id),
          numeroLicencia: item.operador.numeroLicencia,
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
        error.message || 'Error al obtener los mantenimientos de combustible',
      );
    }
  }

  async findOne(id: number): Promise<ApiResponseCommon> {
    try {
      const mantenimiento = await this.mantenimientoCombustibleRepository.findOne({
        where: { id: id },
        relations: ['tipoCombustible', 'instalacion', 'operador'],
      });
      if (!mantenimiento) {
        throw new NotFoundException('Mantenimiento de combustible no encontrado');
      }

      const result: ApiResponseCommon = {
        data: [
          {
            id: Number(mantenimiento.id),
            idTipoCombustible: mantenimiento.idTipoCombustible ? Number(mantenimiento.idTipoCombustible) : null,
            cantidadCombustible: mantenimiento.cantidadCombustible ? Number(mantenimiento.cantidadCombustible) : null,
            precioCombustible: mantenimiento.precioCombustible ? Number(mantenimiento.precioCombustible) : null,
            idInstalacion: mantenimiento.idInstalacion ? Number(mantenimiento.idInstalacion) : null,
            estatus: mantenimiento.estatus,
            fechaHora: mantenimiento.fechaHora,
            fhRegistro: mantenimiento.fhRegistro,
            kilometraje: mantenimiento.kilometraje ? Number(mantenimiento.kilometraje) : null,
            idOperador: mantenimiento.idOperador ? Number(mantenimiento.idOperador) : null,
            tipoCombustible: mantenimiento.tipoCombustible ? {
              id: Number(mantenimiento.tipoCombustible.id),
              nombre: mantenimiento.tipoCombustible.nombre,
            } : null,
            instalacion: mantenimiento.instalacion ? {
              id: Number(mantenimiento.instalacion.id),
            } : null,
            operador: mantenimiento.operador ? {
              id: Number(mantenimiento.operador.id),
              numeroLicencia: mantenimiento.operador.numeroLicencia,
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
        'Error interno al buscar el mantenimiento de combustible',
      );
    }
  }

  async update(
    id: number,
    updateMantenimientoCombustibleDto: UpdateMantenimientoCombustibleDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const mantenimiento = await this.mantenimientoCombustibleRepository.findOne({
        where: { id: id },
      });
      if (!mantenimiento) {
        throw new NotFoundException('Mantenimiento de combustible no encontrado');
      }

      await this.mantenimientoCombustibleRepository.update(
        id,
        updateMantenimientoCombustibleDto,
      );
      const mantenimientoResult = await this.mantenimientoCombustibleRepository.findOne({
        where: { id: id },
      });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { updateMantenimientoCombustibleDto };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoCombustible',
        `Se actualizó el mantenimiento de combustible con ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        5,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Mantenimiento de combustible actualizado correctamente',
        data: {
          id: id,
          nombre: `Abastecimiento #${id}`,
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { updateMantenimientoCombustibleDto };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoCombustible',
        `Error al actualizar mantenimiento de combustible con ID: ${id}`,
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
        'Se produjo un error al actualizar el mantenimiento de combustible.',
      );
    }
  }

  async desactivar(id: number, idUser: number): Promise<ApiCrudResponse> {
    try {
      const mantenimiento = await this.mantenimientoCombustibleRepository.findOne({
        where: { id: id },
      });

      if (!mantenimiento) {
        throw new NotFoundException('Mantenimiento de combustible no encontrado');
      }

      await this.mantenimientoCombustibleRepository.update(id, { estatus: 0 });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoCombustible',
        `Se desactivó el mantenimiento de combustible con ID: ${id}`,
        'UPDATE',
        querylogger,
        Number(idUser),
        5,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Mantenimiento de combustible desactivado correctamente',
        estatus: { estatus: 0 },
        data: {
          id: id,
          nombre: `Abastecimiento #${id}`,
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoCombustible',
        `Error al desactivar mantenimiento de combustible con ID: ${id}`,
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
        message: 'Error al desactivar el mantenimiento de combustible.',
        error: error.message,
      });
    }
  }

  async activar(id: number, idUser: number): Promise<ApiCrudResponse> {
    try {
      const mantenimiento = await this.mantenimientoCombustibleRepository.findOne({
        where: { id: id },
      });

      if (!mantenimiento) {
        throw new NotFoundException('Mantenimiento de combustible no encontrado');
      }

      if (mantenimiento.estatus === 1) {
        throw new BadRequestException('El mantenimiento de combustible ya está activo');
      }

      await this.mantenimientoCombustibleRepository.update(id, { estatus: 1 });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { id: id, estatus: 1 };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoCombustible',
        `Se activó el mantenimiento de combustible con ID: ${id}`,
        'UPDATE',
        querylogger,
        Number(idUser),
        5,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Mantenimiento de combustible activado correctamente',
        estatus: { estatus: 1 },
        data: {
          id: id,
          nombre: `Abastecimiento #${id}`,
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { id: id, estatus: 1 };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoCombustible',
        `Error al activar mantenimiento de combustible con ID: ${id}`,
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
        message: 'Error al activar el mantenimiento de combustible.',
        error: error.message,
      });
    }
  }
}
