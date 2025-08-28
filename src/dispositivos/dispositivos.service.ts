import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateDispositivoDto } from './dto/create-dispositivo.dto';
import { UpdateDispositivoDto } from './dto/update-dispositivo.dto';
import { UpdateDispositivoEstatusDto } from './dto/update-dispositivos-estatus.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dispositivos } from 'src/entities/Dispositivos';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { plainToInstance } from 'class-transformer';
import { ApiResponseCommon } from 'src/common/ApiResponse';
@Injectable()
export class DispositivosService {
  constructor(
    @InjectRepository(Dispositivos)
    private readonly dispositivoRepository: Repository<Dispositivos>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}
  //Crear un nuevo dispositivo
  async createDispositivo(
    createDispositivoDto: CreateDispositivoDto,
    idUser: string,
  ) {
    try {
      const dispostivoExistente = await this.dispositivoRepository.findOne({
        where: { NumeroSerie: createDispositivoDto.NumeroSerie },
      });
      if (dispostivoExistente) {
        throw new BadRequestException(
          `Dispositivo con numero de serie ${createDispositivoDto.NumeroSerie} existente`,
        );
      }
      const dataDispositivo = await this.dispositivoRepository.create(createDispositivoDto);

      await this.dispositivoRepository.save(dataDispositivo);
      // --- Registro en la bitácora ---
      await this.bitacoraLogger.logToBitacora(
        'Dispositivos',
        `Se creó un dispositivo con numero de serie: ${createDispositivoDto.NumeroSerie}`,
        'CREATE',
        `INSERT INTO Dispositivos (NumeroSerie, Marca, Modelo, Estatus) VALUES (${createDispositivoDto.NumeroSerie}, ${createDispositivoDto.Marca}, '${createDispositivoDto.Modelo}', ${createDispositivoDto.Estatus})`, 
        Number(idUser),
      );
      return {
      message: 'Dispositivo creado exitosamente',
      dispositivo: dataDispositivo,
    };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error al crear el dipositivo`);
    }
  }
    //Obtener todos los dispositivos
  async findAllListDispositivos(): Promise<ApiResponseCommon> {
    try {
      const dispostivosExistentes = await this.dispositivoRepository.find();
      if (dispostivosExistentes.length === 0) {
        throw new NotFoundException(`Dispositivo no encontrados`);
      }
      const result: ApiResponseCommon = {
        data:dispostivosExistentes,
        
        message:'Dispositivos obtenidos correctamente',
      }
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al obtener los dipositivos`,
      );
    }
  }
  //Obtener todos los dispositivos paginado
  async findAllDispositivos(page: number, limit: number):Promise<ApiResponseCommon> {
    try {
      const dispostivosExistentes = await this.dispositivoRepository.find();
      if (dispostivosExistentes.length === 0) {
        throw new NotFoundException(`Dispositivo no encontrados`);
      }
      const [data, total] = await this.dispositivoRepository.findAndCount({
        relations:[],
        skip: (page - 1)*limit,
        take:limit,
      });
      const result: ApiResponseCommon = {
        data,
        paginated: {
          total: Math.ceil(total/limit),
          page,
          limit,
        },
        message:'Dispositivos obtenidos correctamente',
      }
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al obtener los dipositivos`,
      );
    }
  }
  //Obtener dispositivo por ID
  async findOneDispositivo(Id: number) {
    try {
      const dispostivoExistente = await this.dispositivoRepository.findOne({
        where: { Id },
      });
      if (!dispostivoExistente) {
        throw new NotFoundException(`Dispositivo con id: ${Id} no encontrado`);
      }
      return {
        message: 'Dispositivo obtenido exitosamente',
        dispositivo: dispostivoExistente,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al obtener datos del dipositivo`,
      );
    }
  }
  //Actualizar el estatus del dispositivo
  async updateDispositivoEstatus(
    Id: number,
    idUser: string,
    updateDispositivoEstatusDto: UpdateDispositivoEstatusDto,
  ) {
    try {
      const dispostivoExistente = await this.dispositivoRepository.findOne({
        where: { Id },
      });
      if (!dispostivoExistente) {
        throw new NotFoundException(`Dispositivo con ${Id} no encontrado`);
      }
      const { Estatus } = updateDispositivoEstatusDto;
      await this.dispositivoRepository.update(Id, { estatus:updateDispositivoEstatusDto.Estatus });
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Dispositivos',
        `Se cambio el estatus del cliente: ${Id} a estatus: ${Estatus}`,
        'CREATE',
        `UPDATE Dispositivos SET Estatus = ${Estatus} WHERE id = ${Id}`,
        Number(idUser),
      );
      return {
        message: `Estatus actualizado exitosamente a ${Estatus}`,
        Estatus: Number(Estatus),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al actualizar estatus del dipositivo`,
      );
    }
  }
  //Actualizar datos de dispositivos
  async updateDispositivo(
    Id: number,
    idUser: string,
    updateDispositivoDto: UpdateDispositivoDto,
  ) {
    try {
      const dispostivoExistente = await this.dispositivoRepository.findOne({
        where: { Id },
      });
      if (!dispostivoExistente) {
        throw new NotFoundException(`Dipositivo con ${Id} no encontrado`);
      }
      const dataDispositivo = await this.dispositivoRepository.create(updateDispositivoDto);
      await this.dispositivoRepository.update(Id, dataDispositivo);
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Dispositivos',
        `Se actualizó el dispositivo con ID: ${Id}`,
        'UPDATE',
        `UPDATE Dispositivos SET NumeroSerie='${updateDispositivoDto.NumeroSerie}', Marca='${updateDispositivoDto.Marca}', Modelo='${updateDispositivoDto.Modelo}', Estatus=${updateDispositivoDto.Estatus} WHERE Id=${Id}`,
        Number(idUser),
      );
      const dispositivoActualizado = await this.dispositivoRepository.findOne({
        where: { Id },
      });
      return {
        message: 'Dsipositivo actualizado exitosamente',
        dispositivo: dispositivoActualizado,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al actualizar datos del dipositivo`,
      );
    }
  }
  //Eliminar Dispositivos
  async removeDispositivo(Id: number, idUser: string) {
    try {
      const findDispositivo = await this.dispositivoRepository.findOne({
        where: { Id },
      });
      if (!findDispositivo) {
        throw new NotFoundException(
          `El dispositivo con Id:${Id} no fue encontrado`,
        );
      }
      await this.dispositivoRepository.remove(findDispositivo);
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Dispositivo',
        `Se eliminó el dispositivo con ID: ${Id}`,
        'DELETE',
        `DELETE FROM Clientes WHERE Id=${Id}`,
        Number(idUser),
      );
      return {
        message: `Dispositivo con id: ${Id} eliminado exitosamente`,
        Id: Number(Id),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al eliminar el dispositivo`,
      );
    }
  }
}
