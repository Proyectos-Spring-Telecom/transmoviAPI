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
        where: { Placa: createVehiculoDto.Placa },
      });
      if (vehiculoExist)
        throw new BadRequestException(
          `Vehiculo con placas: ${createVehiculoDto.Placa}con numeroregistrado`,
        );
      const vehiculoData =
        await this.vehiculoRepository.create(createVehiculoDto);
      const vehiculo = await this.vehiculoRepository.save(vehiculoData);
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Operadores',
        `Se creó el vehiculo con placas: ${createVehiculoDto.Placa}`,
        'CREATE',
        `INSERT INTO Vehiculos (Marca, Modelo, Ano, Placa, NumeroEconomico, Estatus, IdOperador, IdDispositivo) VALUES ('${createVehiculoDto.Marca}', '${createVehiculoDto.Modelo}', ${createVehiculoDto.Ano}, '${createVehiculoDto.Placa}', '${createVehiculoDto.NumeroEconomico}', ${createVehiculoDto.Estatus}, ${createVehiculoDto.IdOperador}, ${createVehiculoDto.IdDispositivo})`,
        Number(idUser),
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
          total: Math.ceil(total / limit),
          page,
          limit,
        },
        message: 'Vehiculos obtenidos correctamente',
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

        message: 'Vehiculos obtenidos correctamente',
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
      const vehiculo = await this.vehiculoRepository.findOne({ where: { Id } });
      if (!vehiculo) throw new NotFoundException('Vehiculo no encontrado');
      return vehiculo;
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
      const vehiculo = await this.vehiculoRepository.findOne({ where: { Id } });
      if (!vehiculo) throw new NotFoundException('Vehiculo no encontrado');
      const Estatus = updateVehiculoEstausDto.Estatus
      await this.vehiculoRepository.update(Id,{Estatus})
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Vehiculo',
        `Se actualizo el vehiculo con ID: ${Id}`,
        'UPDATE',
        `UPDATE Operador SET Estatus = ${Estatus} WHERE Id=${Id}`,
        Number(idUser),
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
      const vehiculo = await this.vehiculoRepository.findOne({ where: { Id } });
      if (!vehiculo) throw new NotFoundException('Vehiculo no encontrado');
      const vehiculoData =
        await this.vehiculoRepository.update(Id,updateVehiculoDto);
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Vehiculo',
        `Se actualizo el vehiculo con ID: ${Id}`,
        'UPDATE',
        `UPDATE Vehiculos SET Marca='${updateVehiculoDto.Marca}', Modelo='${updateVehiculoDto.Modelo}', Ano=${updateVehiculoDto.Ano}, Placa='${updateVehiculoDto.Placa}', NumeroEconomico='${updateVehiculoDto.NumeroEconomico}', Estatus=${updateVehiculoDto.Estatus}, IdOperador=${updateVehiculoDto.IdOperador}, IdDispositivo=${updateVehiculoDto.IdDispositivo} WHERE Id=${Id}`,
        Number(idUser),
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
      const vehiculo = await this.vehiculoRepository.findOne({ where: { Id } });
      if (!vehiculo) throw new NotFoundException('Vehiculo no encontrado');
      await this.vehiculoRepository.remove(vehiculo)
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Vehiculos',
        `Se eliminó el vehiculo con ID: ${Id}`,
        'DELETE',
        `DELETE Vehiculos SET Marca='${vehiculo.Marca}', Modelo='${vehiculo.Modelo}', Ano=${vehiculo.Ano}, Placa='${vehiculo.Placa}', NumeroEconomico='${vehiculo.NumeroEconomico}', Estatus=${vehiculo.Estatus}, IdOperador=${vehiculo.IdOperador}, IdDispositivo=${vehiculo.IdDispositivo} WHERE Id=${Id}`,
        Number(idUser),
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error al eliminar al operador`);
    }
  }
}
