import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateLicenciaDto } from './dto/create-licencia.dto';
import { UpdateLicenciaDto } from './dto/update-licencia.dto';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Licencias } from 'src/entities/Licencias';
import { Repository } from 'typeorm';
import { ApiCrudResponse, EstatusEnumBitcora } from 'src/common/ApiResponse';
import { EnumModulos } from 'src/common/estatus.enum';

@Injectable()
export class LicenciasService {
  constructor(
    @InjectRepository(Licencias)
    private readonly licenciasRepository: Repository<Licencias>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  // ========================================
  // 🔹 CREAR UNA LICENCIA
  // ========================================
  async create(idUser: number, createLicenciaDto: CreateLicenciaDto) {
    try {
      const numeroLicencia = await this.licenciasRepository.findOne({
        where: {
          numeroLicencia: createLicenciaDto.numeroLicencia,
        },
      });
      if (!numeroLicencia) {
        throw new BadRequestException('Licencia ya ha sido registrado.');
      }
      const nuevaLicencia =
        await this.licenciasRepository.create(createLicenciaDto);
      const licenciaSave = await this.licenciasRepository.save(nuevaLicencia);

      //-----Registro en la bitacora-----SUCCESS
      const querylogger = { createLicenciaDto };
      await this.bitacoraLogger.logToBitacora(
        'Operadores',
        `Se le ha creado la licencia al operador correctamente, número de licencia: ${createLicenciaDto.numeroLicencia}.`,
        'CREATE',
        querylogger,
        Number(idUser),
        EnumModulos.OPERADORES,
        EstatusEnumBitcora.SUCCESS,
      );
      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'La licencia ha sido creado correctamente.',
        data: {
          id: Number(licenciaSave.id),
          nombre: `Numero de licencia: ${licenciaSave.numeroLicencia}` || '',
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora-----ERROR
      const querylogger = { createLicenciaDto };
      await this.bitacoraLogger.logToBitacora(
        'Operadores',
        `El operador ha sido creado correctamente con el número de licencia: ${createLicenciaDto.numeroLicencia}.`,
        'CREATE',
        querylogger,
        Number(idUser),
        EnumModulos.OPERADORES,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException({
        message: 'Error al crear la licencia.',
        error: error.message,
      });
    }
  }

  findAll() {
    return `This action returns all licencias`;
  }

  findOne(id: number) {
    return `This action returns a #${id} licencia`;
  }

  update(id: number, updateLicenciaDto: UpdateLicenciaDto) {
    return `This action updates a #${id} licencia`;
  }

  remove(id: number) {
    return `This action removes a #${id} licencia`;
  }
}
