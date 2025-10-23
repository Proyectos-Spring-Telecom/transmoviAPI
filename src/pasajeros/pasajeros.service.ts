import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreatePasajeroDto } from './dto/create-pasajero.dto';
import { UpdatePasajeroDto } from './dto/update-pasajero.dto';
import { UpdatePasajeroEstatusDto } from './dto/update-pasajeros-estatus.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pasajeros } from 'src/entities/Pasajeros';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
@Injectable()
export class PasajerosService {
  constructor(
    @InjectRepository(Pasajeros)
    private readonly pasajeroRepository: Repository<Pasajeros>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}
  //Crear pasajero
  async createPasajeros(
    createPasajeroDto: CreatePasajeroDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const pasajero = await this.pasajeroRepository.findOne({
        where: {
          correo: createPasajeroDto.correo,
        },
      });
      if (pasajero) {
        throw new BadRequestException(
          `El pasajero con el correo electrónico ${createPasajeroDto.correo} ya se encuentra registrado.`,
        );
      }
      const newPasajero =
        await this.pasajeroRepository.create(createPasajeroDto);
      const pasajeroSave = await this.pasajeroRepository.save(newPasajero);

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { createPasajeroDto };
      await this.bitacoraLogger.logToBitacora(
        'Pasajeros',
        `Se ha creado un pasajero con el nombre: ${createPasajeroDto.nombre}.`,
        'CREATE',
        querylogger,
        idUser,
        21,
        EstatusEnumBitcora.SUCCESS,
      );

      //API response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'El pasajero ha sido creado correctamente.',
        data: {
          id: Number(pasajeroSave.id),
          nombre:
            `${pasajeroSave.nombre} ${pasajeroSave.apellidoPaterno} ` || '',
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { createPasajeroDto };
      await this.bitacoraLogger.logToBitacora(
        'Pasajeros',
        `Se ha creado un pasajero con el nombre: ${createPasajeroDto.nombre}.`,
        'CREATE',
        querylogger,
        idUser,
        21,
        EstatusEnumBitcora.ERROR,
        error.message,
      );

      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Ha ocurrido un error durante el proceso de creación del pasajero.',
      );
    }
  }
  //Obtener todos los pasajeros
  async findAllPasajeros(
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    try {
      const [data, total] = await this.pasajeroRepository.findAndCount({
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
      throw new InternalServerErrorException(
        'Se produjo un error al intentar obtener el paginado de pasajeros.',
      );
    }
  }
  //Obtener todos los pasajeros
  async findAllListPasajeros(): Promise<ApiResponseCommon> {
    try {
      const pasajerosExistentes = await this.pasajeroRepository.find({
        where: { estatus: 1 },
      });
      const result: ApiResponseCommon = {
        data: pasajerosExistentes,
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Se produjo un error al intentar obtener el listado de pasajeros.',
      );
    }
  }
  //Obtener pasajero por ID
  async findOnePasajero(id: number) {
    try {
      const pasajeroExistente = await this.pasajeroRepository.findOne({
        where: { id: id },
      });
      if (!pasajeroExistente) {
        throw new NotFoundException(
          `No se encontró un pasajero con ID: ${id}.`,
        );
      }
      return { data: pasajeroExistente };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Se produjo un error al intentar obtener los datos del pasajero.',
      );
    }
  }

  //Obtener pasajero por correo
  async findOnePasajeroCorreo(correo: string) {
    try {
      const pasajeroExistente = await this.pasajeroRepository.findOne({
        where: { correo: correo },
      });
      if (!pasajeroExistente) {
        throw new NotFoundException(
          `No se encontró un pasajero con ID: ${correo}.`,
        );
      }
      return pasajeroExistente;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Se produjo un error al intentar obtener los datos del pasajero.',
      );
    }
  }

  async obtenerMainPasajero(
    id: number,
    idUser: number,
    cliente: number,
    rol: number,
  ) {
    try {
      const pasajero = await this.pasajeroRepository.query(
        `
SELECT 
    p.Id AS idPasajero,
    u.Id AS idUsuario,
    u.UserName AS CorreoUsuario,
    CONCAT(p.Nombre, ' ', p.ApellidoPaterno, ' ', IFNULL(p.ApellidoMaterno, '')) AS NombreCompleto,
    GROUP_CONCAT(DISTINCT m.NumeroSerie ORDER BY m.NumeroSerie SEPARATOR ', ') AS Monederos,
    SUM(m.Saldo) AS SaldoTotal,
    (
        SELECT t.Monto
        FROM Transacciones t
        INNER JOIN Monederos m2 ON t.NumeroSerieMonedero = m2.NumeroSerie
        WHERE m2.IdPasajero = p.Id
          AND t.TipoTransaccion = 'RECARGA'
        ORDER BY t.FechaHora DESC
        LIMIT 1
    ) AS UltimaRecarga,
    (
        SELECT t.FechaHora
        FROM Transacciones t
        INNER JOIN Monederos m2 ON t.NumeroSerieMonedero = m2.NumeroSerie
        WHERE m2.IdPasajero = p.Id
          AND t.TipoTransaccion = 'RECARGA'
        ORDER BY t.FechaHora DESC
        LIMIT 1
    ) AS FechaUltimaRecarga,
    (
        SELECT SUM(t2.Monto)
        FROM Transacciones t2
        INNER JOIN Monederos m3 ON t2.NumeroSerieMonedero = m3.NumeroSerie
        WHERE m3.IdPasajero = p.Id
          AND t2.TipoTransaccion = 'DEBITO'
          AND t2.FechaHora >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
    ) AS TotalDebitosUltimoMes,
    (
        SELECT t3.Monto
        FROM Transacciones t3
        INNER JOIN Monederos m4 ON t3.NumeroSerieMonedero = m4.NumeroSerie
        WHERE m4.IdPasajero = p.Id
          AND t3.TipoTransaccion = 'DEBITO'
        ORDER BY t3.FechaHora DESC
        LIMIT 1
    ) AS UltimoDebito,
    (
        SELECT t3.FechaHora
        FROM Transacciones t3
        INNER JOIN Monederos m4 ON t3.NumeroSerieMonedero = m4.NumeroSerie
        WHERE m4.IdPasajero = p.Id
          AND t3.TipoTransaccion = 'DEBITO'
        ORDER BY t3.FechaHora DESC
        LIMIT 1
    ) AS FechaUltimoDebito
FROM Pasajeros p
INNER JOIN Usuarios u ON u.UserName = p.Correo
LEFT JOIN Monederos m ON p.Id = m.IdPasajero
WHERE u.Id = ?
AND m.Estatus = 1
GROUP BY p.Id, u.Id, u.UserName, NombreCompleto;
        `,
        [id],
      );

      const data = pasajero.map((item) => ({
        ...item,
        idPasajero: Number(item.idPasajero),
        idUsuario: Number(item.idUsuario),
      }));

      return {
        data: data,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Ha ocurrido un error durante el proceso de obtener main del pasajero.',
      );
    }
  }

  //Cambiar estatus del pasajero
  async updatePasajeroEstatus(
    id: number,
    updatePasajeroEstatusDto: UpdatePasajeroEstatusDto,
    idUser: number,
  ) {
    try {
      const pasajero = await this.pasajeroRepository.findOne({
        where: { id: id },
      });
      if (!pasajero) {
        throw new NotFoundException(
          `No se encontró un pasajero con ID: ${id}.`,
        );
      }
      const { estatus } = updatePasajeroEstatusDto;
      await this.pasajeroRepository.update(id, { estatus });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { updatePasajeroEstatusDto };
      await this.bitacoraLogger.logToBitacora(
        'Pasajero',
        `El estatus del pasajero con ID: ${id} ha sido actualizado a: ${updatePasajeroEstatusDto.estatus}.`,
        'UPDATE',
        querylogger,
        idUser,
        21,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: `El estatus del pasajero con ID: ${id} ha sido actualizado a: ${updatePasajeroEstatusDto.estatus}.`,
        estatus: { estatus: estatus },
        data: {
          id: id,
          nombre: `${pasajero.nombre} ${pasajero.apellidoPaterno} ` || '',
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { updatePasajeroEstatusDto };
      await this.bitacoraLogger.logToBitacora(
        'Pasajero',
        `El estatus del pasajero con ID: ${id} ha sido actualizado a: ${updatePasajeroEstatusDto.estatus}.`,
        'UPDATE',
        querylogger,
        idUser,
        21,
        EstatusEnumBitcora.ERROR,
        error.message,
      );

      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Ha ocurrido un error durante el proceso de cambio de estatus del pasajero.',
      );
    }
  }

  // Cambiar informacion del pasajero
  async updatePasajero(
    id: number,
    idUser: number,
    updatePasajeroDto: UpdatePasajeroDto,
  ): Promise<ApiCrudResponse> {
    try {
      const pasajero = await this.pasajeroRepository.findOne({
        where: { id: id },
      });
      if (!pasajero) {
        throw new NotFoundException(
          `No se encontró un pasajero con ID: ${id}.`,
        );
      }
      await this.pasajeroRepository.update(id, updatePasajeroDto);
      const pasajeroSave = await this.pasajeroRepository.findOne({
        where: { id: id },
      });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { updatePasajeroDto };
      await this.bitacoraLogger.logToBitacora(
        'Pasajeros',
        `Los datos del pasajero con ID: ${id} han sido actualizados correctamente.`,
        'UPDATE',
        querylogger,
        idUser,
        21,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: `Los datos del pasajero con ID: ${id} han sido actualizados correctamente.`,
        data: {
          id: id,
          nombre:
            `${pasajeroSave?.nombre} ${pasajeroSave?.apellidoPaterno} ` || '',
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { updatePasajeroDto };
      await this.bitacoraLogger.logToBitacora(
        'Pasajeros',
        `Los datos del pasajero con ID: ${id} han sido actualizados correctamente.`,
        'UPDATE',
        querylogger,
        idUser,
        21,
        EstatusEnumBitcora.ERROR,
        error.message,
      );

      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Se produjo un error al intentar actualizar los datos del pasajero.',
      );
    }
  }
  //Eliminar pasajero por ID
  async removePasajero(id: number, idUser: number) {
    try {
      const pasajero = await this.pasajeroRepository.findOne({
        where: { id: id },
      });
      if (!pasajero) {
        throw new NotFoundException(
          `No se encontró un pasajero con ID: ${id}.`,
        );
      }
      await this.pasajeroRepository.update(id, { estatus: 0 });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Pasajeros',
        `Se ha eliminado el pasajero ${pasajero.nombre} con ID: ${id}.`,
        'UPDATE',
        querylogger,
        idUser,
        21,
        EstatusEnumBitcora.SUCCESS,
      );

      const result: ApiCrudResponse = {
        status: 'success',
        message: 'El pasajero ha sido eliminado correctamente.',
        data: {
          id: Number(pasajero.id),
          nombre: `${pasajero.nombre} ${pasajero.apellidoPaterno} ` || '',
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Pasajeros',
        `Se elimino pasajero con id: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        21,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Ha ocurrido un error durante el proceso de eliminación del pasajero.',
      );
    }
  }
}
