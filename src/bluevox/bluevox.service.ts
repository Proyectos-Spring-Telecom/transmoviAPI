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
import { Clientes } from 'src/entities/Clientes';
import { UpdateBluevoxEstadoDto } from './dto/update-bluevox.estado.dto';
import { EstadoComponente, EstatusEnum } from 'src/common/estatus.enum';

@Injectable()
export class BluevoxService {
  constructor(
    @InjectRepository(BlueVoxs)
    private readonly bluevoxsRepository: Repository<BlueVoxs>,
    @InjectRepository(Instalaciones)
    private readonly instalacionesRepository: Repository<Instalaciones>,
    @InjectRepository(Clientes)
    private readonly clienteRepository: Repository<Clientes>,
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
      console.log(error);
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

  //funcion para obtener los clientes hijos
  private async clienteHijos(cliente: number) {
    const clientesFiltrado = await this.clienteRepository.query(
      `CALL spGetClientes(?);`,
      [cliente],
    );

    const idsFiltrados = clientesFiltrado[0]; // El primer índice contiene los resultados
    const ids = idsFiltrados
      .map((clientesFiltrado: any) => Number(clientesFiltrado.Id))
      .filter(Boolean);
    if (ids.length === 0) {
      return { data: [] }; // No hay clientes que consultar
    }

    // 3. Construir el query dinámico con los IDs
    const placeholders = ids.map(() => '?').join(', ');
    return { ids, placeholders };
  }

  //Obtener los bluevox por cliente -- obsoleto
  async findAllListClientes(id: number, cliente: number) {
    try {
      const bluevox = await this.bluevoxsRepository.find({
        where: {
          idCliente: id,
          estatus: EstatusEnum.ACTIVO,
          estadoActual: EstadoComponente.DISPONIBLE,
        },
      });
      

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
      console.log(error);
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
  b.EstadoActual as estadoActual,
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
INNER JOIN Clientes c ON b.IdCliente = c.Id
  `,
          );
          break;

        default:
          // Consulta de datos paginados resto Usuario
          const { ids, placeholders } = await this.clienteHijos(cliente);
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
  b.EstadoActual as estadoActual,
  b.Estatus AS estatus,

  -- Datos del Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM BlueVoxs b
INNER JOIN Clientes c ON b.IdCliente = c.Id
WHERE b.IdCliente IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar

ORDER BY b.Id DESC
LIMIT ? OFFSET ?;
        `,
            [...ids, limit, offset],
          );

          // Query para total (sin paginación)
          totalResult = await this.bluevoxsRepository.query(
            `
  SELECT COUNT(*) AS total
FROM BlueVoxs b
INNER JOIN Clientes c ON b.IdCliente = c.Id
WHERE b.IdCliente IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar
  `,
            [...ids],
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
      console.log(error);
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
  b.EstadoActual as estadoActual,
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
AND b.EstadoActual = 1
AND c.Estatus = 1
ORDER BY b.Id DESC;
        `,
          );
          break;

        default:
          // Consulta de datos listado resto Usuario
          const { ids, placeholders } = await this.clienteHijos(cliente);
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
  b.EstadoActual as estadoActual,
  b.Estatus AS estatus,

  -- Datos del Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM BlueVoxs b
INNER JOIN Clientes c ON b.IdCliente = c.Id
WHERE b.IdCliente IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar
AND b.Estatus = 1
AND b.EstadoActual = 1
AND c.Estatus = 1
ORDER BY b.Id DESC;
        `,
            [...ids],
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
      console.log(error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException(
        'Se produjo un error al obtener el listado de BlueVoxs.',
      );
    }
  }

  //Obtener por ID
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
  b.EstadoActual as estadoActual,
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
          const { ids, placeholders } = await this.clienteHijos(cliente);
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
  b.EstadoActual as estadoActual,
  b.Estatus AS estatus,

  -- Datos del Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM BlueVoxs b
INNER JOIN Clientes c ON b.IdCliente = c.Id
WHERE b.IdCliente IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar
AND b.Id = ?
ORDER BY b.Id DESC;
        `,
            [...ids, id],
          );
          break;
      }

      if (bluevoxs.length == 0) {
        throw new NotFoundException(`No se encontró un BlueVox con ID: ${id}.`);
      }

      const data = bluevoxs.map((item) => ({
        ...item,
        id: Number(item.id),
        idCliente: Number(item.idCliente),
      }));

      return data;
    } catch (error) {
      console.log(error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'No fue posible recuperar la información del BlueVox.',
      });
    }
  }

  //Actualizar equipo
  async update(id: number, idUser: number, updateBluevoxDto: UpdateBluevoxDto) {
    try {
      const bluevox = await this.bluevoxsRepository.findOne({
        where: { id: id },
      });
      if (!bluevox)
        throw new NotFoundException(`No se encontró un BlueVox con ID: ${id}.`);
      await this.bluevoxsRepository.update(id, updateBluevoxDto);

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { updateBluevoxDto };
      await this.bitacoraLogger.logToBitacora(
        'BlueVoxs',
        `Se actualizó el BlueVox con ID: ${id}.`,
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
      console.log(error);
      //-----Registro en la bitacora----- ERROR
      const querylogger = { updateBluevoxDto };
      await this.bitacoraLogger.logToBitacora(
        'BlueVoxs',
        `Se actualizó el BlueVox con ID: ${id}.`,
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

  //actualizar estatus
  async updateEstatus(
    id: number,
    idUser: number,
    updateBlueVoxEstatusDto: UpdateBlueVoxEstatusDto,
  ) {
    try {
      //buscamos y validamos que exista
      const bluevoxs = await this.bluevoxsRepository.findOne({
        where: { id: id },
      });
      if (!bluevoxs)
        throw new NotFoundException(`No se encontró un BlueVox con ID: ${id}.`);

      //Obtenemos el estatus
      const estatus = updateBlueVoxEstatusDto.estatus;

      //logica si estatus es 0
      if (estatus === 0) {
        //buscamos que no este asiganada a una instalacion
        const bluevoxInstalacion = await this.instalacionesRepository.findOne({
          where: { idBlueVox: bluevoxs.id, estatus: 1 },
        });
        if (bluevoxInstalacion)
          throw new BadRequestException(
            'No es posible completar la operación: BlueVoxs se encuentra asignado a una instalación.',
          );

        //actualizamos el estado del componente a INACTIVO
        await this.bluevoxsRepository.update(id, {
          estadoActual: EstadoComponente.INACTIVO,
        });
      } else {
        //actualizamos el estado del componente a DISPONIBLE
        await this.bluevoxsRepository.update(id, {
          estadoActual: EstadoComponente.DISPONIBLE,
        });
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
      console.log(error);
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

  //actualizar estatus
  async updateEstado(
    id: number,
    idUser: number,
    updateBluevoxEstadoDto: UpdateBluevoxEstadoDto,
  ) {
    try {
      //buscamos y validamos que exista
      const bluevoxs = await this.bluevoxsRepository.findOne({
        where: { id: id },
      });
      if (!bluevoxs)
        throw new NotFoundException(`No se encontró un BlueVox con ID: ${id}.`);

      //buscamos que no este asiganada a una instalacion
      const bluevoxInstalacion = await this.instalacionesRepository.findOne({
        where: { idBlueVox: bluevoxs.id, estatus: 1 },
      });
      if (bluevoxInstalacion)
        throw new BadRequestException(
          'No es posible completar la operación: BlueVoxs se encuentra asignado a una instalación.',
        );

      //logica si estado del componente esta asignado
      if (
        bluevoxs.estadoActual === EstadoComponente.INACTIVO &&
        bluevoxs.estatus === EstatusEnum.INACTIVO
      ) {
        throw new BadRequestException(
          'No es posible completar la operación: BlueVoxs se encuentra asignado a una instalación.',
        );
      }
      //obtenemos el valor de estado
      const estadoActual = updateBluevoxEstadoDto.estadoActual;
      //se cambia estado del componente
      await this.bluevoxsRepository.update(id, { estadoActual: estadoActual });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { updateBluevoxEstadoDto };
      await this.bitacoraLogger.logToBitacora(
        'BlueVoxs',
        `Se actualizo el estado del bluevoxs con ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        12,
        EstatusEnumBitcora.SUCCESS,
      );

      // ----- Api response -----
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Estado de bluevoxs actualizado correctamente',
        estatus: { estatus: Number(estadoActual) },
        data: {
          id: id,
          nombre: `${bluevoxs.modelo} ${bluevoxs.numeroSerie} ` || '',
        },
      };
      return result;
    } catch (error) {
      console.log(error);
      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { updateBluevoxEstadoDto };
      await this.bitacoraLogger.logToBitacora(
        'BlueVoxs',
        `Se actualizo el estado del bluevoxs con ID: ${id}`,
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
        message: 'Error al actualizar estado del bluevoxs.',
        error: error.message,
      });
    }
  }

  async remove(id: number, idUser: number) {
    try {
      //buscamos y validamos que exista
      const bluevoxs = await this.bluevoxsRepository.findOne({
        where: { id: id },
      });
      if (!bluevoxs)
        throw new NotFoundException(`No se encontró un BlueVox con ID: ${id}.`);

      //buscamos que no este asiganada a una instalacion
      const bluevoxInstalacion = await this.instalacionesRepository.findOne({
        where: { idBlueVox: bluevoxs.id, estatus: 1 },
      });
      if (bluevoxInstalacion)
        throw new BadRequestException(
          'No es posible completar la operación: BlueVoxs se encuentra asignado a una instalación.',
        );

      //actualizamos el estado del componente a INACTIVO
      await this.bluevoxsRepository.update(id, { estadoActual: 0 });

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
      console.log(error);
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
