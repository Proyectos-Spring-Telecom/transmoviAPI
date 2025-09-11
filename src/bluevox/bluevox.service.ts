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
        `INSERT INTO Bluevoxs (...) VALUES (...) -> Numero Serie: ${bluevoxSave.numeroSerie}, Marca: ${bluevoxSave.marca}, Modelo: ${bluevoxSave.fechaCreacion}, Estatus: ${bluevoxSave.estatus}, IdCliente: ${bluevoxSave.idCliente}`,
        Number(idUser),
        12,
      );
      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Cliente creado correctamente',
        data: {
          id: bluevoxSave.id,
          nombre: `${bluevoxSave.marca} ${bluevoxSave.numeroSerie} ` || '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al crear un cliente');
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
          total:total,
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
      };
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

}
