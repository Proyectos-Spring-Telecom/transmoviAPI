import {
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateViajeDto } from './dto/create-viaje.dto';
import { Viajes } from 'src/entities/Viajes';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { ApiCrudResponse, EstatusEnumBitcora } from 'src/common/ApiResponse';

@Injectable()
export class ViajesService {
  constructor(
    @InjectRepository(Viajes)
    private readonly viajesRepository: Repository<Viajes>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  async create(
    idUser: number,
    createViajeDto: CreateViajeDto,
  ): Promise<ApiCrudResponse> {
    try {
      const newViaje = await this.viajesRepository.create(createViajeDto);
      const viajeSave = await this.viajesRepository.save(newViaje);

      // Registro en la bitácora SUCCESS
      const querylogger = { createViajeDto };
      await this.bitacoraLogger.logToBitacora(
        'Viajes',
        `Se creó un viaje con ID: ${viajeSave.id}`,
        'CREATE',
        `${querylogger}`,
        idUser,
        15,
        EstatusEnumBitcora.SUCCESS,
      );

      // API response SUCCESS
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Viaje creado correctamente',
        data: {
          id: Number(viajeSave.id),
          nombre: `Cliente ID: ${viajeSave.idCliente}, Turno ID: ${viajeSave.idTurno}, Derrotero ID: ${viajeSave.idDerrotero}, Operador ID: ${viajeSave.idOperador}`,
        },
      };

      return result;
    } catch (error) {
      // Registro en la bitácora SUCCESS
      const querylogger = { createViajeDto };
      await this.bitacoraLogger.logToBitacora(
        'Viajes',
        `Se creó un viaje con client ID: ${createViajeDto.idCliente} Turno ID: ${createViajeDto.idTurno}, Derrotero ID: ${createViajeDto.idDerrotero}, Operador ID: ${createViajeDto.idOperador}`,
        'CREATE',
        `${querylogger}`,
        idUser,
        15,
        EstatusEnumBitcora.SUCCESS,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al crear un viaje',
        error: error.message,
      });
    }
  }

  async findAllList() {
    return `This action returns all viajes`;
  }

  async findAll() {
    return `This action returns all viajes`;
  }

  async findOne(id: number) {
    return `This action returns a #${id} viaje`;
  }

  async remove(id: number) {
    return `This action removes a #${id} viaje`;
  }
}
