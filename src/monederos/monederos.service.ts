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
import { ExposeMonederoDto } from './dto/expose-monedero.dto';
import { plainToInstance } from 'class-transformer';

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
        where: { numeroSerie: createMonederoDto.NumeroSerie },
      });
      if (monederoExistente) {
        throw new NotFoundException(
          `El monedero con numero de serie: ${createMonederoDto.NumeroSerie} esta registrado`,
        );
      }
      const monederoData = await this.monederoRepository.create({
        numeroSerie: createMonederoDto.NumeroSerie,
        fechaActivacion: createMonederoDto.FechaActivacion,
        saldo: createMonederoDto.Saldo,
        estatus: createMonederoDto.Estatus,
      });
      const monedero = await this.monederoRepository.save(monederoData);
      // --- Registro en la bitácora ---
      await this.bitacoraLogger.logToBitacora(
        'Monederos',
        `Se creó un monedero con numero de serie: ${createMonederoDto.NumeroSerie}`,
        'CREATE',
        `INSERT Monedero -> NumeroSerie: ${createMonederoDto.NumeroSerie}`,
        Number(idUser),
      );
      const monederoExpuesto = plainToInstance(ExposeMonederoDto, monedero, {
        excludeExtraneousValues: true,
      });
      return { message: 'Monedero creado exitosamente', monedero: monederoExpuesto };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al crear el monedero');
    }
  }
  //Obtener todos los monederos
  async findAllMonederos() {
    try {
      const monederos = await this.monederoRepository.find();
      if (monederos.length === 0) {
        throw new NotFoundException('Monederos no encontrados');
      }
      const monederoExpuesto = plainToInstance(ExposeMonederoDto, monederos, {
        excludeExtraneousValues: true,
      });
      return { message: 'Monederos obtenidos exitosamente', monedero: monederoExpuesto };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al obtener los monederos');
    }
  }
  //Obtener monedero por ID
  async findOneMonedero(id: number) {
    try {
      const monedero = await this.monederoRepository.findOne({ where: { id } });
      if (!monedero) {
        throw new NotFoundException(
          `El monedero con id: ${id} no fue encontrado`,
        );
      }
      const monederoExpuesto = plainToInstance(ExposeMonederoDto, monedero, {
        excludeExtraneousValues: true,
      });
      return { message: 'Monedero obtenido exitosamente', monedero: monederoExpuesto };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al obtener el monedero');
    }
  }
  //Obtener monedero por numero de serie
  async findOneMonederoBySerie(numeroSerie: string) {
    try {
      const monedero = await this.monederoRepository.findOne({
        where: { numeroSerie },
      });
      if (!monedero) {
        throw new NotFoundException(
          `El monedero con numero de serie: ${numeroSerie} no fue encontrado`,
        );
      }
      const monederoExpuesto = plainToInstance(ExposeMonederoDto, monedero, {
        excludeExtraneousValues: true,
      });
      return { message: 'Monedero obtenido exitosamente', monedero: monederoExpuesto };
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
    id: number,
    idUser: string,
    updateMonederoEstatusDto: UpdateMonederoEstatusDto,
  ) {
    try {
      const monederoExistente = await this.monederoRepository.findOne({
        where: { id },
      });
      if (!monederoExistente) {
        throw new NotFoundException(
          `El monedero con id: ${id} no fue encontrado`,
        );
      }
      const { Estatus } = updateMonederoEstatusDto;
      await this.monederoRepository.update(id, { estatus: Estatus });
      // --- Registro en la bitácora ---
      await this.bitacoraLogger.logToBitacora(
        'Monederos',
        `Se actualizó estatus a ${Estatus} el monedero con ID: ${id}`,
        'UPDATE',
        `UPDATE Monederos SET Estatus=${Estatus} WHERE Id=${id}`,
        Number(idUser),
      );
      const monedero = await this.monederoRepository.findOne({ where: { id } });
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
    id: number,
    idUser,
    updateMonederoSaldoDto: UpdateMonederoSaldoDto,
  ) {
    try {
      const monederoExistente = await this.monederoRepository.findOne({
        where: { id },
      });
      if (!monederoExistente) {
        throw new NotFoundException(
          `El monedero con id: ${id} no fue encontrado`,
        );
      }
      const { Saldo } = updateMonederoSaldoDto;
      await this.monederoRepository.update(id, { saldo: Saldo });
      // --- Registro en la bitácora ---
      await this.bitacoraLogger.logToBitacora(
        'Monederos',
        `Se actualizó saldo del monedero con ID: ${id}`,
        'UPDATE',
        `UPDATE Monederos SET Saldo=${Saldo} WHERE Id=${id}`,
        Number(idUser),
      );
      const monedero = await this.monederoRepository.findOne({ where: { id } });
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
    id: number,
    idUser: string,
    updateMonederoDto: UpdateMonederoDto,
  ) {
    try {
      const monederoExistente = await this.monederoRepository.findOne({
        where: { id },
      });
      if (!monederoExistente) {
        throw new NotFoundException(
          `El monedero con id: ${id} no fue encontrado`,
        );
      }
      const monederoData = await this.monederoRepository.create({
        numeroSerie: updateMonederoDto.NumeroSerie,
        fechaActivacion: updateMonederoDto.FechaActivacion,
        saldo: updateMonederoDto.Saldo,
        estatus: updateMonederoDto.Estatus,
      });
      await this.monederoRepository.update(id, monederoData);
      // --- Registro en la bitácora ---
      await this.bitacoraLogger.logToBitacora(
        'Monederos',
        `Se actualizó el monedero con ID: ${id}`,
        'UPDATE',
        `UPDATE Monederos SET... WHERE Id=${id}`,
        Number(idUser),
      );
      const monedero = await this.monederoRepository.findOne({ where: { id } });
      const monederoExpuesto = plainToInstance(ExposeMonederoDto, monedero, {
        excludeExtraneousValues: true,
      });
      return { message: 'Monederos actualizado exitosamente', monedero: monederoExpuesto };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al actualizar el monedero');
    }
  }
  //Eliminar monederos
  async removeMonedero(id: number, idUser: string) {
    try {
      const monederoExistente = await this.monederoRepository.findOne({
        where: { id },
      });
      if (!monederoExistente) {
        throw new NotFoundException(
          `El monedero con id: ${id} no fue encontrado`,
        );
      }
      await this.monederoRepository.remove(monederoExistente);
      // --- Registro en la bitácora ---
      await this.bitacoraLogger.logToBitacora(
        'Monederos',
        `Se elimino el monedero con ID: ${id}`,
        'DELETE',
        `DELETE From Monederos WHERE Id=${id}`,
        Number(idUser),
      );
      return {message:`El monedero con id: ${id} ha sido eliminado exitosamente`,Id: Number(id)};
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al eliminar el monedero');
    }
  }
}
