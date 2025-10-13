import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateBlueVoxsDto } from './dto/create-bluevox.dto';
import { UpdateBluevoxDto } from './dto/update-bluevox.dto';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { InjectRepository } from '@nestjs/typeorm';
import { BlueVoxs } from 'src/entities/BlueVoxs';
import { Repository } from 'typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { UpdateBlueVoxEstatusDto } from './dto/update-bluevox-estatus.dto';
import { Instalaciones } from 'src/entities/Instalaciones';

@Injectable()
export class BluevoxService {
  constructor(
    @InjectRepository(BlueVoxs)
    private readonly bluevoxsRepository: Repository<BlueVoxs>,
    @InjectRepository(Instalaciones)
    private readonly instalacionesRepository: Repository<Instalaciones>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  //Crear Bluevoxs
  async create(
    idUser: number,
    createBlueVoxDto: CreateBlueVoxsDto,
  ): Promise<ApiCrudResponse> {
    try {
      const blueVoxs = await this.bluevoxsRepository.findOne({
        where: { numeroSerie: createBlueVoxDto.numeroSerie },
      });
      if (blueVoxs) {
        throw new BadRequestException(
          `BlueVox registrado con número de serie: ${blueVoxs.numeroSerie}.`,
        );
      }

      //Se crea bluvoxs
      const newBlueVoxs =
        await this.bluevoxsRepository.create(createBlueVoxDto);
      const bluevoxSave = await this.bluevoxsRepository.save(newBlueVoxs);

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { createBlueVoxDto };
      await this.bitacoraLogger.logToBitacora(
        'Bluevoxs',
        `Se creó un BlueVox con número de serie: ${bluevoxSave.numeroSerie}.`,
        'CREATE',
        querylogger,
        idUser,
        12,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'BlueVox creado correctamente.',
        data: {
          id: Number(bluevoxSave.id),
          nombre: `${bluevoxSave.marca} ${bluevoxSave.numeroSerie} ` || '',
        },
      };

      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { createBlueVoxDto };
      await this.bitacoraLogger.logToBitacora(
        'Bluevoxs',
        `Se creó un BlueVox con número de serie: ${createBlueVoxDto.numeroSerie}.`,
        'CREATE',
        querylogger,
        idUser,
        12,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Ocurrió un error al intentar crear un BlueVox.',
        error: error.message,
      });
    }
  }

  //Obtener los bluevox por cliente
  async findAllListClientes(id: number, cliente: number) {
    try {
      const bluevox = await this.bluevoxsRepository.find({
        where: { idCliente: id, estatus: cliente },
      });
      if (bluevox.length === 0) {
        throw new NotFoundException(`No se encontraron BlueVoxs.`);
      }

      //Forzamos a cambiar el id a number
      const data = bluevox.map((item) => ({
        ...item,
        id: Number(item.id),
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
        message: `Error al obtener los bluevoxs.`,
        error: error.message,
      });
    }
  }

  //Obtner paginado
  async findAll(
    cliente: number,
    rol: number,
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    try {
      const offset = (page - 1) * limit;
      let bluevoxs;
      let totalResult;
      switch (rol) {
        case 1:
          // Consulta de datos paginados Usuario SuperAdministrador
          bluevoxs = await this.bluevoxsRepository.query(
            `
SELECT
  -- Datos del BlueVox
  b.Id AS id,
  b.NumeroSerie AS numeroSerie,
  b.Marca AS marca,
  b.Modelo AS modelo,
  b.FechaCreacion AS fechaCreacion,
  b.FechaActualizacion AS fechaActualizacion,
  b.Estatus AS estatus,

  -- Datos del Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM BlueVoxs b
INNER JOIN Clientes c ON b.IdCliente = c.Id

ORDER BY b.Id DESC
LIMIT ? OFFSET ?;
        `,
            [limit, offset],
          );

          // Query para total (sin paginación)
          totalResult = await this.bluevoxsRepository.query(
            `
  SELECT COUNT(*) AS total
  FROM BlueVoxs b
  `,
          );
          break;

        default:
          // Consulta de datos paginados resto Usuario
          bluevoxs = await this.bluevoxsRepository.query(
            `
SELECT
  -- Datos del BlueVox
  b.Id AS id,
  b.NumeroSerie AS numeroSerie,
  b.Marca AS marca,
  b.Modelo AS modelo,
  b.FechaCreacion AS fechaCreacion,
  b.FechaActualizacion AS fechaActualizacion,
  b.Estatus AS estatus,

  -- Datos del Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM BlueVoxs b
INNER JOIN Clientes c ON b.IdCliente = c.Id
WHERE b.IdCliente = ?

ORDER BY b.Id DESC
LIMIT ? OFFSET ?;
        `,
            [cliente, limit, offset],
          );

          // Query para total (sin paginación)
          totalResult = await this.bluevoxsRepository.query(
            `
  SELECT COUNT(*) AS total
  FROM BlueVoxs b
  WHERE b.IdCliente = ?
  `,
            [cliente],
          );
          break;
      }

      const data = bluevoxs.map((item) => ({
        ...item,
        id: Number(item.id),
        idCliente: Number(item.idCliente),
      }));

      const total = Number(totalResult[0]?.total ?? 0);
      //Apis response
      const result: ApiResponseCommon = {
        data: data,
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
        message: `Error al obtener paginado BlueVoxs.`,
        error: error.message,
      });
    }
  }

  async findAllList(cliente: number, rol: number): Promise<ApiResponseCommon> {
    try {
      let bluevoxs;
      switch (rol) {
        case 1:
          // Consulta de datos listado Usuario SuperAdministrador
          bluevoxs = await this.bluevoxsRepository.query(
            `
SELECT
  -- Datos del BlueVox
  b.Id AS id,
  b.NumeroSerie AS numeroSerie,
  b.Marca AS marca,
  b.Modelo AS modelo,
  b.FechaCreacion AS fechaCreacion,
  b.FechaActualizacion AS fechaActualizacion,
  b.Estatus AS estatus,

  -- Datos del Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM BlueVoxs b
INNER JOIN Clientes c ON b.IdCliente = c.Id
WHERE b.Estatus = 1
ORDER BY b.Id DESC;
        `,
          );
          break;

        default:
          // Consulta de datos listado resto Usuario
          bluevoxs = await this.bluevoxsRepository.query(
            `
SELECT
  -- Datos del BlueVox
  b.Id AS id,
  b.NumeroSerie AS numeroSerie,
  b.Marca AS marca,
  b.Modelo AS modelo,
  b.FechaCreacion AS fechaCreacion,
  b.FechaActualizacion AS fechaActualizacion,
  b.Estatus AS estatus,

  -- Datos del Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM BlueVoxs b
INNER JOIN Clientes c ON b.IdCliente = c.Id
WHERE b.IdCliente = ?
AND b.Estatus = 1
ORDER BY b.Id DESC;
        `,
            [cliente],
          );
          break;
      }

      const data = bluevoxs.map((item) => ({
        ...item,
        id: Number(item.id),
        idCliente: Number(item.idCliente),
      }));

      const result: ApiResponseCommon = {
        data: data,
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({ message: 'Error al BlueVoxs Clientes' });
    }
  }

  async findOne(id: number, cliente: number, rol: number) {
    try {
      let bluevoxs;
      switch (rol) {
        case 1:
          bluevoxs = await this.bluevoxsRepository.query(
            `
SELECT
  -- Datos del BlueVox
  b.Id AS id,
  b.NumeroSerie AS numeroSerie,
  b.Marca AS marca,
  b.Modelo AS modelo,
  b.FechaCreacion AS fechaCreacion,
  b.FechaActualizacion AS fechaActualizacion,
  b.Estatus AS estatus,

  -- Datos del Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM BlueVoxs b
INNER JOIN Clientes c ON b.IdCliente = c.Id
WHERE b.Id = ?
ORDER BY b.Id DESC;
        `,
            [id],
          );
          break;

        default:
          bluevoxs = await this.bluevoxsRepository.query(
            `
SELECT
  -- Datos del BlueVox
  b.Id AS id,
  b.NumeroSerie AS numeroSerie,
  b.Marca AS marca,
  b.Modelo AS modelo,
  b.FechaCreacion AS fechaCreacion,
  b.FechaActualizacion AS fechaActualizacion,
  b.Estatus AS estatus,

  -- Datos del Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM BlueVoxs b
INNER JOIN Clientes c ON b.IdCliente = c.Id
WHERE b.IdCliente = ?
AND b.Id = ?
ORDER BY b.Id DESC;
        `,
            [cliente, id],
          );
          break;
      }

      if (bluevoxs.length == 0) {
        throw new NotFoundException(`BlueVox con ID:${id} no encontrado`);
      }

      const data = bluevoxs.map((item) => ({
        ...item,
        id: Number(item.id),
        idCliente: Number(item.idCliente),
      }));

      return data;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtener BlueVoxs',
      });
    }
  }

  async update(id: number, idUser: number, updateBluevoxDto: UpdateBluevoxDto) {
    try {
      const bluevox = await this.bluevoxsRepository.findOne({
        where: { id: id },
      });
      if (!bluevox) throw new NotFoundException('BlueVox no encontrado');
      await this.bluevoxsRepository.update(id, updateBluevoxDto);

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { updateBluevoxDto };
      await this.bitacoraLogger.logToBitacora(
        'BlueVoxs',
        `Se actualizo el bluevox con ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        12,
        EstatusEnumBitcora.SUCCESS,
      );

      // ----- Api response -----
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'BlueVoxs actualizado correctamente',
        data: {
          id: id,
          nombre:
            `${bluevox.marca || updateBluevoxDto.marca} ${bluevox.numeroSerie || updateBluevoxDto.numeroSerie} ` ||
            '',
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { updateBluevoxDto };
      await this.bitacoraLogger.logToBitacora(
        'BlueVoxs',
        `Se actualizo el bluevox con ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        12,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Ocurrió un error al intentar actualizar bluevoxs.',
        error: error.message,
      });
    }
  }

  async updateEstatus(
    id: number,
    idUser: number,
    updateBlueVoxEstatusDto: UpdateBlueVoxEstatusDto,
  ) {
    try {
      const bluevoxs = await this.bluevoxsRepository.findOne({
        where: { id: id },
      });
      if (!bluevoxs) throw new NotFoundException('BlueVoxs no encontrado');
      const estatus = updateBlueVoxEstatusDto.estatus;
      if (estatus === 1) {
        const bluevoxInstalacion = await this.instalacionesRepository.findOne({
          where: { idBlueVox: bluevoxs.id, estatus: 1 },
        });
        if (bluevoxInstalacion)
          throw new BadRequestException(
            'No es posible completar la operación: BlueVoxs ya se encuentra asignado a una instalación.',
          );
      }
      await this.bluevoxsRepository.update(id, { estatus: estatus });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { updateBlueVoxEstatusDto };
      await this.bitacoraLogger.logToBitacora(
        'BlueVoxs',
        `Se actualizo el estatus del bluevoxs con ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        12,
        EstatusEnumBitcora.SUCCESS,
      );

      // ----- Api response -----
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Estatus de bluevoxs actualizado correctamente',
        estatus: { estatus: estatus },
        data: {
          id: id,
          nombre: `${bluevoxs.modelo} ${bluevoxs.numeroSerie} ` || '',
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { updateBlueVoxEstatusDto };
      await this.bitacoraLogger.logToBitacora(
        'BlueVoxs',
        `Se actualizo el estatus del bluevoxs con ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        12,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al actualizar estatus del bluevoxs.',
        error: error.message,
      });
    }
  }

  async remove(id: number, idUser: number) {
    try {
      const bluevoxs = await this.bluevoxsRepository.findOne({
        where: { id: id },
      });
      if (!bluevoxs) throw new NotFoundException('BlueVox no encontrado');

      await this.bluevoxsRepository.update(id, { estatus: 0 });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'BlueVoxs',
        `Se eliminó el bluevoxs con ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        12,
        EstatusEnumBitcora.SUCCESS,
      );

      // ----- Api response -----
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'BlueVox eliminado correctamente',
        data: {
          id: id,
          nombre: `${bluevoxs.modelo} ${bluevoxs.numeroSerie} ` || '',
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'BlueVoxs',
        `Se eliminó el bluevoxs con ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        12,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Ocurrió un error al intentar eliminar el bluevoxs.',
        error: error.message,
      });
    }
  }
}
