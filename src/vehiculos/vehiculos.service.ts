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
import { ApiResponseCommon } from 'src/common/ApiResponse';
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
        'Operadores',
        `Se creó el vehiculo con placas: ${createVehiculoDto.placa}`,
        'CREATE',
        `INSERT INTO Vehiculos (Marca, Modelo, Ano, Placa, NumeroEconomico, Estatus, IdOperador, IdDispositivo) VALUES ('${createVehiculoDto.marca}', '${createVehiculoDto.modelo}', ${createVehiculoDto.ano}, '${createVehiculoDto.placa}', '${createVehiculoDto.numeroEconomico}', ${createVehiculoDto.estatus}, ${createVehiculoDto.idOperador}, ${createVehiculoDto.idDispositivo})`,
        Number(idUser),
        2,
      );
      return {
        message: 'Operador creado exitosamente',
        operador: vehiculo,
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
      const vehiculos = await this.vehiculoRepository.find();
      if (vehiculos.length === 0)
        throw new NotFoundException('vehiculos no encontrados');
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

  async findOne(Id: number) {
    try {
      const vehiculo = await this.vehiculoRepository.findOne({
        where: { id: Id },
      });
      if (!vehiculo) throw new NotFoundException('Vehiculo no encontrado');
      return {data:vehiculo};
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error al obtener al operador`);
    }
  }

  async updateEstatus(
    Id: number,
    idUser: string,
    updateVehiculoEstausDto: UpdateVehiculoEstatusDto,
  ) {
    try {
      const vehiculo = await this.vehiculoRepository.findOne({
        where: { id: Id },
      });
      if (!vehiculo) throw new NotFoundException('Vehiculo no encontrado');
      const Estatus = updateVehiculoEstausDto.Estatus;
      await this.vehiculoRepository.update(Id, { estatus: Estatus });
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Vehiculo',
        `Se actualizo el vehiculo con ID: ${Id}`,
        'UPDATE',
        `UPDATE Operador SET Estatus = ${Estatus} WHERE Id=${Id}`,
        Number(idUser),
        2,
      );
      return {
        message: `El vehiculo con Id: ${Id} su estatus fue actualizado a ${Estatus}`,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error al eliminar al operador`);
    }
  }

  async update(
    Id: number,
    idUser: string,
    updateVehiculoDto: UpdateVehiculoDto,
  ) {
    try {
      const vehiculo = await this.vehiculoRepository.findOne({
        where: { id: Id },
      });
      if (!vehiculo) throw new NotFoundException('Vehiculo no encontrado');
      const vehiculoData = await this.vehiculoRepository.update(
        Id,
        updateVehiculoDto,
      );
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Vehiculo',
        `Se actualizo el vehiculo con ID: ${Id}`,
        'UPDATE',
        `UPDATE Vehiculos SET Marca='${updateVehiculoDto.marca}', Modelo='${updateVehiculoDto.modelo}', Ano=${updateVehiculoDto.ano}, Placa='${updateVehiculoDto.placa}', NumeroEconomico='${updateVehiculoDto.numeroEconomico}', Estatus=${updateVehiculoDto.estatus}, IdOperador=${updateVehiculoDto.idOperador}, IdDispositivo=${updateVehiculoDto.idDispositivo} WHERE Id=${Id}`,
        Number(idUser),
        2,
      );
      return vehiculoData;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error al eliminar al operador`);
    }
  }

  async remove(Id: number, idUser: string) {
    try {
      const vehiculo = await this.vehiculoRepository.findOne({
        where: { id: Id },
      });
      if (!vehiculo) throw new NotFoundException('Vehiculo no encontrado');
      await this.vehiculoRepository.remove(vehiculo);
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Vehiculos',
        `Se eliminó el vehiculo con ID: ${Id}`,
        'DELETE',
        `DELETE Vehiculos SET Marca='${vehiculo.marca}', Modelo='${vehiculo.modelo}', Ano=${vehiculo.ano}, Placa='${vehiculo.placa}', NumeroEconomico='${vehiculo.numeroEconomico}', Estatus=${vehiculo.estatus}`, //, IdOperador=${vehiculo.idOperador}, IdDispositivo=${vehiculo.idDispositivo} WHERE Id=${Id}`,
        Number(idUser),
        2,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error al eliminar al operador`);
    }
  }
}
