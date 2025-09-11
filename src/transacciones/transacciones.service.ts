import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateTransaccioneDto } from './dto/create-transaccione.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transacciones } from 'src/entities/Transacciones';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { Dispositivos } from 'src/entities/Dispositivos';
import { MonederosService } from 'src/monederos/monederos.service';

@Injectable()
export class TransaccionesService {
  constructor(
    @InjectRepository(Transacciones)
    private readonly transaccionesRepository: Repository<Transacciones>,
    @InjectRepository(Dispositivos)
    private readonly dispositivoRepository: Repository<Dispositivos>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly monederosService: MonederosService,
  ) {}
  async createTransaccion(
    createTransaccioneDto: CreateTransaccioneDto,
    idUser: string,
  ): Promise<ApiCrudResponse> {
    try {
      //Declaramos monto de transaccion
      const monto = createTransaccioneDto.monto;

      //Validar Debito o Recarga
      if (monto < 0) {
        throw new BadRequestException('Saldo insuficiente');
      }

      const montoFinal = await this.monederosService.updateMonederoSaldo(
        createTransaccioneDto.numeroSerieMonedero,
        idUser,
        createTransaccioneDto.monto,
      );
      const newTransaccion = await this.transaccionesRepository.create(createTransaccioneDto)
      await this.transaccionesRepository.save(newTransaccion)

      // --- Registro en la bitácora ---
      await this.bitacoraLogger.logToBitacora(
        'Transacciones',
        `Se realizo una transaccion de tipo ${createTransaccioneDto.tipoTransaccion}`,
        'CREATE',
        `INSERT INTO Transacciones (TipoTransaccion, Monto, Latitud, Longitud, FechaHora, NumeroSerieMonedero, NumeroSerieDispositivo) Values (${createTransaccioneDto.tipoTransaccion}, ${createTransaccioneDto.monto}, ${createTransaccioneDto.latitud}, ${createTransaccioneDto.longitud}, ${createTransaccioneDto.fechaHora}, ${createTransaccioneDto.numeroSerieMonedero}, ${createTransaccioneDto.numeroSerieDispositivo})`,
        Number(idUser),
        25,
      );
      //API response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Transaccion creado correctamente',
        data: {
          id: Number(montoFinal.data?.id),
          nombre: `${createTransaccioneDto.numeroSerieMonedero} ${monto} ` || '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error generar la transaccion de tipo ${createTransaccioneDto.tipoTransaccion}`,
      );
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

      //API Response
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
      throw new BadRequestException({
        message: 'Error al obtener transacciones',
      });
    }
  }

  async findAllListTransacciones(): Promise<ApiResponseCommon> {
    try {
      const transacciones = await this.transaccionesRepository.find();
      if (transacciones.length === 0)
        throw new NotFoundException('Transacciones no encontradas');

      //API Response
      const result: ApiResponseCommon = {
        data: transacciones,
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({
        message: 'Error al obtener transacciones',
      });
    }
  }

  async findOneTransaccion(Id: number) {
    try {
      const transaccion = await this.transaccionesRepository.findOne({
        where: { id: Id },
      });
      if (!transaccion)
        throw new NotFoundException('Transaccion no encontradas');
      return { data: transaccion };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({
        message: 'Error al obtener transacciones',
      });
    }
  }
}
