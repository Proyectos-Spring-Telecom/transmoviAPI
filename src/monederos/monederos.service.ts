import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateMonederoDto } from './dto/create-monedero.dto';
import { UpdateMonederoDto } from './dto/update-monedero.dto';
import { UpdateMonederoEstatusDto } from './dto/update-monedero-estatus.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Monederos } from 'src/entities/Monederos';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { ClientesService } from 'src/clientes/clientes.service';
import { PasajerosService } from 'src/pasajeros/pasajeros.service';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import moment from 'moment-timezone';

@Injectable()
export class MonederosService {
  constructor(
    @InjectRepository(Monederos)
    private readonly monederoRepository: Repository<Monederos>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly clientesService: ClientesService,
    private readonly pasajerosService: PasajerosService,
  ) {}

  //Crear un monedero
  async createMonedero(
    createMonederoDto: CreateMonederoDto,
    idUser: string,
  ): Promise<ApiCrudResponse> {
    try {
      const monedero = await this.monederoRepository.findOne({
        where: { numeroSerie: createMonederoDto.numeroSerie },
      });
      if (monedero) {
        throw new NotFoundException(
          `El monedero con numero de serie: ${createMonederoDto.numeroSerie} esta registrado`,
        );
      }

      //Agregamos la fecha actual
      const FechaActual = moment()
        .tz('America/Mexico_City')
        .format('YYYY-MM-DD HH:mm:ss');

      //Añadimos fecha
      createMonederoDto.fechaActivacion = FechaActual;

      //Guardamos el monedero
      const newMonedero =
        await this.monederoRepository.create(createMonederoDto);
      const monederoSave = await this.monederoRepository.save(newMonedero);

      // --- Registro en la bitácora ---
      await this.bitacoraLogger.logToBitacora(
        'Monederos',
        `Se creó un monedero con numero de serie: ${monederoSave.numeroSerie}`,
        'CREATE',
        `INSERT Monedero -> NumeroSerie: ${monederoSave.numeroSerie}`,
        Number(idUser),
        20,
      );

      //API response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Monedero creado correctamente',
        data: {
          id: Number(monederoSave.id),
          nombre: `${monederoSave.numeroSerie} ${monederoSave.saldo} ` || '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al crear el monedero');
    }
  }
  //Obtener todos los monederos paginado
  async findAllMonederos(
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    try {
      const monederos = await this.monederoRepository.find();
      if (monederos.length === 0) {
        throw new NotFoundException('Monederos no encontrados');
      }
      const [data, total] = await this.monederoRepository.findAndCount({
        relations: [],
        skip: (page - 1) * limit,
        take: limit,
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
      throw new InternalServerErrorException('Error al obtener los monederos');
    }
  }

  //Obtener todos los monederos
  async findAllListMonederos(): Promise<ApiResponseCommon> {
    try {
      const monederos = await this.monederoRepository.find({
        where: { estatus: 1 },
      });
      if (monederos.length === 0) {
        throw new NotFoundException('Monederos no encontrados');
      }

      //Api response
      const result: ApiResponseCommon = {
        data: monederos,
      };
      return result;
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
      const monedero = await this.monederoRepository.findOne({
        where: { id: id },
      });
      if (!monedero) {
        throw new NotFoundException(
          `El monedero con id: ${id} no fue encontrado`,
        );
      }
      return { data: monedero };
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
        where: { numeroSerie: NumeroSerie },
      });
      if (!monedero) {
        throw new NotFoundException(
          `El monedero con numero de serie: ${NumeroSerie} no fue encontrado`,
        );
      }
      return { data: monedero };
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
      const monedero = await this.monederoRepository.findOne({
        where: { id: id },
      });
      if (!monedero) {
        throw new NotFoundException(
          `El monedero con id: ${id} no fue encontrado`,
        );
      }

      //Actualizamos estatus
      const { estatus } = updateMonederoEstatusDto;
      await this.monederoRepository.update(id, { estatus: estatus });
      // --- Registro en la bitácora ---
      await this.bitacoraLogger.logToBitacora(
        'Monederos',
        `Se actualizó estatus a ${estatus} el monedero con ID: ${id}`,
        'UPDATE',
        `UPDATE Monederos SET Estatus=${estatus} WHERE id=${id}`,
        Number(idUser),
        20,
      );
      //API response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Estatus monedero actualizado correctamente',
        estatus: { estatus: estatus },
        data: {
          id: Number(monedero.id),
          nombre: `${monedero.numeroSerie} ${monedero.saldo} ` || '',
        },
      };
      return result;
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
    numeroSerie: string,
    idUser: string,
    saldo: number,
  ) {
    try {
      const monedero = await this.monederoRepository.findOne({
        where: { numeroSerie: numeroSerie },
      });
      const id = Number(monedero?.id);
      if (!monedero) {
        throw new NotFoundException(
          `El monedero con id: ${id} no fue encontrado`,
        );
      }

      //Actualizamos saldo
      await this.monederoRepository.update(id, { saldo: saldo });

      // --- Registro en la bitácora ---
      await this.bitacoraLogger.logToBitacora(
        'Monederos',
        `Se actualizó saldo del monedero con ID: ${id}`,
        'UPDATE',
        `UPDATE Monederos SET saldo=${saldo} WHERE id=${id}`,
        Number(idUser),
        20,
      );
      const monederoSave = await this.monederoRepository.findOne({
        where: { id: id },
      });

      //API response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Saldo monedero actualizado correctamente',
        data: {
          id: id,
          nombre: `${monederoSave?.numeroSerie} ${monederoSave?.saldo} ` || '',
        },
      };
      return result;
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
      const monedero = await this.monederoRepository.findOne({
        where: { id: id },
      });
      if (!monedero) {
        throw new NotFoundException(
          `El monedero con id: ${id} no fue encontrado`,
        );
      }

      //Buscamos pasajero
      if (
        !(await this.pasajerosService.findOnePasajero(
          Number(updateMonederoDto.idPasajero),
        ))
      ) {
        throw new NotFoundException();
      }

      //Buscamos Cliente
      if (
        !(await this.clientesService.getOneCliente(
          Number(updateMonederoDto.idCliente),
        ))
      ) {
        throw new NotFoundException();
      }

      //Actualizamos monedero
      const monederoData =
        await this.monederoRepository.create(updateMonederoDto);
      await this.monederoRepository.update(id, monederoData);

      // --- Registro en la bitácora ---
      await this.bitacoraLogger.logToBitacora(
        'Monederos',
        `Se actualizó el monedero con ID: ${id}`,
        'UPDATE',
        `UPDATE Monederos SET... WHERE id=${id}`,
        Number(idUser),
        20,
      );
      const monederoSave = await this.monederoRepository.findOne({
        where: { id: id },
      });

      //API response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Monedero actualizado correctamente',
        data: {
          id: id,
          nombre: `${monederoSave?.numeroSerie} ${monederoSave?.saldo} ` || '',
        },
      };
      return result;
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
      const monedero = await this.monederoRepository.findOne({
        where: { id: id },
      });
      if (!monedero) {
        throw new NotFoundException(
          `El monedero con id: ${id} no fue encontrado`,
        );
      }

      //Eliminamos de manera logica
      await this.monederoRepository.update(id, { estatus: 0 });
      // --- Registro en la bitácora ---
      await this.bitacoraLogger.logToBitacora(
        'Monederos',
        `Se elimino el monedero con ID: ${id}`,
        'DELETE',
        `DELETE From Monederos WHERE id=${id}`,
        Number(idUser),
        20,
      );

      //API response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Monedero eliminado correctamente',
        data: {
          id: id,
          nombre: `${monedero.numeroSerie} ${monedero.saldo} ` || '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al eliminar el monedero');
    }
  }
}
