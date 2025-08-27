import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
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
      const bitacora = await this.bitacoraRepository.find();
      if (bitacora.length === 0) {
        throw new BadRequestException('Bitacoras no encontradas');
      }
      const result: ApiResponseCommon = {
        data: bitacora,
        message: 'Módulos obtenidos correctamente',
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
        skip: (page-1)*limit,
        take: limit,
      });
      const result: ApiResponseCommon = {
        data,
        paginated: {
          total: Math.ceil(total / limit),
          page,
          limit,
        },
        message: 'Módulos obtenidos correctamente',
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al obtener las bitacoras');
    }
  }

  async logToBitacora(
    Modulo: string,
    Descripcion: string,
    Accion: string,
    Query: string,
    IdUsuario: number,
  ) {
    const FechaActual = moment()
      .tz('America/Mexico_City')
      .format('YYYY-MM-DD HH:mm:ss');

    const registro = this.bitacoraRepository.create({
      Modulo: Modulo,
      Descripcion: Descripcion,
      Accion: Accion,
      Query: Query,
      Fecha: FechaActual,
      IdUsuario: IdUsuario,
    });
    console.log(FechaActual);
    await this.bitacoraRepository.save(registro);
    console.log('Registro insertado en Bitacora:', registro);
  }
}
