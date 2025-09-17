import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateConteoPasajerosDto } from './dto/create-conteopasajero.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { ConteoPasajeros } from 'src/entities/ConteoPasajeros';
import { Repository } from 'typeorm';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';

@Injectable()
export class ConteopasajerosService {
  constructor(
    @InjectRepository(ConteoPasajeros)
    private readonly conteopasajeroRepository: Repository<ConteoPasajeros>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  async create(
    idUser: string,
    createConteopasajeroDto: CreateConteoPasajerosDto,
  ): Promise<ApiCrudResponse> {
    try {
      //Crear una ConteoPasajero
      const newConteoPasajero = await this.conteopasajeroRepository.create(
        createConteopasajeroDto,
      );
      const conteoPasajeroSave =
        await this.conteopasajeroRepository.save(newConteoPasajero);

      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'ConteoPasajeros',
        `Se creó un ConteoPasajeros con Numero de serie BlueVoxs: ${createConteopasajeroDto.numeroSerieBlueVox}`,
        'CREATE',
        `INSERT INTO ConteoPasajeros (...) VALUES (...) -> id:  ${conteoPasajeroSave.id}, Entradas: ${conteoPasajeroSave.entradas}, Salidas: ${conteoPasajeroSave.salidas}, Diferencia: ${conteoPasajeroSave.diferencia}, FechaHora: ${conteoPasajeroSave.fechaHora}, NumeroSerieBlueVox ${conteoPasajeroSave.numeroSerieBlueVox}`,
        Number(idUser),
        23,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'ConteoPasajero creado correctamente',
        data: {
          id: Number(conteoPasajeroSave.id),
          nombre:
            `${conteoPasajeroSave.id} ${conteoPasajeroSave.numeroSerieBlueVox} ` ||
            '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al crear ConteoPasajeros',error
      });
    }
  }

  async findAll(page: number, limit: number): Promise<ApiResponseCommon> {
    try {
      const [data, total] = await this.conteopasajeroRepository.findAndCount({
        skip: (page - 1) * limit,
        take: limit,
      });

      //Forzamos a cambiar el id a number
      const conteoPasajeros = data.map(item =>({
        ...item,
        id:Number(item.id)
      }));

      //APi response
      const result: ApiResponseCommon = {
        data: conteoPasajeros,
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
      throw new InternalServerErrorException({
        message: 'Error al obtener conteo pasajeros',
      });
    }
  }

  async findAllList(): Promise<ApiResponseCommon> {
    try {

      //Obtenemos ConteoPasajeros
      const conteopasajero = await this.conteopasajeroRepository.find();
      if (conteopasajero.length === 0) {
        throw new NotFoundException('ConteoPasajeros no encontrado');
      }

      //Forzamos a cambiar el id a number
      const data = conteopasajero.map(item =>({
        ...item,
        id:Number(item.id)
      }));

      const result: ApiResponseCommon = {
        data: data,
      };

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtener conteo pasajeros',
      });
    }
  }

  async findOne(id: number) {
    try {
      const conteopasajero = await this.conteopasajeroRepository.findOne({
        where: { id: id },
      });
      if (!conteopasajero) {
        throw new NotFoundException('ConteoPasajeros no encontrado');
      }

      conteopasajero.id = Number(conteopasajero.id) 

      return { data: conteopasajero };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtener conteo pasajeros',
      });
    }
  }
}
