import { HttpException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CreateMonederoDto } from './dto/create-monedero.dto';
import { UpdateMonederoDto } from './dto/update-monedero.dto';
import { UpdateMonederoEstatusDto } from './dto/update-monedero-estatus.dto';
import { UpdateMonederoSaldoDto } from './dto/update-monedero-saldo.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Monederos } from 'src/entities/Monederos';

@Injectable()
export class MonederosService {
  constructor(
    @InjectRepository(Monederos)
    private readonly monederoRepository: Repository<Monederos>
  ) {}
  //Crear un monedero
  async createMonedero(createMonederoDto: CreateMonederoDto) {
    try {
      const monederoExistente = await this.monederoRepository.findOne({where:{numeroSerie: createMonederoDto.numeroSerie}});
      if (monederoExistente) {
        throw new NotFoundException(`El monedero con numero de serie: ${createMonederoDto.numeroSerie} esta registrado`);
      }
      const monedero = await this.monederoRepository.save(createMonederoDto)
      //falta el apartado de la bitacora
      return {message: 'Monedero creado exitosamente', monedero}
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al crear el monedero')
    }
  }
  //Obtener todos los monederos
  async findAllMonederos() {
    try {
      const monederos = await this.monederoRepository.find();
      if (monederos.length ===0 ) {
        throw new NotFoundException('Monederos no encontrados')
      }
      //falta el apartado de la bitacora
      return monederos;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al obtener los monederos')
    }
  }
  //Obtener monedero por ID
  async findOneMonedero(id: number) {
    try {
      const monedero = await this.monederoRepository.findOne({where:{id}})
      if (!monedero) {
        throw new NotFoundException(`El monedero con id: ${id} no fue encontrado`);
      }
      //falta el apartado de la bitacora
      return await monedero;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al obtener el monedero')
    }
  }
  //Obtener monedero por numero de serie
  async findOneMonederoBySerie(numeroSerie: string) {
    try {
      const monedero = await this.monederoRepository.findOne({where:{numeroSerie}})
      if (!monedero) {
        throw new NotFoundException(`El monedero con numero de serie: ${numeroSerie} no fue encontrado`);
      }
      //falta el apartado de la bitacora
      return monedero;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al obtener el monedero por numero de serie')
    }
  }
  //Actualizar el estatus del monedero
  async updateMonederoEstatus(id: number, updateMonederoEstatusDto: UpdateMonederoEstatusDto) {
    try {
      const monederoExistente = await this.monederoRepository.findOne({where:{id}})
      if (!monederoExistente) {
        throw new NotFoundException(`El monedero con id: ${id} no fue encontrado`);
      }
      const {estatus} = updateMonederoEstatusDto;
      await this.monederoRepository.update(id,{estatus});
      //falta el apartado de la bitacora
      return await this.monederoRepository.findOne({where:{id}})
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al actualizar el estatus del monedero')
    }
  }
  //Actualizar saldo en el monedero
  async updateMonederoSaldo(id: number, updateMonederoSaldoDto: UpdateMonederoSaldoDto) {
    try {
      const monederoExistente = await this.monederoRepository.findOne({where:{id}})
      if (!monederoExistente) {
        throw new NotFoundException(`El monedero con id: ${id} no fue encontrado`);
      }
      const {saldo}  = updateMonederoSaldoDto;
      await this.monederoRepository.update(id,{saldo});
      //falta el apartado de la bitacora
      return await this.monederoRepository.findOne({where:{id}})
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al actualizar el saldo del monedero')
    }
  }
  //Actualizar el monedero
  async updateMonedero(id: number, updateMonederoDto: UpdateMonederoDto) {
    try {
      const monederoExistente = await this.monederoRepository.findOne({where:{id}})
      if (!monederoExistente) {
        throw new NotFoundException(`El monedero con id: ${id} no fue encontrado`);
      }
      await this.monederoRepository.update(id,updateMonederoDto);
      //Falta el apartado de la bitacora
      return await this.monederoRepository.findOne({where: {id}});
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al actualizar el monedero')
    }
  }
  //Eliminar monederos
  async removeMonedero(id: number) {
    try {
      const monederoExistente = await this.monederoRepository.findOne({where:{id}})
      if (!monederoExistente) {
        throw new NotFoundException(`El monedero con id: ${id} no fue encontrado`);
      }
      await this.monederoRepository.remove(monederoExistente);
      //falta el apartado de la bitacora
      return `El monedero con id: ${id} ha sido eliminado exitosamente`
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al eliminar el monedero')
    }
  }
}
