import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTransaccioneDto } from './dto/create-transaccione.dto';
import { UpdateTransaccioneDto } from './dto/update-transaccione.dto';
import { UpdateTransaccionEstatusDto } from './dto/update-transaccione-status.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transacciones } from 'src/entities/Transacciones';
import { ApiResponseCommon } from 'src/common/ApiResponse';
import { Monederos } from 'src/entities/Monederos';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';

@Injectable()
export class TransaccionesService {
  constructor(
    @InjectRepository(Transacciones)
    private readonly transaccionesRepository: Repository<Transacciones>,
    @InjectRepository(Monederos)
    private readonly monederosRepository: Repository<Monederos>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}
  async createTransaccion(createTransaccioneDto: CreateTransaccioneDto,idUser:number) {
    try {
      
    } catch (error) {
      
    }
  }

  async findAllTransacciones(
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    try {
      const transacciones = await this.transaccionesRepository.find();
      if (transacciones.length === 0)
        throw new NotFoundException('Transacciones no encontradas');
      const [data, total] = await this.transaccionesRepository.findAndCount({
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
        message: 'Transacciones obtenidos correctamente',
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({ message: 'Error al obtener transacciones' });
    }
  }

  async findAllListTransacciones(): Promise<ApiResponseCommon> {
    try {
      const transacciones = await this.transaccionesRepository.find();
      if (transacciones.length === 0)
        throw new NotFoundException('Transacciones no encontradas');

      const result: ApiResponseCommon = {
        data: transacciones,

        message: 'Transacciones obtenidos correctamente',
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({ message: 'Error al obtener transacciones' });
    }
  }

  async findOneTransaccion(Id: number) {
    try {
      const transaccion = await this.transaccionesRepository.findOne({
        where: { Id },
      });
      if (!transaccion)
        throw new NotFoundException('Transaccion no encontradas');
      return transaccion
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({ message: 'Error al obtener transacciones' });
    }
  }
}
