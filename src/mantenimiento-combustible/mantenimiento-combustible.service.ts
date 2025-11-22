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
import { Instalaciones } from 'src/entities/Instalaciones';
import { Repository, In } from 'typeorm';
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
    @InjectRepository(Instalaciones)
    private readonly instalacionesRepository: Repository<Instalaciones>,
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

      const [data, total] = await this.mantenimientoCombustibleRepository.findAndCount({
        where: Object.keys(whereCondition).length > 0 ? whereCondition : undefined,
        relations: ['tipoCombustible', 'instalacion', 'instalacion.vehiculos', 'instalacion.idCliente2', 'operador', 'operador.idUsuario2'],
        order: { fhRegistro: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

      // Forzamos ids a number
      const mantenimientos = data.map((item) => {
        const nombreOperador = item.operador?.idUsuario2 
          ? `${item.operador.idUsuario2.nombre || ''} ${item.operador.idUsuario2.apellidoPaterno || ''} ${item.operador.idUsuario2.apellidoMaterno || ''}`.trim() || null
          : null;

        return {
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
          placaVehiculo: item.instalacion?.vehiculos?.placa || null,
          imagenVehiculo: item.instalacion?.vehiculos?.foto || null,
          nombreOperador: nombreOperador,
          tipoCombustible: item.tipoCombustible ? {
            id: Number(item.tipoCombustible.id),
            nombre: item.tipoCombustible.nombre,
          } : null,
          instalacion: item.instalacion ? {
            id: Number(item.instalacion.id),
          } : null,
          operador: item.operador ? {
            id: Number(item.operador.id),
          } : null,
          // Incluir datos del cliente cuando el rol es 1 o 2
          cliente: (rol === 1 || rol === 2) && item.instalacion?.idCliente2 ? {
            id: Number(item.instalacion.idCliente2.id),
            nombre: item.instalacion.idCliente2.nombre,
            apellidoPaterno: item.instalacion.idCliente2.apellidoPaterno,
            apellidoMaterno: item.instalacion.idCliente2.apellidoMaterno,
            estatus: item.instalacion.idCliente2.estatus,
          } : null,
        };
      });

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

  async findOne(id: number, idCliente: number, rol: number): Promise<ApiResponseCommon> {
    try {
      const mantenimiento = await this.mantenimientoCombustibleRepository.findOne({
        where: { id: id },
        relations: ['tipoCombustible', 'instalacion', 'instalacion.vehiculos', 'instalacion.idCliente2', 'operador', 'operador.idUsuario2'],
      });

      if (!mantenimiento) {
        throw new NotFoundException('Mantenimiento de combustible no encontrado');
      }

      // Verificar que el mantenimiento pertenece al cliente si el rol no es 1 o 2
      if (rol !== 1 && rol !== 2) {
        if (mantenimiento.instalacion?.idCliente !== idCliente) {
          throw new NotFoundException('Mantenimiento de combustible no encontrado');
        }
      }

      const nombreOperador = mantenimiento.operador?.idUsuario2 
        ? `${mantenimiento.operador.idUsuario2.nombre || ''} ${mantenimiento.operador.idUsuario2.apellidoPaterno || ''} ${mantenimiento.operador.idUsuario2.apellidoMaterno || ''}`.trim() || null
        : null;

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
            placaVehiculo: mantenimiento.instalacion?.vehiculos?.placa || null,
            imagenVehiculo: mantenimiento.instalacion?.vehiculos?.foto || null,
            nombreOperador: nombreOperador,
            tipoCombustible: mantenimiento.tipoCombustible ? {
              id: Number(mantenimiento.tipoCombustible.id),
              nombre: mantenimiento.tipoCombustible.nombre,
            } : null,
            instalacion: mantenimiento.instalacion ? {
              id: Number(mantenimiento.instalacion.id),
            } : null,
            operador: mantenimiento.operador ? {
              id: Number(mantenimiento.operador.id),
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
