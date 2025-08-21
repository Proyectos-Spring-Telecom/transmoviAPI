import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateOperadoreDto } from './dto/create-operadore.dto';
import { UpdateOperadoreDto } from './dto/update-operadore.dto';
import { UpdateOperadorStatusDto } from './dto/update-operadores-estatus.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Operadores } from 'src/entities/Operadores';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';

@Injectable()
export class OperadoresService {
  constructor(
    @InjectRepository(Operadores)
    private readonly operadoresRepository: Repository<Operadores>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}
  //Crear operador
  async createOperador(createOperadoreDto: CreateOperadoreDto, idUser: string) {
    try {
      const operadorExistente = await this.operadoresRepository.findOne({
        where: [ {correo: createOperadoreDto.Correo},{numeroLicencia: createOperadoreDto.NumeroLicencia} ],
      });
      if (operadorExistente) {
        throw new BadRequestException(
          `Operador con licencia: ${createOperadoreDto.NumeroLicencia} ú Operador con correo: ${createOperadoreDto.Correo} esta registrado`,
        );
      }
      const operadorData = await this.operadoresRepository.create({
        nombre: createOperadoreDto.Nombre,
        apellidoPaterno: createOperadoreDto.ApellidoPaterno,
        apellidoMaterno: createOperadoreDto.ApellidoMaterno,
        numeroLicencia: createOperadoreDto.NumeroLicencia,
        fechaNacimiento: createOperadoreDto.FechaNacimiento,
        correo: createOperadoreDto.Correo,
        telefono: createOperadoreDto.Telefono,
        estatus: createOperadoreDto.Estatus,
      });
      const operador = await this.operadoresRepository.save(operadorData);
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Operadores',
        `Se creó el operador con numero de licencia: ${createOperadoreDto.NumeroLicencia}`,
        'CREATE',
        `INSERT Operadores SET ... Se creó el operador:${createOperadoreDto.Nombre} ${createOperadoreDto.ApellidoPaterno} CREATE, INSERT INTO Operadores (Nombre, ApellidoPaterno, ApellidoMaterno, NumeroLicencia, FechaNacimiento, Correo, Telefono, Estatus) VALUES (${createOperadoreDto.Nombre}, ${createOperadoreDto.ApellidoPaterno}, ${createOperadoreDto.ApellidoMaterno}, ${createOperadoreDto.NumeroLicencia}, ${createOperadoreDto.FechaNacimiento}, ${createOperadoreDto.Correo}, ${createOperadoreDto.Telefono}, ${createOperadoreDto.Estatus})`,
        Number(idUser),
      );
      return { message: 'Operador creado exitosamente', operador };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({message: `Error al crear al operador`,error});
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
    idUser: string,
    updateOperadorStatusDto: UpdateOperadorStatusDto,
  ) {
    try {
      const operadorExistente = await this.operadoresRepository.findOne({
        where: { id },
      });
      if (!operadorExistente) {
        throw new NotFoundException(`Operador con id: ${id} no encontrado`);
      }
      const { Estatus } = updateOperadorStatusDto;
      await this.operadoresRepository.update(id, { estatus: Estatus });
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Operadores',
        `Se cambio el estatus a: ${Estatus} del operador con ID: ${id}`,
        'UPDATE',
        `UPDATE Operador SET Estatus = ${Estatus} WHERE Id=${id}`,
        Number(idUser),
      );
      return {
        message: `El operador con id: ${id} su estatus fue actualizado a ${Estatus}`,
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
  async updateOperador(
    id: number,
    idUser: string,
    updateOperadoreDto: UpdateOperadoreDto,
  ) {
    try {
      const operadorExistente = await this.operadoresRepository.findOne({
        where: { id },
      });
      if (!operadorExistente) {
        console.log(operadorExistente)
        throw new NotFoundException(`Operador con id: ${id} no encontrado`);
      }
      const operadorData = await this.operadoresRepository.create({
        nombre: updateOperadoreDto.Nombre,
        apellidoPaterno: updateOperadoreDto.ApellidoPaterno,
        apellidoMaterno: updateOperadoreDto.ApellidoMaterno,
        numeroLicencia: updateOperadoreDto.NumeroLicencia,
        fechaNacimiento: updateOperadoreDto.FechaNacimiento,
        correo: updateOperadoreDto.Correo,
        telefono: updateOperadoreDto.Telefono,
        estatus: updateOperadoreDto.Estatus,
      });
      await this.operadoresRepository.update(id, operadorData);
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Operadores',
        `Se actualizó el Operador con ID: ${id}`,
        'UPDATE',
        `UPDATE Operadores SET ... WHERE Id=${id}`,
        Number(idUser),
      );
      return await this.operadoresRepository.findOne({ where: { id } });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error al actualizar al operador`);
    }
  }
  //Eliminar Operador
  async removeOperador(id: number, idUser: string) {
    try {
      const operadorExistente = await this.operadoresRepository.findOne({
        where: { id },
      });
      if (!operadorExistente) {
        throw new NotFoundException(`Operador con id: ${id} no encontrado`);
      }
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Clientes',
        `Se eliminó el operador con ID: ${id}`,
        'DELETE',
        `DELETE FROM Operadores WHERE Id=${id}`,
        Number(idUser),
      );
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
