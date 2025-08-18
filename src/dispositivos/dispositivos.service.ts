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
@Injectable()
export class DispositivosService {
  constructor(
    @InjectRepository(Dispositivos)
    private readonly dispositivoRepository: Repository<Dispositivos>,
  ) {}
  //Crear un nuevo dispositivo
  async createDispositivo(createDispositivoDto: CreateDispositivoDto) {
    try {
      const dispostivoExistente = await this.dispositivoRepository.findOne({
        where: { numeroSerie: createDispositivoDto.numeroSerie },
      });
      if (dispostivoExistente) {
        throw new BadRequestException(
          `Dispositivo con numero de serie ${createDispositivoDto.numeroSerie} existente`,
        );
      }
      const dipositivo =
        await this.dispositivoRepository.save(createDispositivoDto);
      return { message: 'Dispositivo creado exitosamente', data: dipositivo };
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
      if (!dispostivosExistentes) {
        throw new NotFoundException(`Dispositivo no encontrados`);
      }
      //falta el apartado de la bitacora
      return dispostivosExistentes;
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
      //falta apartado de la bitacora
      return dispostivoExistente;
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
      //Falta el apartado de la bitacora
      return `Estatus actualizado exitosamente a ${estatus}`;
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
    updateDispositivoDto: UpdateDispositivoDto,
  ) {
    try {
      const dispostivoExistente = await this.dispositivoRepository.findOne({
        where: { id },
      });
      if (!dispostivoExistente) {
        throw new NotFoundException(`Dipositivo con ${id} no encontrado`);
      }
      await this.dispositivoRepository.update(id, updateDispositivoDto);
      //Falta el apartado de la bitacora
      return await this.dispositivoRepository.findOne({ where: { id } });
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
  async removeDispositivo(id: number) {
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
      //Falta el apartado de la bitacora
      return `El dispositivo con id:${id} fue eliminado exitosamente`;
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
