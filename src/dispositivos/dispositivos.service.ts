import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateDispositivoDto } from './dto/create-dispositivo.dto';
import { UpdateDispositivoDto } from './dto/update-dispositivo.dto';
import { UpdateDispositivoEstatusDto } from './dto/update-dispositivos-estatus.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dispositivos } from 'src/entities/Dispositivos';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { ClientesService } from 'src/clientes/clientes.service';
import { Instalaciones } from 'src/entities/Instalaciones';
@Injectable()
export class DispositivosService {
  constructor(
    @InjectRepository(Dispositivos)
    private readonly dispositivoRepository: Repository<Dispositivos>,
    @InjectRepository(Instalaciones)
    private readonly instalacionesRepository: Repository<Instalaciones>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly clientesService: ClientesService,
  ) {}
  //Crear un nuevo dispositivo
  async createDispositivo(
    createDispositivoDto: CreateDispositivoDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const dispositivo = await this.dispositivoRepository.findOne({
        where: { numeroSerie: createDispositivoDto.numeroSerie },
      });
      if (dispositivo) {
        throw new BadRequestException(
          `El dispositivo con número de serie ${createDispositivoDto.numeroSerie} ya existe.`,
        );
      }
      const cliente = await this.clientesService.getOneCliente(
        //Buscamos si existe el cliente
        createDispositivoDto.idCliente,
      );
      if (!cliente)
        throw new BadRequestException(
          'Se ha proporcionado un cliente no válido.',
        );

      //Crear dispositivo
      const newDispositivo =
        await this.dispositivoRepository.create(createDispositivoDto);
      const dispositivoSave =
        await this.dispositivoRepository.save(newDispositivo);

      // --- Registro en la bitácora --- SUCCESS
      const querylogger = { createDispositivoDto };
      await this.bitacoraLogger.logToBitacora(
        'Dispositivos',
        `El dispositivo se ha creado correctamente con el número de serie ${createDispositivoDto.numeroSerie} y el ID ${dispositivoSave.id}.`,
        'CREATE',
        querylogger,
        idUser,
        11,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'El dispositivo se ha creado correctamente.',
        data: {
          id: Number(dispositivoSave.id),
          nombre:
            `${dispositivoSave.modelo} ${dispositivoSave.numeroSerie} ` || '',
        },
      };

      return result;
    } catch (error) {
      // --- Registro en la bitácora --- ERROR
      const querylogger = { createDispositivoDto };
      await this.bitacoraLogger.logToBitacora(
        'Dispositivos',
        `El dispositivo se ha creado correctamente con el número de serie ${createDispositivoDto.numeroSerie}`,
        'CREATE',
        querylogger,
        idUser,
        11,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Ocurrió un error al intentar crear el dispositivo.',
        error: error.message,
      });
    }
  }

  //Obtener todos los dispositivos por cliente
  async findAllListDispositivosClientes(id: number, cliente: number) {
    try {
      const dispositivo = await this.dispositivoRepository.find({
        where: { idCliente: id, estatus: cliente },
      });
      if (dispositivo.length === 0) {
        throw new NotFoundException(`Dispositivo no encontrado.`);
      }

      //Forzamos a cambiar el id a number
      const data = dispositivo.map((item) => ({
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
        message: 'Ocurrió un error al recuperar los dispositivos indicados.',
        error: error.message,
      });
    }
  }

  //Obtener todos los dispositivos
  async findAllList(cliente: number, rol: number): Promise<ApiResponseCommon> {
    try {
      let dispositivo;
      switch (rol) {
        case 1:
          // Consulta de datos listado Usuario SuperAdministrador
          dispositivo = await this.dispositivoRepository.query(`
        SELECT
  -- Dispositivo
  d.Id AS id,
  d.NumeroSerie AS numeroSerie,
  d.Marca AS marca,
  d.Modelo AS modelo,
  d.FechaCreacion AS fechaCreacion,
  d.FechaActualizacion AS fechaActualizacion,
  d.Estatus AS estatus,

  -- Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM Dispositivos d
INNER JOIN Clientes c ON d.IdCliente = c.Id

WHERE d.Estatus = 1

ORDER BY d.Id DESC;
        `);
          break;

        default:
          // Consulta de datos listado resto Usuario
          dispositivo = await this.dispositivoRepository.query(
            `
        SELECT
  -- Dispositivo
  d.Id AS id,
  d.NumeroSerie AS numeroSerie,
  d.Marca AS marca,
  d.Modelo AS modelo,
  d.FechaCreacion AS fechaCreacion,
  d.FechaActualizacion AS fechaActualizacion,
  d.Estatus AS estatus,

  -- Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM Dispositivos d
INNER JOIN Clientes c ON d.IdCliente = c.Id

WHERE d.IdCliente = ?
  AND d.Estatus = 1

ORDER BY d.Id DESC;
        `,
            [cliente],
          );
          break;
      }

      const data = dispositivo.map((item) => ({
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
      throw new InternalServerErrorException({
        message: 'Ocurrió un error al recuperar los dispositivos.',
        error: error.message,
      });
    }
  }
  //Obtener todos los dispositivos paginado
  async findAll(
    cliente: number,
    rol: number,
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    try {
      const offset = (page - 1) * limit;
      let dispositivo;
      let totalResult;
      switch (rol) {
        case 1:
          // Consulta de datos paginados Usuario SuperAdministrador
          dispositivo = await this.dispositivoRepository.query(
            `
        SELECT
  -- Dispositivo
  d.Id AS id,
  d.NumeroSerie AS numeroSerie,
  d.Marca AS marca,
  d.Modelo AS modelo,
  d.FechaCreacion AS fechaCreacion,
  d.FechaActualizacion AS fechaActualizacion,
  d.Estatus AS estatus,

  -- Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM Dispositivos d
INNER JOIN Clientes c ON d.IdCliente = c.Id

ORDER BY d.Id DESC
LIMIT ? OFFSET ?;
        `,
            [limit, offset],
          );

          // Query para total (sin paginación)
          totalResult = await this.dispositivoRepository.query(
            `
  SELECT COUNT(*) AS total
  FROM Dispositivos d
  `,
          );
          break;

        default:
          // Consulta de datos paginados resto Usuario
          dispositivo = await this.dispositivoRepository.query(
            `
        SELECT
  -- Dispositivo
  d.Id AS id,
  d.NumeroSerie AS numeroSerie,
  d.Marca AS marca,
  d.Modelo AS modelo,
  d.FechaCreacion AS fechaCreacion,
  d.FechaActualizacion AS fechaActualizacion,
  d.Estatus AS estatus,

  -- Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM Dispositivos d
INNER JOIN Clientes c ON d.IdCliente = c.Id

WHERE d.IdCliente = ?

ORDER BY d.Id DESC
LIMIT ? OFFSET ?;
        `,
            [cliente, limit, offset],
          );

          // Query para total (sin paginación)
          totalResult = await this.dispositivoRepository.query(
            `
  SELECT COUNT(*) AS total
  FROM Dispositivos d
  WHERE d.IdCliente= ?
  `,
            [cliente],
          );
          break;
      }

      const data = dispositivo.map((item) => ({
        ...item,
        id: Number(item.id),
        idCliente: Number(item.idCliente),
      }));

      const total = Number(totalResult[0]?.total || 0);

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
        message: `Error al obtener los dispositivos  específicos.`,
        error: error.message,
      });
    }
  }
  //Obtener dispositivo por ID
  async findOneDispositivo(id: number, cliente: number, rol: number) {
    try {
      let dispositivo;
      switch (rol) {
        case 1:
          // Consulta de datos paginados Usuario SuperAdministrador
          dispositivo = await this.dispositivoRepository.query(
            `
        SELECT
  -- Dispositivo
  d.Id AS id,
  d.NumeroSerie AS numeroSerie,
  d.Marca AS marca,
  d.Modelo AS modelo,
  d.FechaCreacion AS fechaCreacion,
  d.FechaActualizacion AS fechaActualizacion,
  d.Estatus AS estatus,

  -- Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM Dispositivos d
INNER JOIN Clientes c ON d.IdCliente = c.Id

WHERE d.Id = ?

ORDER BY d.Id DESC;
        `,
            [id],
          );
          break;

        default:
          // Consulta de datos Usuarios Normales
          dispositivo = await this.dispositivoRepository.query(
            `
        SELECT
  -- Dispositivo
  d.Id AS id,
  d.NumeroSerie AS numeroSerie,
  d.Marca AS marca,
  d.Modelo AS modelo,
  d.FechaCreacion AS fechaCreacion,
  d.FechaActualizacion AS fechaActualizacion,
  d.Estatus AS estatus,

  -- Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM Dispositivos d
INNER JOIN Clientes c ON d.IdCliente = c.Id

WHERE d.Id = ?
     AND d.IdCliente = ?

ORDER BY d.Id DESC;
        `,
            [id, cliente],
          );
          break;
      }

      if (dispositivo.length == 0) {
        throw new NotFoundException(`Dispositivo con ID: ${id} no encontrado.`);
      }
      const data = dispositivo.map((item) => ({
        ...item,
        id: Number(item.id),
        idCliente: Number(item.idCliente),
      }));
      return {
        data: data,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException({
        message: 'Ocurrió un error al recuperar los datos del dispositivo.',
        error: error.message,
      });
    }
  }
  //Actualizar el estatus del dispositivo
  async updateDispositivoEstatus(
    id: number,
    idUser: number,
    updateDispositivoEstatusDto: UpdateDispositivoEstatusDto,
  ) {
    try {
      const dispositivo = await this.dispositivoRepository.findOne({
        where: { id: id },
      });
      if (!dispositivo) {
        throw new NotFoundException(
          `No se encontró un dispositivo con ID ${id}.`,
        );
      }
      const { estatus } = updateDispositivoEstatusDto;
      if (estatus === 1) {
        const dispositivoInstalacion =
          await this.instalacionesRepository.findOne({
            where: { idDispositivo: dispositivo.id, estatus: 1 },
          });

        if (dispositivoInstalacion)
          throw new BadRequestException(
            'No es posible completar la operación: Dispositivo ya se encuentra asignado a una instalación.',
          );
      }
      await this.dispositivoRepository.update(id, {
        estatus: estatus,
      });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { updateDispositivoEstatusDto };
      await this.bitacoraLogger.logToBitacora(
        'Dispositivos',
        `Se cambió el estatus del dispositivo con ID: ${id} a estatus: ${estatus}.`,
        'UPDATE',
        querylogger,
        idUser,
        11,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'El estatus del dispositivo se ha actualizado correctamente.',
        estatus: { estatus: estatus },
        data: {
          id: id,
          nombre: `${dispositivo.modelo} ${dispositivo.numeroSerie} ` || '',
        },
      };

      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { updateDispositivoEstatusDto };
      await this.bitacoraLogger.logToBitacora(
        'Dispositivos',
        `Se cambió el estatus del dispositivo con ID: ${id} a estatus: ${updateDispositivoEstatusDto.estatus}.`,
        'UPDATE',
        querylogger,
        idUser,
        11,
        EstatusEnumBitcora.ERROR,
        error.message,
      );

      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al actualizar el estatus del dispositivo.',
        error: error.message,
      });
    }
  }

  //Actualizar datos de dispositivos
  async updateDispositivo(
    id: number,
    idUser: number,
    updateDispositivoDto: UpdateDispositivoDto,
  ): Promise<ApiCrudResponse> {
    try {
      const dispostivoExistente = await this.dispositivoRepository.findOne({
        where: { id: id },
      });
      if (!dispostivoExistente) {
        throw new NotFoundException(`Dispositivo con ID ${id} no encontrado.`);
      }

      //Actualindo dispositivo
      const dataDispositivo =
        await this.dispositivoRepository.create(updateDispositivoDto);
      await this.dispositivoRepository.update(id, dataDispositivo);

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { updateDispositivoDto };
      await this.bitacoraLogger.logToBitacora(
        'Dispositivos',
        `Se actualizó el dispositivo con ID: ${id}.`,
        'UPDATE',
        querylogger,
        idUser,
        11,
        EstatusEnumBitcora.SUCCESS,
      );

      const dispositivoActualizado = await this.dispositivoRepository.findOne({
        where: { id: id },
      });

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'El dispositivo se ha actualizado correctamente.',
        data: {
          id: id,
          nombre:
            `${dispositivoActualizado?.modelo} ${dispositivoActualizado?.numeroSerie} ` ||
            '',
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { updateDispositivoDto };
      await this.bitacoraLogger.logToBitacora(
        'Dispositivos',
        `Se actualizó el dispositivo con ID: ${id}.`,
        'UPDATE',
        querylogger,
        idUser,
        11,
        EstatusEnumBitcora.ERROR,
        error.message,
      );

      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al actualizar los datos del dispositivo.',
        error: error.message,
      });
    }
  }
  //Eliminar Dispositivos
  async removeDispositivo(
    id: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const dispositivo = await this.dispositivoRepository.findOne({
        where: { id: id },
      });
      if (!dispositivo) {
        throw new NotFoundException(
          `No se encontró el dispositivo con ID: ${id}.`,
        );
      }
      await this.dispositivoRepository.update(id, { estatus: 0 });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Dispositivo',
        `Se eliminó el dispositivo con ID: ${id}.`,
        'UPDATE',
        querylogger,
        idUser,
        11,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Dispositivo eliminado correctamente',
        data: {
          id: id,
          nombre: `${dispositivo.modelo} ${dispositivo.numeroSerie} ` || '',
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Dispositivo',
        `Se eliminó el dispositivo con ID: ${id}.`,
        'UPDATE',
        querylogger,
        idUser,
        11,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Ocurrió un error al intentar eliminar el dispositivo.',
        error: error.message,
      });
    }
  }
}
