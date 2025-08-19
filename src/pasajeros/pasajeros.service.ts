import { BadRequestException, HttpException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CreatePasajeroDto } from './dto/create-pasajero.dto';
import { UpdatePasajeroDto } from './dto/update-pasajero.dto';
import { UpdatePasajeroEstatusDto } from './dto/update-pasajeros-estatus.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pasajeros } from 'src/entities/Pasajeros';

@Injectable()
export class PasajerosService {
  constructor(
    @InjectRepository(Pasajeros)
    private readonly pasajeroRepository: Repository<Pasajeros>,
  ) {}
  async createPasajeros(createPasajeroDto: CreatePasajeroDto) {
    try {
      const pasajeroExistente = await this.pasajeroRepository.findOne({where:{nombre: createPasajeroDto.nombre,apellidoPaterno:createPasajeroDto.apellidoPaterno}});
      if (pasajeroExistente) {
        throw new BadRequestException(`El pasajero con id: ${createPasajeroDto.nombre} no fue encontrado`);
      }
      const clienteCreado = await this.pasajeroRepository.save(createPasajeroDto);
      //falta el apartado de la bitcora
      return{ message: 'Usuario creado exitosamente', clienteCreado };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al crear al pasajero');
    }
  }
  //Obtener todos los pasajeros
  async findAllPasajeros() {
    try {
      const pasajerosExistentes = await this.pasajeroRepository.find();
      if (pasajerosExistentes.length === 0) {
        throw new BadRequestException(`Pasajeros no encontrados`)
      }
      //falta el apartado de la bitacora
      return pasajerosExistentes;
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
      const pasajeroExistente = await this.pasajeroRepository.findOne({where:{id}});
      if (!pasajeroExistente) {
        throw new NotFoundException(`El pasajero con id: ${id} no fue encontrado`);
      }
      //falta apartado de bitacora
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
    id: number,
    updatePasajeroEstatusDto: UpdatePasajeroEstatusDto,
  ) {
    try {
      const pasajeroExistente = await this.pasajeroRepository.findOne({where:{id}});
      if (!pasajeroExistente) {
        throw new NotFoundException(`El pasajero con id: ${id} no fue encontrado`);
      }
      const { estatus } = updatePasajeroEstatusDto;
      await this.pasajeroRepository.update(id,{estatus});
      //falta el apartado de la bitacora
      return{
        message:`Cliente con id: ${id} su estatus fue actualizado a ${estatus}`
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al cambiar el estatus del pasajero');
    }
  }
  // Cambiar informacion del pasajero
  async updatePasajero(id: number, updatePasajeroDto: UpdatePasajeroDto) {
    try {
      const pasajeroExistente = await this.pasajeroRepository.findOne({where:{id}});
      if (!pasajeroExistente) {
        throw new NotFoundException(`El pasajero con id: ${id} no fue encontrado`);
      }
      await this.pasajeroRepository.update(id,updatePasajeroDto);
      return await this.pasajeroRepository.findOne({where: {id}});
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al actualizar al pasajero');
    }
  }
  //Eliminar pasajero por ID
  async removePasajero(id: number) {
    try {
      const pasajeroEliminar = await this.pasajeroRepository.findOne({where:{id}});
      if (!pasajeroEliminar) {
        throw new NotFoundException(`El pasajero con id: ${id} no fue encontrado`);
      }
      await this.pasajeroRepository.remove(pasajeroEliminar);
      return `Pasajero con id: ${id} eliminado exitosamente`;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al eliminar al pasajero');
    }
  }
}
