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
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';

@Injectable()
export class OperadoresService {
  constructor(
    @InjectRepository(Operadores)
    private readonly operadoresRepository: Repository<Operadores>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}
  //Crear operador
  async createOperador(
    createOperadoreDto: CreateOperadoreDto,
    idUser: string,
  ): Promise<ApiCrudResponse> {
    try {
      const operadorExistente = await this.operadoresRepository.findOne({
        where: { numeroLicencia: createOperadoreDto.numeroLicencia },
      });
      if (operadorExistente) {
        throw new BadRequestException(
          `Operador con licencia: ${createOperadoreDto.numeroLicencia} esta registrado`,
        );
      }

      //creamos al operador
      const newOperador =
        await this.operadoresRepository.create(createOperadoreDto);
      const operador = await this.operadoresRepository.save(newOperador);

      const operadorData = await this.operadoresRepository.findOne({
        where: { id: operador.id },
      });

      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Operadores',
        `Se creó el operador con numero de licencia: ${createOperadoreDto.numeroLicencia}`,
        'CREATE',
        `INSERT INTO Operadores (Nombre, ApellidoPaterno, ApellidoMaterno, NumeroLicencia, FechaNacimiento, Correo, Telefono, Estatus) VALUES (${operador.idUsuario2.nombre}, ${operador.idUsuario2.apellidoPaterno}, ${operador.idUsuario2.apellidoMaterno}, ${operador.numeroLicencia}, ${operador.fechaNacimiento}, ${operador.idUsuario2.userName}, ${operador.idUsuario2.telefono}, ${operador.idUsuario2.estatus})`,
        Number(idUser),
        9,
      );
      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Operador creado correctamente',
        data: {
          id: Number(operador.id),
          nombre:
            `id usuario:${operador.idUsuario} numero de licencia:${operador.numeroLicencia} ` ||
            '',
        },
      };
      return result;
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
  async findAllOperadores(
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    try {
      const query = this.operadoresRepository
        .createQueryBuilder('operador')
        .leftJoinAndSelect('operador.idUsuario2', 'usuario')
        .select([
          'operador', // incluye todos los campos de Operadores
          // selecciona solo los campos necesarios del usuario
          'usuario.id',
          'usuario.userName',
          'usuario.nombre',
          'usuario.apellidoPaterno',
          'usuario.apellidoMaterno',
          'usuario.telefono',
          'usuario.dispositivoId',
          'usuario.fotoPerfil',
          'usuario.fechaCreacion',
          'usuario.fechaActualizacion',
          'usuario.estatus',
          'usuario.idRol',
          'usuario.idCliente',
        ])
        .skip((page - 1) * limit)
        .take(limit);

      const [data, total] = await query.getManyAndCount();

      //Forzamos a cambiar el id a number
      const operadores = data.map((item) => ({
        ...item,
        id: Number(item.id),
      }));

      const result: ApiResponseCommon = {
        data: operadores,
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
      throw new InternalServerErrorException(
        `Error al obtener a los operadores`,
      );
    }
  }

  //Obtener todos los operadores
  async findAllListOperadores(): Promise<ApiResponseCommon> {
    try {
      const operadores = await this.operadoresRepository
        .createQueryBuilder('operador')
        .leftJoinAndSelect('operador.idUsuario2', 'usuario')
        .where('operador.estatus = :estatus', { estatus: 1 })
        .select([
          'operador', // todos los campos de la tabla Operadores
          // solo estos campos de Usuarios
          'usuario.id',
          'usuario.userName',
          'usuario.nombre',
          'usuario.apellidoPaterno',
          'usuario.apellidoMaterno',
          'usuario.telefono',
          'usuario.dispositivoId',
          'usuario.fotoPerfil',
          'usuario.fechaCreacion',
          'usuario.fechaActualizacion',
          'usuario.estatus',
          'usuario.idRol',
          'usuario.idCliente',
        ])
        .getMany();
      if (operadores.length === 0) {
        throw new BadRequestException('Operadores no encontrado o null');
      }

      //Forzamos a cambiar el id a number
      const data = operadores.map((item) => ({
        ...item,
        id: Number(item.id),
      }));
      const result: ApiResponseCommon = {
        data: data,
      };
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
  async findOneOperador(id: number) {
    try {
      const operador = await this.operadoresRepository
        .createQueryBuilder('operador')
        .leftJoin('operador.idUsuario2', 'usuario')
        .addSelect([
          'usuario.id',
          'usuario.userName',
          'usuario.nombre',
          'usuario.apellidoPaterno',
          'usuario.apellidoMaterno',
          'usuario.telefono',
          'usuario.dispositivoId',
          'usuario.fotoPerfil',
          'usuario.fechaCreacion',
          'usuario.fechaActualizacion',
          'usuario.estatus',
          'usuario.idRol',
          'usuario.idCliente',
        ])
        .where('operador.id = :id', { id })
        .getOne();
      if (!operador) {
        throw new NotFoundException(`Operador con id: ${id} no encontrado`);
      }
      operador.id = Number(operador.id)

      return {
        data: operador,
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
    id: number,
    idUser: string,
    updateOperadorStatusDto: UpdateOperadorStatusDto,
  ): Promise<ApiCrudResponse> {
    try {
      const operador = await this.operadoresRepository.findOne({
        where: { id: id },
      });
      if (!operador) {
        throw new NotFoundException(`Usuario id: ${id} con rol no encontrado`);
      }
      const { estatus } = updateOperadorStatusDto;
      await this.operadoresRepository.update(id, { estatus: estatus });
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Operadores',
        `Se cambio el estatus a: ${estatus} del operador con ID: ${id}`,
        'UPDATE',
        `UPDATE Operador SET estatus = ${estatus} WHERE id=${id}`,
        Number(idUser),
        9,
      );

      // ----- Api response -----
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Estatus del operador actualizado correctamente',
        estatus: { estatus: estatus },
        data: {
          id: id,
          nombre:
            `id usuario:${operador.idUsuario} con numero de licencia:${operador.numeroLicencia} ` ||
            '',
        },
      };
      return result;
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
      const operador = await this.operadoresRepository.findOne({
        where: { id: id },
      });
      if (!operador) {
        throw new NotFoundException(`Operador con id: ${id} no encontrado`);
      }
      const operadorData =
        await this.operadoresRepository.create(updateOperadoreDto);
      await this.operadoresRepository.update(id, operadorData);
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Operadores',
        `Se actualizó el Operador con ID: ${id}`,
        'UPDATE',
        `UPDATE Operadores SET ... WHERE id=${id}`,
        Number(idUser),
        9,
      );

      // ----- Api response -----
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Operador actualizado correctamente',
        data: {
          id: id,
          nombre:
            `id usuario:${operador.idUsuario} con numero de licencia:${operador.numeroLicencia} ` ||
            '',
        },
      };
      return result;
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
      const operador = await this.operadoresRepository.findOne({
        where: { id: id },
      });
      if (!operador) {
        throw new NotFoundException(`Operador con id: ${id} no encontrado`);
      }
      await this.operadoresRepository.update(id, { estatus: 0 });
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Operadores',
        `Se eliminó el operador con ID: ${id}`,
        'DELETE',
        `DELETE FROM Operadores WHERE id=${id}  `,
        Number(idUser),
        9,
      );

      // ----- Api response -----
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Operador eliminado correctamente',
        data: {
          id: id,
          nombre:
            `id usuario:${operador.idUsuario} con numero de licencia:${operador.numeroLicencia} ` ||
            '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error al eliminar al operador`);
    }
  }
}
