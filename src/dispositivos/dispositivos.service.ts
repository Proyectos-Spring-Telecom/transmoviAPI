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
import { ExposeDispositivoDto } from './dto/expose-dispositivo.dto';
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
        where: { numeroSerie: createDispositivoDto.NumeroSerie },
      });
      if (dispostivoExistente) {
        throw new BadRequestException(
          `Dispositivo con numero de serie ${createDispositivoDto.NumeroSerie} existente`,
        );
      }
      const dataDispositivo = await this.dispositivoRepository.create({
        numeroSerie: createDispositivoDto.NumeroSerie,
        marca: createDispositivoDto.Marca,
        modelo: createDispositivoDto.Modelo,
        estatus: createDispositivoDto.Estatus,
      });

      await this.dispositivoRepository.save(dataDispositivo);
      // --- Registro en la bitácora ---
      await this.bitacoraLogger.logToBitacora(
        'Dispositivos',
        `Se creó un dispositivo con numero de serie: ${createDispositivoDto.NumeroSerie}`,
        'CREATE',
        `INSERT Dispositivos -> NumeroSerie: ${createDispositivoDto.NumeroSerie}`, // opcional, puedes poner más info
        Number(idUser),
      );
      return {
        message: 'Dispositivo creado exitosamente',
        dispositivo: plainToInstance(ExposeDispositivoDto, dataDispositivo, {
          excludeExtraneousValues: true,
        }),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error al crear el dipositivo`);
    }
  }
  //Obtener todos los dispositivos
  async findAllDispositivos() {
    try {
      const dispostivosExistentes = await this.dispositivoRepository.find();
      if (dispostivosExistentes.length === 0) {
        throw new NotFoundException(`Dispositivo no encontrados`);
      }
      return {
        message: 'Dispositivos obtenidos exitosamente',
        dispositivos: plainToInstance(ExposeDispositivoDto, dispostivosExistentes, {
          excludeExtraneousValues: true,
        }),
      };
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
  async findOneDispositivo(id: number) {
    try {
      const dispostivoExistente = await this.dispositivoRepository.findOne({
        where: { id },
      });
      if (!dispostivoExistente) {
        throw new NotFoundException(`Dispositivo con id: ${id} no encontrado`);
      }
      return plainToInstance(ExposeDispositivoDto, dispostivoExistente, {
        excludeExtraneousValues: true,
      });
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
    id: number,
    idUser: string,
    updateDispositivoEstatusDto: UpdateDispositivoEstatusDto,
  ) {
    try {
      const dispostivoExistente = await this.dispositivoRepository.findOne({
        where: { id },
      });
      if (!dispostivoExistente) {
        throw new NotFoundException(`Dispositivo con ${id} no encontrado`);
      }
      const { estatus } = updateDispositivoEstatusDto;
      await this.dispositivoRepository.update(id, { estatus });
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Dispositivos',
        `Se cambio el estatus del cliente: ${id} a estatus: ${estatus}`,
        'CREATE',
        `UPDATE Dispositivos SET Estatus = ${estatus} WHERE id = ${id}`,
        Number(idUser),
      );
      return {message:`Estatus actualizado exitosamente a ${estatus}`,Estatus:Number(estatus)};
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
    id: number,
    idUser: string,
    updateDispositivoDto: UpdateDispositivoDto,
  ) {
    try {
      const dispostivoExistente = await this.dispositivoRepository.findOne({
        where: { id },
      });
      if (!dispostivoExistente) {
        throw new NotFoundException(`Dipositivo con ${id} no encontrado`);
      }
      const dataDispositivo = await this.dispositivoRepository.create({
        numeroSerie: updateDispositivoDto.NumeroSerie,
        marca: updateDispositivoDto.Marca,
        modelo: updateDispositivoDto.Modelo,
        estatus: updateDispositivoDto.Estatus,
      });
      await this.dispositivoRepository.update(id, dataDispositivo);
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Dispositivos',
        `Se actualizó el dispositivo con ID: ${id}`,
        'UPDATE',
        `UPDATE Dispositivo SET ... WHERE Id=${id}`,
        Number(idUser),
      );
      const dispositivoActualizado = await this.dispositivoRepository.findOne({ where: { id } });
      return {
        message: 'Dispositivo creado exitosamente',
        dispositivo: plainToInstance(ExposeDispositivoDto, dispositivoActualizado, {
          excludeExtraneousValues: true,
        }),
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
  async removeDispositivo(id: number, idUser: string) {
    try {
      const findDispositivo = await this.dispositivoRepository.findOne({
        where: { id },
      });
      if (!findDispositivo) {
        throw new NotFoundException(
          `El dispositivo con Id:${id} no fue encontrado`,
        );
      }
      await this.dispositivoRepository.remove(findDispositivo);
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Dispositivo',
        `Se eliminó el dispositivo con ID: ${id}`,
        'DELETE',
        `DELETE FROM Clientes WHERE Id=${id}`,
        Number(idUser),
      );
      return {message:`Dispositivo con id: ${id} eliminado exitosamente`,Id:Number(id)};
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
