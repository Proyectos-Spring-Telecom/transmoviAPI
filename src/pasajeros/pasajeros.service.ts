import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreatePasajeroDto } from './dto/create-pasajero.dto';
import { UpdatePasajeroDto } from './dto/update-pasajero.dto';
import { UpdatePasajeroEstatusDto } from './dto/update-pasajeros-estatus.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pasajeros } from 'src/entities/Pasajeros';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
@Injectable()
export class PasajerosService {
  constructor(
    @InjectRepository(Pasajeros)
    private readonly pasajeroRepository: Repository<Pasajeros>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}
  //Crear pasajero
  async createPasajeros(
    createPasajeroDto: CreatePasajeroDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const pasajero = await this.pasajeroRepository.findOne({
        where: {
          correo: createPasajeroDto.correo,
        },
      });
      if (pasajero) {
        throw new BadRequestException(
          `El pasajero con correo: ${createPasajeroDto.correo}  ya existe`,
        );
      }
      const newPasajero =
        await this.pasajeroRepository.create(createPasajeroDto);
      const pasajeroSave = await this.pasajeroRepository.save(newPasajero);
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Pasajeros',
        `Se creó un pasajero con nombre: ${createPasajeroDto.nombre}`,
        'CREATE',
        `INSERT INTO Pasajeros (...) VALUES (...) ->  nombre: ${createPasajeroDto.nombre} apellido paterno: ${createPasajeroDto.apellidoPaterno} apellido materno: ${createPasajeroDto.apellidoMaterno}`,
        Number(idUser),
        21,
      );

      //API response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Pasajero creado correctamente',
        data: {
          id: Number(pasajeroSave.id),
          nombre:
            `${pasajeroSave.nombre} ${pasajeroSave.apellidoPaterno} ` || '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al crear al pasajero');
    }
  }
  //Obtener todos los pasajeros
  async findAllPasajeros(
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    try {
      const pasajerosExistentes = await this.pasajeroRepository.find();
      if (pasajerosExistentes.length === 0) {
        throw new BadRequestException(`Pasajeros no encontrados`);
      }
      const [data, total] = await this.pasajeroRepository.findAndCount({
        relations: [],
        skip: (page - 1) * limit,
        take: limit,
      });
      const result: ApiResponseCommon = {
        data,
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
      throw new InternalServerErrorException('Error al obtener los pasajeros');
    }
  }
  //Obtener todos los pasajeros
  async findAllListPasajeros(): Promise<ApiResponseCommon> {
    try {
      const pasajerosExistentes = await this.pasajeroRepository.find({
        where: { estatus: 1 },
      });
      if (pasajerosExistentes.length === 0) {
        throw new BadRequestException(`Pasajeros no encontrados`);
      }
      const result: ApiResponseCommon = {
        data: pasajerosExistentes,
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al obtener los pasajeros');
    }
  }
  //Obtener pasajero por ID
  async findOnePasajero(id: number) {
    try {
      const pasajeroExistente = await this.pasajeroRepository.findOne({
        where: { id: id },
      });
      if (!pasajeroExistente) {
        throw new NotFoundException(
          `El pasajero con id: ${id} no fue encontrado`,
        );
      }
      return { data: pasajeroExistente };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al obtener al pasajero');
    }
  }
  //Cambiar estatus del pasajero
  async updatePasajeroEstatus(
    id: number,
    updatePasajeroEstatusDto: UpdatePasajeroEstatusDto,
    idUser: number,
  ) {
    try {
      const pasajero = await this.pasajeroRepository.findOne({
        where: { id: id },
      });
      if (!pasajero) {
        throw new NotFoundException(
          `El pasajero con id: ${id} no fue encontrado`,
        );
      }
      const { estatus } = updatePasajeroEstatusDto;
      await this.pasajeroRepository.update(id, { estatus });
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Pasajero',
        `Se cambio del modulo ${pasajero.nombre} con id: ${id} a estatus: ${estatus}`,
        'UPDATE',
        `UPDATE Pasajeros SET Estatus = ${estatus} WHERE id = ${id}`,
        Number(idUser),
        21,
      );
      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Estatus pasajero actualizado correctamente',
        estatus: { estatus: estatus },
        data: {
          id: id,
          nombre: `${pasajero.nombre} ${pasajero.apellidoPaterno} ` || '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error al cambiar el estatus del pasajero',
      );
    }
  }

  // Cambiar informacion del pasajero
  async updatePasajero(
    id: number,
    idUser: number,
    updatePasajeroDto: UpdatePasajeroDto,
  ): Promise<ApiCrudResponse> {
    try {
      const pasajero = await this.pasajeroRepository.findOne({
        where: { id: id },
      });
      if (!pasajero) {
        throw new NotFoundException(
          `El pasajero con id: ${id} no fue encontrado`,
        );
      }
      await this.pasajeroRepository.update(id, updatePasajeroDto);
      const pasajeroSave = await this.pasajeroRepository.findOne({
        where: { id: id },
      });
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Pasajeros',
        `Se cambio del datos del pasajero: ${pasajero.nombre} con id: ${id}`,
        'UPDATE',
        `UPDATE Modulos SET (...) WHERE id = ${id}`,
        Number(idUser),
        21,
      );
      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Pasajero actualizado correctamente',
        data: {
          id: id,
          nombre:
            `${pasajeroSave?.nombre} ${pasajeroSave?.apellidoPaterno} ` || '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al actualizar al pasajero');
    }
  }
  //Eliminar pasajero por ID
  async removePasajero(id: number, idUser: number) {
    try {
      const pasajero = await this.pasajeroRepository.findOne({
        where: { id: id },
      });
      if (!pasajero) {
        throw new NotFoundException(
          `El pasajero con id: ${id} no fue encontrado`,
        );
      }
      await this.pasajeroRepository.update(id, { estatus: 0 });
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Pasajeros',
        `Se elimino pasajero: ${pasajero.nombre} con id: ${id}`,
        'DELETE',
        `DELETE FROM Pasajeros WHERE id=${id}`,
        Number(idUser),
        21,
      );
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Pasajero eliminado correctamente',
        data: {
          id: Number(pasajero.id),
          nombre:
            `${pasajero.nombre} ${pasajero.apellidoPaterno} ` || '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al eliminar al pasajero');
    }
  }
}
