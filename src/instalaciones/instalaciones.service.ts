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

@Injectable()
export class InstalacionesService {
  constructor(
    @InjectRepository(Instalaciones)
    private readonly instalacionesRepository: Repository<Instalaciones>,
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
      where: { idDispositivo: createInstalacioneDto.idDispositivo, estatus: 1 },
      relations: ['dispositivos']
    });
    if (dispositivoEnUso) {
      errores.push(`Dispositivo "${dispositivoEnUso.dispositivos.numeroSerie}" ya está en uso`);
    }

    // Verificar BlueVox CON relaciones
    const blueVoxEnUso = await this.instalacionesRepository.findOne({
      where: { idBlueVox: createInstalacioneDto.idBlueVox, estatus: 1 },
      relations: ['blueVoxs']
    });
    if (blueVoxEnUso) {
      errores.push(`BlueVox "${blueVoxEnUso.blueVoxs.numeroSerie}" ya está en uso`);
    }

    // Verificar Vehículo CON relaciones
    const vehiculoEnUso = await this.instalacionesRepository.findOne({
      where: { idVehiculo: createInstalacioneDto.idVehiculo, estatus: 1 },
      relations: ['vehiculos']
    });
    if (vehiculoEnUso) {
      errores.push(`Vehículo con placa "${vehiculoEnUso.vehiculos.placa}" ya está en uso`);
    }

    // Si hay conflictos, lanzar error con todos los detalles
    if (errores.length > 0) {
      throw new BadRequestException({
        message: 'No se puede crear la instalación debido a los siguientes conflictos',
        errors: errores,
        conflictsCount: errores.length
      });
    }

    // Crear instalación y guardarla en la base de datos
    const newInstalaciones = await this.instalacionesRepository.create(
      createInstalacioneDto,
    );
    const instalacionSave = await this.instalacionesRepository.save(newInstalaciones);

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
        details: 'Verifica que los IDs de Cliente, Dispositivo, BlueVox y Vehículo sean válidos y existan en el sistema',
        sqlError: 'La combinación Cliente-Dispositivo no es válida'
      });
    }

    throw new InternalServerErrorException({
      message: 'Error al crear Instalación',
      error: error.message, // ✅ Solo el mensaje, no todo el objeto
    });
  }
}

  async findAll(page: number, limit: number): Promise<ApiResponseCommon> {
    try {
      const [data, total] = await this.instalacionesRepository.findAndCount({
        skip: (page - 1) * limit,
        take: limit,
      });

      //Forzamos a cambiar el id a number
      const instalaciones = data.map((item) => ({
        ...item,
        id: Number(item.id),
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

  async findAllList(): Promise<ApiResponseCommon> {
    try {
      //Obtenemos ConteoPasajeros
      const instalaciones = await this.instalacionesRepository.find();
      if (instalaciones.length === 0) {
        throw new NotFoundException('Instalaciones no encontrado');
      }

      //Forzamos a cambiar el id a number
      const data = instalaciones.map((item) => ({
        ...item,
        id: Number(item.id),
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

  async findOne(id: number) {
    try {
      const instalaciones = await this.instalacionesRepository.findOne({
        where: { id: id },
      });
      if (!instalaciones) {
        throw new NotFoundException('instalaciones no encontrado');
      }

      //cambiamos el id a number
      instalaciones.id = Number(instalaciones.id);

      return { data: instalaciones };
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
    idUser: string,
    updateInstalacioneEstatusDto: UpdateInstalacioneEstatusDto,
  ) {
    try {
      const instalacion = await this.instalacionesRepository.findOne({
        where: { id: id },
      });
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
    idUser: string,
    updateInstalacioneDto: UpdateInstalacioneDto,
  ) {
    try {
      const instalacion = await this.instalacionesRepository.findOne({
        where: { id: id },
      });
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
        `Error al actualizar de instalaciones con id: ${id}`,
      );
    }
  }

  async remove(id: number, idUser: string) {
    try {
      const instalacion = await this.instalacionesRepository.findOne({
        where: { id: id },
      });
      if (!instalacion) {
        throw new NotFoundException(
          `Instalaciones con id: ${id} no encontrado`,
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
    } catch (error) {}
  }
}
