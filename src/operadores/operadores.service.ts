import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateOperadoreDto } from './dto/create-operadore.dto';
import { UpdateOperadoreDto } from './dto/update-operadore.dto';
import { UpdateOperadorStatusDto } from './dto/update-operadores.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Operadores } from 'src/entities/Operadores';

@Injectable()
export class OperadoresService {
  constructor(
    @InjectRepository(Operadores)
    private readonly operadoresRepository: Repository<Operadores>,
  ) {}
  async createOperador(createOperadoreDto: CreateOperadoreDto) {
    try {
      const operadorExistente = await this.operadoresRepository.findOne({
        where: { numeroLicencia: createOperadoreDto.numeroLicencia },
      });
      if (operadorExistente) {
        throw new BadRequestException(
          `Operador con licencia: ${createOperadoreDto.numeroLicencia} esta registrado`,
        );
      }
      const operador = await this.operadoresRepository.save(createOperadoreDto);
      return { message: 'Operador creado exitosamente', operador };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error al crear al operador`);
    }
  }
  //Obtener todos los operadores
  async findAllOperadores() {
    try {
      const operadores = await this.operadoresRepository.find();
      if (operadores.length === 0) {
        throw new BadRequestException('Operadores no encontrado o null');
      }
      //falta el apartado de la bitacora
      return operadores;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al obtener a los operadores`,
      );
    }
  }
  //Obtener operador por ID
  async findOneOperador(id: number) {
    try {
      const operador = await this.operadoresRepository.findOne({
        where: { id },
      });
      if (!operador) {
        throw new NotFoundException(`Operador con id: ${id} no encontrado`);
      }
      //falta el apartado de la bitacora
      return operador;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error al obtener al operador`);
    }
  }
  //Actualizar el estatus del operador
  async updateOperadorEstatus(
    id: number,
    updateOperadorStatusDto: UpdateOperadorStatusDto,
  ) {
    try {
      const operadorExistente = await this.operadoresRepository.findOne({
        where: { id },
      });
      if (!operadorExistente) {
        throw new NotFoundException(`Operador con id: ${id} no encontrado`);
      }
      const { estatus } = updateOperadorStatusDto;
      await this.operadoresRepository.update(id, { estatus });
      //falta el apartado de la bitacora
      return {
        message: `El operador con id: ${id} su estatus fue actualizado a ${estatus}`,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al actualizar el estatus al operador`,
      );
    }
  }
  //Actualizar datos del operador
  async updateOperador(id: number, updateOperadoreDto: UpdateOperadoreDto) {
    try {
      const operadorExistente = await this.operadoresRepository.findOne({
        where: { id },
      });
      if (!operadorExistente) {
        throw new NotFoundException(`Operador con id: ${id} no encontrado`);
      }
      await this.operadoresRepository.update(id, updateOperadoreDto);
      //falta el apartado de la bitacora
      return await this.operadoresRepository.findOne({ where: { id } });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error al actualizar al operador`);
    }
  }
  //Eliminar Operador
  async removeOperador(id: number) {
    try {
      const operadorExistente = await this.operadoresRepository.findOne({
        where: { id },
      });
      if (!operadorExistente) {
        throw new NotFoundException(`Operador con id: ${id} no encontrado`);
      }
      //falta el apartado de la bitacora
      await this.operadoresRepository.remove(operadorExistente);
      return `Operador con id: ${id} eliminado exitosamente`;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error al eliminar al operador`);
    }
  }
}
