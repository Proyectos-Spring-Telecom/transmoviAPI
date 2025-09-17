import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateVehiculoDto } from './dto/create-vehiculo.dto';
import { UpdateVehiculoDto } from './dto/update-vehiculo.dto';
import { Repository } from 'typeorm';
import { Vehiculos } from 'src/entities/Vehiculos';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { UpdateVehiculoEstatusDto } from './dto/update-vehiculos-estatus.dto';

@Injectable()
export class VehiculosService {
  constructor(
    @InjectRepository(Vehiculos)
    private readonly vehiculoRepository: Repository<Vehiculos>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}
  async create(createVehiculoDto: CreateVehiculoDto, idUser: string) {
    try {
      const vehiculoExist = await this.vehiculoRepository.findOne({
        where: { placa: createVehiculoDto.placa },
      });
      if (vehiculoExist)
        throw new BadRequestException(
          `Vehiculo con placas: ${createVehiculoDto.placa}con numeroregistrado`,
        );
      const vehiculoData =
        await this.vehiculoRepository.create(createVehiculoDto);
      const vehiculo = await this.vehiculoRepository.save(vehiculoData);

      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Vehiculos',
        `Se creó el vehiculo con placas: ${createVehiculoDto.placa}`,
        'CREATE',
        `INSERT INTO Vehiculos (Marca, Modelo, Ano, Placa, NumeroEconomico, Estatus, IdOperador, IdDispositivo) VALUES ('${createVehiculoDto.marca}', '${createVehiculoDto.modelo}', ${createVehiculoDto.ano}, '${createVehiculoDto.placa}', '${createVehiculoDto.numeroEconomico}', ${createVehiculoDto.estatus}, ${vehiculo.id})`,
        Number(idUser),
        10,
      );

      // ----- Api response -----
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Vehiculo creado correctamente',
        data: {
          id: Number(vehiculo.id),
          nombre: `${vehiculo.modelo} ${vehiculo.placa} ` || '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: `Error al crear al vehiculo`,
        error,
      });
    }
  }

  //Obtener los bluevox por cliente
  async findAllListClientes(id: number) {
    try {
      const vehiculos = await this.vehiculoRepository.find({
        where: { idCliente: id, estatus: 1 },
      });
      if (vehiculos.length === 0) {
        throw new NotFoundException(`Vehiculos no encontrados`);
      }

      //Forzamos a cambiar el id a number
      const data = vehiculos.map((item) => ({
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
        `Error al obtener los vehiculos de un cliente en especifico`,
      );
    }
  }

  async findAll(page: number, limit: number): Promise<ApiResponseCommon> {
    try {
      const vehiculos = await this.vehiculoRepository.find();
      if (vehiculos.length === 0)
        throw new NotFoundException('vehiculos no encontrados');
      const [data, total] = await this.vehiculoRepository.findAndCount({
        relations: [],
        skip: (page - 1) * limit,
        take: limit,
      });
      const result: ApiResponseCommon = {
        data,
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
      throw new BadRequestException(error.message || 'Error fetching data');
    }
  }

  async findAllList(): Promise<ApiResponseCommon> {
    try {
      const vehiculos = await this.vehiculoRepository.find({
        where: { estatus: 1 },
      });
      if (vehiculos.length === 0)
        throw new NotFoundException('vehiculos no encontrados');

      //APi response
      const result: ApiResponseCommon = {
        data: vehiculos,
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Error fetching data');
    }
  }

  async findOne(id: number) {
    try {
      const vehiculo = await this.vehiculoRepository.findOne({
        where: { id: id },
      });
      if (!vehiculo) throw new NotFoundException('Vehiculo no encontrado');
      return { data: vehiculo };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error al obtener al vehiculo`);
    }
  }

  async updateEstatus(
    id: number,
    idUser: string,
    updateVehiculoEstausDto: UpdateVehiculoEstatusDto,
  ) {
    try {
      const vehiculo = await this.vehiculoRepository.findOne({
        where: { id: id },
      });
      if (!vehiculo) throw new NotFoundException('Vehiculo no encontrado');
      const estatus = updateVehiculoEstausDto.estatus;
      await this.vehiculoRepository.update(id, { estatus: estatus });
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Vehiculos',
        `Se actualizo el estatus del vehiculo con ID: ${id}`,
        'UPDATE',
        `UPDATE Vehiculo SET Estatus = ${estatus} WHERE id=${id}`,
        Number(idUser),
        10,
      );

      // ----- Api response -----
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Estatus de vehiculo actualizado correctamente',
        estatus: { estatus: estatus },
        data: {
          id: id,
          nombre: `${vehiculo.modelo} ${vehiculo.placa} ` || '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al actualizar estatus del vehiculo`,
      );
    }
  }

  async update(
    id: number,
    idUser: string,
    updateVehiculoDto: UpdateVehiculoDto,
  ) {
    try {
      const vehiculo = await this.vehiculoRepository.findOne({
        where: { id: id },
      });
      if (!vehiculo) throw new NotFoundException('Vehiculo no encontrado');
      const vehiculoData = await this.vehiculoRepository.update(
        id,
        updateVehiculoDto,
      );

      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Vehiculos',
        `Se actualizo el vehiculo con ID: ${id}`,
        'UPDATE',
        `UPDATE Vehiculos SET Marca='${updateVehiculoDto.marca}', Modelo='${updateVehiculoDto.modelo}', Ano=${updateVehiculoDto.ano}, Placa='${updateVehiculoDto.placa}', NumeroEconomico='${updateVehiculoDto.numeroEconomico}', Estatus=${updateVehiculoDto.estatus}, IdOperador=${vehiculo.id}, WHERE id=${id}`,
        Number(idUser),
        10,
      );

      // ----- Api response -----
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Vehiculo actualizado correctamente',
        data: {
          id: id,
          nombre:
            `${vehiculo.modelo || updateVehiculoDto.modelo} ${vehiculo.placa || updateVehiculoDto.placa} ` ||
            '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error al actualizar vehiculo`);
    }
  }

  async remove(id: number, idUser: string) {
    try {
      const vehiculo = await this.vehiculoRepository.findOne({
        where: { id: id },
      });
      if (!vehiculo) throw new NotFoundException('Vehiculo no encontrado');
      await this.vehiculoRepository.update(id, { estatus: 0 });
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Vehiculos',
        `Se eliminó el vehiculo con ID: ${id}`,
        'DELETE',
        `DELETE Vehiculos SET Marca='${vehiculo.marca}', Modelo='${vehiculo.modelo}', Ano=${vehiculo.ano}, Placa='${vehiculo.placa}', NumeroEconomico='${vehiculo.numeroEconomico}', Estatus=${vehiculo.estatus}`, //, IdOperador=${vehiculo.idOperador}, IdDispositivo=${vehiculo.idDispositivo} WHERE id=${id}`,
        Number(idUser),
        10,
      );

      // ----- Api response -----
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Vehiculo eliminado correctamente',
        data: {
          id: id,
          nombre:
            `${vehiculo.modelo} ${vehiculo.placa} ` ||
            '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error al eliminar al vehiculo`);
    }
  }
}
