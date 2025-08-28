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
import { ApiResponseCommon } from 'src/common/ApiResponse';
@Injectable()
export class PasajerosService {
  constructor(
    @InjectRepository(Pasajeros)
    private readonly pasajeroRepository: Repository<Pasajeros>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}
  //Crear pasajero
  async createPasajeros(createPasajeroDto: CreatePasajeroDto,idUser: number) {
    try {
      const pasajeroExistente = await this.pasajeroRepository.findOne({
        where: {
          Nombre: createPasajeroDto.Nombre,
          ApellidoPaterno: createPasajeroDto.ApellidoPaterno,
        },
      });
      if (pasajeroExistente) {
        throw new BadRequestException(
          `El pasajero con id: ${createPasajeroDto.Nombre} no fue encontrado`,
        );
      }
      const clienteCreado =
        await this.pasajeroRepository.save(createPasajeroDto);
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Pasajeros',
        `Se creó un pasajero con nombre: ${createPasajeroDto.Nombre}`,
        'CREATE',
        `INSERT INTO Pasajeros (...) VALUES (...) ->  nombre: ${createPasajeroDto.Nombre} apellido paterno: ${createPasajeroDto.ApellidoPaterno} apellido materno: ${createPasajeroDto.ApellidoMaterno}`,
        Number(idUser),
      );
      return { message: 'Usuario creado exitosamente', clienteCreado };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al crear al pasajero');
    }
  }
  //Obtener todos los pasajeros
  async findAllPasajeros(page: number, limit: number): Promise<ApiResponseCommon> {
    try {
      const pasajerosExistentes = await this.pasajeroRepository.find();
      if (pasajerosExistentes.length === 0) {
        throw new BadRequestException(`Pasajeros no encontrados`);
      }
      const[data, total] = await this.pasajeroRepository.findAndCount({
        relations:[],
        skip:(page - 1)*limit,
        take: limit,
      });
      const result:ApiResponseCommon = {
        data,
        paginated: {
          total: Math.ceil(total/limit),
          page,
          limit,
        },
        message: 'Pasajeros obtenidos correctamente'
      }
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
      const pasajerosExistentes = await this.pasajeroRepository.find();
      if (pasajerosExistentes.length === 0) {
        throw new BadRequestException(`Pasajeros no encontrados`);
      }
      const result:ApiResponseCommon = {
        data:pasajerosExistentes,
        
        message: 'Pasajeros obtenidos correctamente'
      }
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al obtener los pasajeros');
    }
  }
  //Obtener pasajero por ID
  async findOnePasajero(Id: number) {
    try {
      const pasajeroExistente = await this.pasajeroRepository.findOne({
        where: { Id },
      });
      if (!pasajeroExistente) {
        throw new NotFoundException(
          `El pasajero con id: ${Id} no fue encontrado`,
        );
      }
      return pasajeroExistente;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al obtener al pasajero');
    }
  }
  //Cambiar estatus del pasajero
  async updatePasajeroEstatus(
    Id: number,
    updatePasajeroEstatusDto: UpdatePasajeroEstatusDto,
    idUser: number
  ) {
    try {
      const pasajeroExistente = await this.pasajeroRepository.findOne({
        where: { Id },
      });
      if (!pasajeroExistente) {
        throw new NotFoundException(
          `El pasajero con id: ${Id} no fue encontrado`,
        );
      }
      const { Estatus } = updatePasajeroEstatusDto;
      await this.pasajeroRepository.update(Id, { Estatus });
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Pasajero',
        `Se cambio del modulo ${pasajeroExistente.Nombre} con id: ${Id} a estatus: ${Estatus}`,
        'UPDATE',
        `UPDATE Pasajeros SET Estatus = ${Estatus} WHERE id = ${Id}`,
        Number(idUser),
      );
      return {
        message: `Cliente con id: ${Id} su estatus fue actualizado a ${Estatus}`,
      };
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
  async updatePasajero(Id: number,idUser: number, updatePasajeroDto: UpdatePasajeroDto) {
    try {
      const pasajeroExistente = await this.pasajeroRepository.findOne({
        where: { Id },
      });
      if (!pasajeroExistente) {
        throw new NotFoundException(
          `El pasajero con id: ${Id} no fue encontrado`,
        );
      }
      await this.pasajeroRepository.update(Id, updatePasajeroDto);
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Pasajeros',
        `Se cambio del datos del pasajero: ${pasajeroExistente.Nombre} con id: ${Id}`,
        'UPDATE',
        `UPDATE Modulos SET (...) WHERE id = ${Id}`,
        Number(idUser),
      );
      return await this.pasajeroRepository.findOne({ where: { Id } });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al actualizar al pasajero');
    }
  }
  //Eliminar pasajero por ID
  async removePasajero(Id: number,idUser: number) {
    try {
      const pasajeroEliminar = await this.pasajeroRepository.findOne({
        where: { Id },
      });
      if (!pasajeroEliminar) {
        throw new NotFoundException(
          `El pasajero con id: ${Id} no fue encontrado`,
        );
      }
      await this.pasajeroRepository.remove(pasajeroEliminar);
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Pasajeros',
        `Se elimino pasajero: ${pasajeroEliminar.Nombre} con id: ${Id}`,
        'DELETE',
        `DELETE FROM Pasajeros WHERE Id=${Id}`,
        Number(idUser),
      );
      return `Pasajero con id: ${Id} eliminado exitosamente`;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al eliminar al pasajero');
    }
  }
}
