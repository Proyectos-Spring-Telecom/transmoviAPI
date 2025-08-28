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
import { ApiResponseCommon } from 'src/common/ApiResponse';

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
        where: [
          { Correo: createOperadoreDto.Correo },
          { NumeroLicencia: createOperadoreDto.NumeroLicencia },
        ],
      });
      if (operadorExistente) {
        throw new BadRequestException(
          `Operador con licencia: ${createOperadoreDto.NumeroLicencia} ú Operador con correo: ${createOperadoreDto.Correo} esta registrado`,
        );
      }
      const operadorData = await this.operadoresRepository.create(createOperadoreDto);
      const operador = await this.operadoresRepository.save(operadorData);
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Operadores',
        `Se creó el operador con numero de licencia: ${createOperadoreDto.NumeroLicencia}`,
        'CREATE',
        `INSERT Operadores SET ... Se creó el operador:${createOperadoreDto.Nombre} ${createOperadoreDto.ApellidoPaterno} CREATE, INSERT INTO Operadores (Nombre, ApellidoPaterno, ApellidoMaterno, NumeroLicencia, FechaNacimiento, Correo, Telefono, Estatus) VALUES (${createOperadoreDto.Nombre}, ${createOperadoreDto.ApellidoPaterno}, ${createOperadoreDto.ApellidoMaterno}, ${createOperadoreDto.NumeroLicencia}, ${createOperadoreDto.FechaNacimiento}, ${createOperadoreDto.Correo}, ${createOperadoreDto.Telefono}, ${createOperadoreDto.Estatus})`,
        Number(idUser),
      );
      return {
        message: 'Operador creado exitosamente',
        operador: operador,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: `Error al crear al operador`,
        error,
      });
    }
  }
  //Obtener todos los operadores
  async findAllOperadores(page: number, limit: number): Promise<ApiResponseCommon> {
    try {
      const operadores = await this.operadoresRepository.find();
      if (operadores.length === 0) {
        throw new BadRequestException('Operadores no encontrado o null');
      }
      const [data,total] = await this.operadoresRepository.findAndCount({
        relations:[],
        skip: (page-1)*limit,
        take:limit,
      });
      const result:ApiResponseCommon = {
        data,
        paginated: {
          total: Math.ceil(total/limit),
          page,
          limit,
        },
        message: 'Operadores obtenidos correctamente'
      }
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al obtener a los operadores`,
      );
    }
  }

  //Obtener todos los operadores
  async findAllListOperadores(): Promise<ApiResponseCommon> {
    try {
      const operadores = await this.operadoresRepository.find();
      if (operadores.length === 0) {
        throw new BadRequestException('Operadores no encontrado o null');
      }
      const result:ApiResponseCommon = {
        data:operadores,
        
        message: 'Operadores obtenidos correctamente'
      }
      return result;
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
  async findOneOperador(Id: number) {
    try {
      const operador = await this.operadoresRepository.findOne({
        where: { Id },
      });
      if (!operador) {
        throw new NotFoundException(`Operador con id: ${Id} no encontrado`);
      }
      return {
        message: 'Operador obtenido exitosamente',
        operador: operador,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error al obtener al operador`);
    }
  }
  //Actualizar el estatus del operador
  async updateOperadorEstatus(
    Id: number,
    idUser: string,
    updateOperadorStatusDto: UpdateOperadorStatusDto,
  ) {
    try {
      const operadorExistente = await this.operadoresRepository.findOne({
        where: { Id },
      });
      if (!operadorExistente) {
        throw new NotFoundException(`Operador con id: ${Id} no encontrado`);
      }
      const { Estatus } = updateOperadorStatusDto;
      await this.operadoresRepository.update(Id, { estatus: Estatus });
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Operadores',
        `Se cambio el estatus a: ${Estatus} del operador con ID: ${Id}`,
        'UPDATE',
        `UPDATE Operador SET Estatus = ${Estatus} WHERE Id=${Id}`,
        Number(idUser),
      );
      return {
        message: `El operador con id: ${Id} su estatus fue actualizado a ${Estatus}`,
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
    Id: number,
    idUser: string,
    updateOperadoreDto: UpdateOperadoreDto,
  ) {
    try {
      const operadorExistente = await this.operadoresRepository.findOne({
        where: { Id },
      });
      if (!operadorExistente) {
        throw new NotFoundException(`Operador con id: ${Id} no encontrado`);
      }
      const operadorData = await this.operadoresRepository.create(updateOperadoreDto);
      await this.operadoresRepository.update(Id, operadorData);
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Operadores',
        `Se actualizó el Operador con ID: ${Id}`,
        'UPDATE',
        `UPDATE Operadores SET ... WHERE Id=${Id}`,
        Number(idUser),
      );
      return await this.operadoresRepository.findOne({ where: { Id } });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error al actualizar al operador`);
    }
  }
  //Eliminar Operador
  async removeOperador(Id: number, idUser: string) {
    try {
      const operadorExistente = await this.operadoresRepository.findOne({
        where: { Id },
      });
      if (!operadorExistente) {
        throw new NotFoundException(`Operador con id: ${Id} no encontrado`);
      }
      await this.operadoresRepository.remove(operadorExistente);
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Operadores',
        `Se eliminó el operador con ID: ${Id}`,
        'DELETE',
        `DELETE FROM Operadores WHERE Id=${Id}  `,
        Number(idUser),
      );
      return `Operador con id: ${Id} eliminado exitosamente`;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error al eliminar al operador`);
    }
  }
}
