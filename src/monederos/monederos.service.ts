import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateMonederoDto } from './dto/create-monedero.dto';
import { UpdateMonederoDto } from './dto/update-monedero.dto';
import { UpdateMonederoEstatusDto } from './dto/update-monedero-estatus.dto';
import { UpdateMonederoSaldoDto } from './dto/update-monedero-saldo.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Monederos } from 'src/entities/Monederos';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { ApiResponseCommon } from 'src/common/ApiResponse';


@Injectable()
export class MonederosService {
  constructor(
    @InjectRepository(Monederos)
    private readonly monederoRepository: Repository<Monederos>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}
  //Crear un monedero
  async createMonedero(createMonederoDto: CreateMonederoDto, idUser: string) {
    try {
      const monederoExistente = await this.monederoRepository.findOne({
        where: { NumeroSerie: createMonederoDto.NumeroSerie },
      });
      if (monederoExistente) {
        throw new NotFoundException(
          `El monedero con numero de serie: ${createMonederoDto.NumeroSerie} esta registrado`,
        );
      }
      const monederoData = await this.monederoRepository.create(createMonederoDto);
      const monedero = await this.monederoRepository.save(monederoData);
      // --- Registro en la bitácora ---
      await this.bitacoraLogger.logToBitacora(
        'Monederos',
        `Se creó un monedero con numero de serie: ${createMonederoDto.NumeroSerie}`,
        'CREATE',
        `INSERT Monedero -> NumeroSerie: ${createMonederoDto.NumeroSerie}`,
        Number(idUser),
      );
      return { message: 'Monedero creado exitosamente', monedero: monedero };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al crear el monedero');
    }
  }
  //Obtener todos los monederos paginado
  async findAllMonederos(page: number, limit: number): Promise<ApiResponseCommon> {
    try {
      const monederos = await this.monederoRepository.find();
      if (monederos.length === 0) {
        throw new NotFoundException('Monederos no encontrados');
      }
      const [data,total] = await this.monederoRepository.findAndCount({
        relations: [],
        skip: (page - 1)*limit,
        take: limit,
      });
      const result:ApiResponseCommon = {
        data,
        paginated: {
          total: Math.ceil(total/limit),
          page,
          limit,
        },
        message: 'Monederos obtenidos correctamente',
      }
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al obtener los monederos');
    }
  }

    //Obtener todos los monederos
  async findAllListMonederos(): Promise<ApiResponseCommon> {
    try {
      const monederos = await this.monederoRepository.find();
      if (monederos.length === 0) {
        throw new NotFoundException('Monederos no encontrados');
      }
      const result:ApiResponseCommon = {
        data:monederos,

        message: 'Monederos obtenidos correctamente',
      }
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al obtener los monederos');
    }
  }
  //Obtener monedero por ID
  async findOneMonedero(Id: number) {
    try {
      const monedero = await this.monederoRepository.findOne({ where: { Id } });
      if (!monedero) {
        throw new NotFoundException(
          `El monedero con id: ${Id} no fue encontrado`,
        );
      }
      return { message: 'Monedero obtenido exitosamente', monederos: monedero };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al obtener el monedero');
    }
  }
  //Obtener monedero por numero de serie
  async findOneMonederoBySerie(NumeroSerie: string) {
    try {
      const monedero = await this.monederoRepository.findOne({
        where: { NumeroSerie },
      });
      if (!monedero) {
        throw new NotFoundException(
          `El monedero con numero de serie: ${NumeroSerie} no fue encontrado`,
        );
      }
      return { message: 'Monedero obtenido exitosamente', monederos: monedero };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error al obtener el monedero por numero de serie',
      );
    }
  }
  //Actualizar el estatus del monedero
  async updateMonederoEstatus(
    Id: number,
    idUser: string,
    updateMonederoEstatusDto: UpdateMonederoEstatusDto,
  ) {
    try {
      const monederoExistente = await this.monederoRepository.findOne({
        where: { Id },
      });
      if (!monederoExistente) {
        throw new NotFoundException(
          `El monedero con id: ${Id} no fue encontrado`,
        );
      }
      const { Estatus } = updateMonederoEstatusDto;
      await this.monederoRepository.update(Id, { estatus: Estatus });
      // --- Registro en la bitácora ---
      await this.bitacoraLogger.logToBitacora(
        'Monederos',
        `Se actualizó estatus a ${Estatus} el monedero con ID: ${Id}`,
        'UPDATE',
        `UPDATE Monederos SET Estatus=${Estatus} WHERE Id=${Id}`,
        Number(idUser),
      );
      const monedero = await this.monederoRepository.findOne({ where: { Id } });
      return { message: 'Estatus del monedero actualizado exitosamente', Estatus: Number(Estatus) };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error al actualizar el estatus del monedero',
      );
    }
  }
  //Actualizar saldo en el monedero
  async updateMonederoSaldo(
    Id: number,
    idUser,
    updateMonederoSaldoDto: UpdateMonederoSaldoDto,
  ) {
    try {
      const monederoExistente = await this.monederoRepository.findOne({
        where: { Id },
      });
      if (!monederoExistente) {
        throw new NotFoundException(
          `El monedero con id: ${Id} no fue encontrado`,
        );
      }
      const { Saldo } = updateMonederoSaldoDto;
      await this.monederoRepository.update(Id, { saldo: Saldo });
      // --- Registro en la bitácora ---
      await this.bitacoraLogger.logToBitacora(
        'Monederos',
        `Se actualizó saldo del monedero con ID: ${Id}`,
        'UPDATE',
        `UPDATE Monederos SET Saldo=${Saldo} WHERE Id=${Id}`,
        Number(idUser),
      );
      const monedero = await this.monederoRepository.findOne({ where: { Id } });
      return { message: 'Saldo actualizado exitosamente', Saldo: Number(monedero?.saldo) };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error al actualizar el saldo del monedero',
      );
    }
  }
  //Actualizar el monedero
  async updateMonedero(
    Id: number,
    idUser: string,
    updateMonederoDto: UpdateMonederoDto,
  ) {
    try {
      const monederoExistente = await this.monederoRepository.findOne({
        where: { Id },
      });
      if (!monederoExistente) {
        throw new NotFoundException(
          `El monedero con id: ${Id} no fue encontrado`,
        );
      }
      const monederoData = await this.monederoRepository.create(updateMonederoDto);
      await this.monederoRepository.update(Id, monederoData);
      // --- Registro en la bitácora ---
      await this.bitacoraLogger.logToBitacora(
        'Monederos',
        `Se actualizó el monedero con ID: ${Id}`,
        'UPDATE',
        `UPDATE Monederos SET... WHERE Id=${Id}`,
        Number(idUser),
      );
      const monedero = await this.monederoRepository.findOne({ where: { Id } });
      return { message: 'Monederos actualizado exitosamente', monedero: monedero };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al actualizar el monedero');
    }
  }
  //Eliminar monederos
  async removeMonedero(Id: number, idUser: string) {
    try {
      const monederoExistente = await this.monederoRepository.findOne({
        where: { Id },
      });
      if (!monederoExistente) {
        throw new NotFoundException(
          `El monedero con id: ${Id} no fue encontrado`,
        );
      }
      await this.monederoRepository.remove(monederoExistente);
      // --- Registro en la bitácora ---
      await this.bitacoraLogger.logToBitacora(
        'Monederos',
        `Se elimino el monedero con ID: ${Id}`,
        'DELETE',
        `DELETE From Monederos WHERE Id=${Id}`,
        Number(idUser),
      );
      return {message:`El monedero con id: ${Id} ha sido eliminado exitosamente`,Id: Number(Id)};
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al eliminar el monedero');
    }
  }
}
