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
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { ClientesService } from 'src/clientes/clientes.service';
@Injectable()
export class DispositivosService {
  constructor(
    @InjectRepository(Dispositivos)
    private readonly dispositivoRepository: Repository<Dispositivos>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly clientesService: ClientesService,
  ) {}
  //Crear un nuevo dispositivo
  async createDispositivo(
    createDispositivoDto: CreateDispositivoDto,
    idUser: string,
  ): Promise<ApiCrudResponse> {
    try {
      const dispositivo = await this.dispositivoRepository.findOne({
        where: { numeroSerie: createDispositivoDto.numeroSerie },
      });
      if (dispositivo) {
        throw new BadRequestException(
          `Dispositivo con numero de serie ${createDispositivoDto.numeroSerie} existente`,
        );
      }
      const cliente = await this.clientesService.getOneCliente(
        //Buscamos si existe el cliente
        createDispositivoDto.idCliente,
      );
      if (!cliente) throw new BadRequestException('Cliente Invalido');

      //Crear dispositivo
      const newDispositivo =
        await this.dispositivoRepository.create(createDispositivoDto);
      const dispositivoSave =
        await this.dispositivoRepository.save(newDispositivo);
      // --- Registro en la bitácora ---
      await this.bitacoraLogger.logToBitacora(
        'Dispositivos',
        `Se creó un dispositivo con numero de serie: ${createDispositivoDto.numeroSerie}`,
        'CREATE',
        `INSERT INTO Dispositivos (NumeroSerie, Marca, Modelo, Estatus) VALUES (${createDispositivoDto.numeroSerie}, ${createDispositivoDto.marca}, '${createDispositivoDto.modelo}', ${createDispositivoDto.estatus})`,
        Number(idUser),
        11,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Dispositivo creado correctamente',
        data: {
          id: Number(dispositivoSave.id),
          nombre:
            `${dispositivoSave.modelo} ${dispositivoSave.numeroSerie} ` || '',
        },
      };
      return result;
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
      const dispostivosExistentes = await this.dispositivoRepository.find({
        where: { estatus: 1 },
      });
      if (dispostivosExistentes.length === 0) {
        throw new NotFoundException(`Dispositivo no encontrados`);
      }
      const result: ApiResponseCommon = {
        data: dispostivosExistentes,
      };
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
  async findAllDispositivos(
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    try {
      const dispostivosExistentes = await this.dispositivoRepository.find();
      if (dispostivosExistentes.length === 0) {
        throw new NotFoundException(`Dispositivo no encontrados`);
      }
      const [data, total] = await this.dispositivoRepository.findAndCount({
        relations: [],
        skip: (page - 1) * limit,
        take: limit,
      });
      const result: ApiResponseCommon = {
        data,
        paginated: {
          total:total,
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
        `Error al obtener los dipositivos`,
      );
    }
  }
  //Obtener dispositivo por ID
  async findOneDispositivo(Id: number) {
    try {
      const dispostivoExistente = await this.dispositivoRepository.findOne({
        where: { id: Id },
      });
      if (!dispostivoExistente) {
        throw new NotFoundException(`Dispositivo con id: ${Id} no encontrado`);
      }
      return {
        data: dispostivoExistente,
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
    id: number,
    idUser: string,
    updateDispositivoEstatusDto: UpdateDispositivoEstatusDto,
  ) {
    try {
      const dispositivo = await this.dispositivoRepository.findOne({
        where: { id: id },
      });
      if (!dispositivo) {
        throw new NotFoundException(`Dispositivo con ${id} no encontrado`);
      }
      const { estatus } = updateDispositivoEstatusDto;
      await this.dispositivoRepository.update(id, {
        estatus: updateDispositivoEstatusDto.estatus,
      });
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Dispositivos',
        `Se cambio el estatus del cliente: ${id} a estatus: ${estatus}`,
        'CREATE',
        `UPDATE Dispositivos SET Estatus = ${estatus} WHERE id = ${id}`,
        Number(idUser),
        11,
      );
      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Estatus dispositivo actualizado correctamente',
        estatus: { estatus: estatus },
        data: {
          id: id,
          nombre: `${dispositivo.modelo} ${dispositivo.numeroSerie} ` || '',
        },
      };
      return result;
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
  ): Promise<ApiCrudResponse> {
    try {
      const dispostivoExistente = await this.dispositivoRepository.findOne({
        where: { id: id },
      });
      if (!dispostivoExistente) {
        throw new NotFoundException(`Dipositivo con ${id} no encontrado`);
      }

      if (!updateDispositivoDto.idCliente) {
        const cliente = await this.clientesService.getOneCliente(
          //Buscamos si existe el cliente
          Number(updateDispositivoDto.idCliente),
        );
        if (!cliente) throw new BadRequestException('Dispositivo Invalido');
      }

      //Actualindo dispositivo
      const dataDispositivo =
        await this.dispositivoRepository.create(updateDispositivoDto);
      await this.dispositivoRepository.update(id, dataDispositivo);

      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Dispositivos',
        `Se actualizó el dispositivo con id: ${id}`,
        'UPDATE',
        `UPDATE Dispositivos SET NumeroSerie='${updateDispositivoDto.numeroSerie}', Marca='${updateDispositivoDto.marca}', Modelo='${updateDispositivoDto.modelo}', Estatus=${updateDispositivoDto.estatus} WHERE id=${id}`,
        Number(idUser),
        11,
      );
      const dispositivoActualizado = await this.dispositivoRepository.findOne({
        where: { id: id },
      });

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Dispositivo actualizado correctamente',
        data: {
          id: id,
          nombre:
            `${dispositivoActualizado?.modelo} ${dispositivoActualizado?.numeroSerie} ` ||
            '',
        },
      };
      return result;
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
  async removeDispositivo(
    id: number,
    idUser: string,
  ): Promise<ApiCrudResponse> {
    try {
      const dispositivo = await this.dispositivoRepository.findOne({
        where: { id: id },
      });
      if (!dispositivo) {
        throw new NotFoundException(
          `El dispositivo con Id:${id} no fue encontrado`,
        );
      }
      await this.dispositivoRepository.update(id, { estatus: 0 });
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Dispositivo',
        `Se eliminó el dispositivo con ID: ${id}`,
        'DELETE',
        `DELETE FROM Clientes WHERE id=${id}`,
        Number(idUser),
        11,
      );
      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Dispositivo eliminado correctamente',
        data: {
          id: id,
          nombre: `${dispositivo.modelo} ${dispositivo.numeroSerie} ` || '',
        },
      };
      return result;
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
