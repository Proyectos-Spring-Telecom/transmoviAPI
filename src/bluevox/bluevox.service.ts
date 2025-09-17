import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateBlueVoxsDto } from './dto/create-bluevox.dto';
import { UpdateBluevoxDto } from './dto/update-bluevox.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { InjectRepository } from '@nestjs/typeorm';
import { BlueVoxs } from 'src/entities/BlueVoxs';
import { Repository } from 'typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { UpdateBlueVoxEstatusDto } from './dto/update-bluevox-estatus.dto';

@Injectable()
export class BluevoxService {
  constructor(
    @InjectRepository(BlueVoxs)
    private readonly bluevoxsRepository: Repository<BlueVoxs>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  //Crear Bluevoxs
  async create(
    idUser: string,
    createBlueVoxDto: CreateBlueVoxsDto,
  ): Promise<ApiCrudResponse> {
    try {
      const blueVoxs = await this.bluevoxsRepository.findOne({
        where: { numeroSerie: createBlueVoxDto.numeroSerie },
      });
      if (blueVoxs) {
        throw new BadRequestException(
          `Bluevox registrado con Numero de Serie: ${blueVoxs.numeroSerie}, ingrese otro bluevoxs`,
        );
      }

      //Se crea bluvoxs
      const newBlueVoxs =
        await this.bluevoxsRepository.create(createBlueVoxDto);
      const bluevoxSave = await this.bluevoxsRepository.save(newBlueVoxs);
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Bluevoxs',
        `Se creó un bluevoxs con numero de serie ${bluevoxSave.numeroSerie}`,
        'CREATE',
        `INSERT INTO Bluevoxs (...) VALUES (...) -> Numero Serie: ${bluevoxSave.numeroSerie}, Marca: ${bluevoxSave.marca}, Modelo: ${bluevoxSave.modelo}, Estatus: ${bluevoxSave.estatus}, IdCliente: ${bluevoxSave.idCliente}`,
        Number(idUser),
        12,
      );
      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'BlueVoxs creado correctamente',
        data: {
          id: Number(bluevoxSave.id),
          nombre: `${bluevoxSave.marca} ${bluevoxSave.numeroSerie} ` || '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al crear un bluevoxs');
    }
  }

  //Obtener los bluevox por cliente
  async findAllListClientes(id: number) {
    try {
      const bluevox = await this.bluevoxsRepository.find({
        where: { idCliente: id, estatus: 1 },
      });
      if (bluevox.length === 0) {
        throw new NotFoundException(`BlueVoxs no encontrados`);
      }

      //Forzamos a cambiar el id a number
      const data = bluevox.map((item) => ({
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
        `Error al obtener los bluevoxs de un cliente en especifico`,
      );
    }
  }

  //Obtner paginado
  async findAll(page: number, limit: number): Promise<ApiResponseCommon> {
    try {
      const [data, total] = await this.bluevoxsRepository.findAndCount({
        skip: (page - 1) * limit,
        take: limit,
      });
      //Apis response
      const result: ApiResponseCommon = {
        data: data,
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
      throw new BadRequestException({ message: 'Error al obtener BlueVoxs' });
    }
  }

  async findAllList(): Promise<ApiResponseCommon> {
    try {
      const blueVoxs = await this.bluevoxsRepository.find({
        where: { estatus: 1 },
      });
      if (blueVoxs.length === 0) {
        throw new NotFoundException('BlueVoxs no encontrados');
      }
      const result: ApiResponseCommon = {
        data: blueVoxs,
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({ message: 'Error al BlueVoxs Clientes' });
    }
  }

  async findOne(id: number) {
    try {
      const bluevox = await this.bluevoxsRepository.findOne({
        where: { id: id },
      });
      if (!bluevox) {
        throw new NotFoundException(`BlueVoxs con ID:${id} no encontrado`);
      }
      return bluevox;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtener BlueVoxs',
      });
    }
  }

  async update(id: number, idUser: string, updateBluevoxDto: UpdateBluevoxDto) {
    try {
      const bluevox = await this.bluevoxsRepository.findOne({
        where: { id: id },
      });
      if (!bluevox) throw new NotFoundException('BlueVox no encontrado');
      await this.bluevoxsRepository.update(id, updateBluevoxDto);

      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'BlueVoxs',
        `Se actualizo el bluevox con ID: ${id}`,
        'UPDATE',
        `INSERT INTO Bluevoxs (...) VALUES (...) -> Numero Serie: ${updateBluevoxDto.numeroSerie}, Marca: ${updateBluevoxDto.marca}, Modelo: ${updateBluevoxDto.modelo}, IdCliente: ${updateBluevoxDto.idCliente}`,
        Number(idUser),
        12,
      );

      // ----- Api response -----
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'BlueVoxs actualizado correctamente',
        data: {
          id: id,
          nombre:
            `${bluevox.marca || updateBluevoxDto.marca} ${bluevox.numeroSerie || updateBluevoxDto.numeroSerie} ` ||
            '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error al actualizar bluevox`);
    }
  }

  async updateEstatus(
    id: number,
    idUser: string,
    updateBlueVoxEstatusDto: UpdateBlueVoxEstatusDto,
  ) {
    try {
      const bluevoxs = await this.bluevoxsRepository.findOne({
        where: { id: id },
      });
      if (!bluevoxs) throw new NotFoundException('BlueVoxs no encontrado');
      const estatus = updateBlueVoxEstatusDto.estatus;
      await this.bluevoxsRepository.update(id, { estatus: estatus });

      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'BlueVoxs',
        `Se actualizo el estatus del bluevoxs con ID: ${id}`,
        'UPDATE',
        `UPDATE BlueVoxs SET Estatus = ${estatus} WHERE id=${id}`,
        Number(idUser),
        12,
      );

      // ----- Api response -----
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Estatus de bluevoxs actualizado correctamente',
        estatus: { estatus: estatus },
        data: {
          id: id,
          nombre: `${bluevoxs.modelo} ${bluevoxs.numeroSerie} ` || '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al actualizar estatus del bluevoxs`,
      );
    }
  }

  async remove(id: number, idUser: string) {
    try {
      const bluevoxs = await this.bluevoxsRepository.findOne({
        where: { id: id },
      });
      if (!bluevoxs) throw new NotFoundException('BlueVox no encontrado');

      await this.bluevoxsRepository.update(id, { estatus: 0 });

      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'BlueVoxs',
        `Se eliminó el bluevoxs con ID: ${id}`,
        'DELETE',
        `DELETE Bluevoxs (...) VALUES (...) -> Numero Serie: ${bluevoxs.numeroSerie}, Marca: ${bluevoxs.marca}, Modelo: ${bluevoxs.modelo}, Estatus: ${bluevoxs.estatus}, IdCliente: ${bluevoxs.idCliente}`, //, IdOperador=${bluevoxs.idOperador}, IdDispositivo=${bluevoxs.idDispositivo} WHERE id=${id}`,
        Number(idUser),
        12,
      );

      // ----- Api response -----
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'BlueVox eliminado correctamente',
        data: {
          id: id,
          nombre: `${bluevoxs.modelo} ${bluevoxs.numeroSerie} ` || '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error al eliminar al bluevoxs`);
    }
  }
}
