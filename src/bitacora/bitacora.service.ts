import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateBitacoraDto } from './dto/create-bitacora.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Bitacora } from 'src/entities/Bitacora';
import { Repository } from 'typeorm';
import moment from 'moment-timezone';
import { ApiResponseCommon } from 'src/common/ApiResponse';

@Injectable()
export class BitacoraLoggerService {
  constructor(
    @InjectRepository(Bitacora)
    private readonly bitacoraRepository: Repository<Bitacora>,
  ) {}
  createBitacora(createBitacoraDto: CreateBitacoraDto) {
    return 'This action adds a new bitacora';
  }

  async findAllListBitacora() {
    try {
      const bitacora = await this.bitacoraRepository.find({
        order: {
          id: 'DESC',
        },
      });
      if (bitacora.length === 0) {
        throw new BadRequestException('Bitacoras no encontradas');
      }
      const result: ApiResponseCommon = {
        data: bitacora,
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al obtener las bitacoras');
    }
  }

  async findAll(page: number, limit: number) {
    try {
      const [data, total] = await this.bitacoraRepository.findAndCount({
        relations: [],
        skip: (page - 1) * limit,
        take: limit,
        order: {
          id: 'DESC',
        },
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
      throw new InternalServerErrorException('Error al obtener las bitacoras');
    }
  }

  async findOne(id: number) {
    try {
      const bitacora = await this.bitacoraRepository.findOne({
        where: { id: id },
      });
      if (!bitacora) {
        throw new NotFoundException(`Bitacora con ID:${id} no encontrado`);
      }
      return { data: bitacora };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtener bitacora',
      });
    }
  }

  async logToBitacora(
    modulo: string,
    descripcion: string,
    accion: string,
    query: string,
    idUsuario: number,
    idModulo: number,
  ) {
    function pad(n: number) {
      return n < 10 ? '0' + n : n;
    }
    const ahora = new Date();
    const FechaActual = `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())} ${pad(ahora.getHours())}:${pad(ahora.getMinutes())}:${pad(ahora.getSeconds())}`;

    const registro = this.bitacoraRepository.create({
      modulo: modulo,
      descripcion: descripcion,
      accion: accion,
      query: query,
      idUsuario: idUsuario,
      idModulo: idModulo,
    });
    console.log(FechaActual);
    await this.bitacoraRepository.save(registro);
    console.log('Registro insertado en Bitacora:', registro);
  }
}
