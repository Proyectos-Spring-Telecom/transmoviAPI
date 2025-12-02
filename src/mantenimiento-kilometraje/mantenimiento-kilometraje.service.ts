import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateMantenimientoKilometrajeDto } from './dto/create-mantenimiento-kilometraje.dto';
import { UpdateMantenimientoKilometrajeDto } from './dto/update-mantenimiento-kilometraje.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { MantenimientoKilometraje } from 'src/entities/MantenimientoKilometraje';
import { Instalaciones } from 'src/entities/Instalaciones';
import { Clientes } from 'src/entities/Clientes';
import { Repository, In } from 'typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';

@Injectable()
export class MantenimientoKilometrajeService {
  constructor(
    @InjectRepository(MantenimientoKilometraje)
    private readonly mantenimientoKilometrajeRepository: Repository<MantenimientoKilometraje>,
    @InjectRepository(Instalaciones)
    private readonly instalacionesRepository: Repository<Instalaciones>,
    @InjectRepository(Clientes)
    private readonly clienteRepository: Repository<Clientes>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

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
      return { ids: [], placeholders: '' }; // No hay clientes que consultar
    }

    // Construir el query dinámico con los IDs
    const placeholders = ids.map(() => '?').join(', ');
    return { ids, placeholders };
  }

  async create(
    createMantenimientoKilometrajeDto: CreateMantenimientoKilometrajeDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const create = await this.mantenimientoKilometrajeRepository.create(
        createMantenimientoKilometrajeDto,
      );
      const saved = await this.mantenimientoKilometrajeRepository.save(create);

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { createMantenimientoKilometrajeDto };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoKilometraje',
        `Se creó un registro de mantenimiento por kilometraje con ID: ${saved.id}`,
        'CREATE',
        querylogger,
        idUser,
        5,
        EstatusEnumBitcora.SUCCESS,
      );

      const idMantenimiento = saved.id;
      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Mantenimiento por kilometraje creado correctamente',
        data: {
          id: Number(idMantenimiento),
          nombre: `Mantenimiento KM #${idMantenimiento}`,
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { createMantenimientoKilometrajeDto };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoKilometraje',
        `Error al crear mantenimiento por kilometraje`,
        'CREATE',
        querylogger,
        idUser,
        5,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException(
        'Se produjo un error al crear el mantenimiento por kilometraje.',
      );
    }
  }

  async findAll(page: number, limit: number, idCliente: number, rol: number): Promise<ApiResponseCommon> {
    try {
      const offset = (page - 1) * limit;
      let mantenimientos;
      let totalResult;

      switch (rol) {
        case 1:
        case 2:
          // Consulta de datos paginados Usuario SuperAdministrador/Administrador
          mantenimientos = await this.mantenimientoKilometrajeRepository.query(
            `
SELECT
  mk.Id AS id,
  mk.IdInstalacion AS idInstalacion,
  mk.KMinicial AS kmInicial,
  mk.KMDeseado AS kmDeseado,
  mk.Periodo AS periodo,
  mk.Anio AS anio,
  mk.FHRegistro AS fhRegistro,
  mk.Estatus AS estatus,
  veh.Placa AS placaVehiculo,
  veh.Foto AS imagenVehiculo,
  d.Id AS instalacionDispositivoId,
  d.NumeroSerie AS instalacionDispositivoNumeroSerie,
  d.Marca AS instalacionDispositivoMarca,
  d.Modelo AS instalacionDispositivoModelo,
  bv.Id AS instalacionBlueVoxId,
  bv.NumeroSerie AS instalacionBlueVoxNumeroSerie,
  bv.Marca AS instalacionBlueVoxMarca,
  bv.Modelo AS instalacionBlueVoxModelo,
  veh.Id AS instalacionVehiculoId,
  veh.Marca AS instalacionVehiculoMarca,
  veh.Modelo AS instalacionVehiculoModelo,
  c.Id AS idClienteData,
  c.Nombre AS nombreClienteData,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente
FROM MantenimientoKilometraje mk
INNER JOIN Instalaciones i ON mk.IdInstalacion = i.Id
INNER JOIN Clientes c ON i.IdCliente = c.Id
LEFT JOIN Vehiculos veh ON i.IdVehiculo = veh.Id AND i.IdCliente = veh.IdCliente
LEFT JOIN Dispositivos d ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
LEFT JOIN BlueVoxs bv ON i.IdBlueVox = bv.Id AND i.IdCliente = bv.IdCliente
ORDER BY mk.FHRegistro DESC
LIMIT ? OFFSET ?;
            `,
            [limit, offset],
          );

          // Query para total (sin paginación)
          totalResult = await this.mantenimientoKilometrajeRepository.query(
            `
SELECT COUNT(*) AS total
FROM MantenimientoKilometraje mk
INNER JOIN Instalaciones i ON mk.IdInstalacion = i.Id
INNER JOIN Clientes c ON i.IdCliente = c.Id
            `,
          );
          break;

        default:
          const { ids, placeholders } = await this.clienteHijos(idCliente);
          if (ids.length === 0) {
            return {
              data: [],
              paginated: {
                total: 0,
                page,
                lastPage: 0,
              },
            };
          }

          // Consulta de datos paginados resto Usuario
          mantenimientos = await this.mantenimientoKilometrajeRepository.query(
            `
SELECT
  mk.Id AS id,
  mk.IdInstalacion AS idInstalacion,
  mk.KMinicial AS kmInicial,
  mk.KMDeseado AS kmDeseado,
  mk.Periodo AS periodo,
  mk.Anio AS anio,
  mk.FHRegistro AS fhRegistro,
  mk.Estatus AS estatus,
  veh.Placa AS placaVehiculo,
  veh.Foto AS imagenVehiculo,
  d.Id AS instalacionDispositivoId,
  d.NumeroSerie AS instalacionDispositivoNumeroSerie,
  d.Marca AS instalacionDispositivoMarca,
  d.Modelo AS instalacionDispositivoModelo,
  bv.Id AS instalacionBlueVoxId,
  bv.NumeroSerie AS instalacionBlueVoxNumeroSerie,
  bv.Marca AS instalacionBlueVoxMarca,
  bv.Modelo AS instalacionBlueVoxModelo,
  veh.Id AS instalacionVehiculoId,
  veh.Marca AS instalacionVehiculoMarca,
  veh.Modelo AS instalacionVehiculoModelo
FROM MantenimientoKilometraje mk
INNER JOIN Instalaciones i ON mk.IdInstalacion = i.Id
INNER JOIN Clientes c ON i.IdCliente = c.Id
LEFT JOIN Vehiculos veh ON i.IdVehiculo = veh.Id AND i.IdCliente = veh.IdCliente
LEFT JOIN Dispositivos d ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
LEFT JOIN BlueVoxs bv ON i.IdBlueVox = bv.Id AND i.IdCliente = bv.IdCliente
WHERE c.Id IN (${placeholders})
ORDER BY mk.FHRegistro DESC
LIMIT ? OFFSET ?;
            `,
            [...ids, limit, offset],
          );

          // Query para total (sin paginación)
          totalResult = await this.mantenimientoKilometrajeRepository.query(
            `
SELECT COUNT(*) AS total
FROM MantenimientoKilometraje mk
INNER JOIN Instalaciones i ON mk.IdInstalacion = i.Id
INNER JOIN Clientes c ON i.IdCliente = c.Id
WHERE c.Id IN (${placeholders})
            `,
            [...ids],
          );
          break;
      }

      const total = Number(totalResult[0]?.total || 0);

      // Transformar los datos
      const mantenimientosTransformados = mantenimientos.map((item: any) => ({
        id: Number(item.id),
        idInstalacion: item.idInstalacion ? Number(item.idInstalacion) : null,
        kmInicial: item.kmInicial ? Number(item.kmInicial) : null,
        kmDeseado: item.kmDeseado ? Number(item.kmDeseado) : null,
        periodo: item.periodo,
        anio: item.anio,
        fhRegistro: item.fhRegistro,
        estatus: item.estatus,
        placaVehiculo: item.placaVehiculo || null,
        imagenVehiculo: item.imagenVehiculo || null,
        instalacion: item.idInstalacion ? { id: Number(item.idInstalacion) } : null,
        instalacionDispositivo: item.instalacionDispositivoId ? {
          id: Number(item.instalacionDispositivoId),
          numeroSerie: item.instalacionDispositivoNumeroSerie,
          marca: item.instalacionDispositivoMarca,
          modelo: item.instalacionDispositivoModelo,
        } : null,
        instalacionBlueVox: item.instalacionBlueVoxId ? {
          id: Number(item.instalacionBlueVoxId),
          numeroSerie: item.instalacionBlueVoxNumeroSerie,
          marca: item.instalacionBlueVoxMarca,
          modelo: item.instalacionBlueVoxModelo,
        } : null,
        instalacionVehiculo: item.instalacionVehiculoId ? {
          id: Number(item.instalacionVehiculoId),
          marca: item.instalacionVehiculoMarca,
          modelo: item.instalacionVehiculoModelo,
        } : null,
        ...(rol === 1 || rol === 2) && item.idClienteData ? {
          instalacionCliente: {
            id: Number(item.idClienteData),
            nombre: item.nombreClienteData,
            apellidoPaterno: item.apellidoPaternoCliente,
            apellidoMaterno: item.apellidoMaternoCliente,
            estatus: item.estatusCliente,
          },
        } : {},
      }));

      const result: ApiResponseCommon = {
        data: mantenimientosTransformados,
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
      throw new BadRequestException(
        error.message || 'Error al obtener los mantenimientos por kilometraje',
      );
    }
  }

  async findOne(id: number, idCliente: number, rol: number): Promise<ApiResponseCommon> {
    try {
      let mantenimientos;

      switch (rol) {
        case 1:
        case 2:
          // Consulta para SuperAdministrador/Administrador
          mantenimientos = await this.mantenimientoKilometrajeRepository.query(
            `
SELECT
  mk.Id AS id,
  mk.IdInstalacion AS idInstalacion,
  mk.KMinicial AS kmInicial,
  mk.KMDeseado AS kmDeseado,
  mk.Periodo AS periodo,
  mk.Anio AS anio,
  mk.FHRegistro AS fhRegistro,
  mk.Estatus AS estatus,
  veh.Placa AS placaVehiculo,
  veh.Foto AS imagenVehiculo,
  d.Id AS instalacionDispositivoId,
  d.NumeroSerie AS instalacionDispositivoNumeroSerie,
  d.Marca AS instalacionDispositivoMarca,
  d.Modelo AS instalacionDispositivoModelo,
  bv.Id AS instalacionBlueVoxId,
  bv.NumeroSerie AS instalacionBlueVoxNumeroSerie,
  bv.Marca AS instalacionBlueVoxMarca,
  bv.Modelo AS instalacionBlueVoxModelo,
  veh.Id AS instalacionVehiculoId,
  veh.Marca AS instalacionVehiculoMarca,
  veh.Modelo AS instalacionVehiculoModelo,
  c.Id AS idClienteData,
  c.Nombre AS nombreClienteData,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente
FROM MantenimientoKilometraje mk
INNER JOIN Instalaciones i ON mk.IdInstalacion = i.Id
INNER JOIN Clientes c ON i.IdCliente = c.Id
LEFT JOIN Vehiculos veh ON i.IdVehiculo = veh.Id AND i.IdCliente = veh.IdCliente
LEFT JOIN Dispositivos d ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
LEFT JOIN BlueVoxs bv ON i.IdBlueVox = bv.Id AND i.IdCliente = bv.IdCliente
WHERE mk.Id = ?
            `,
            [id],
          );
          break;

        default:
          const { ids, placeholders } = await this.clienteHijos(idCliente);
          if (ids.length === 0) {
            throw new NotFoundException('Mantenimiento por kilometraje no encontrado');
          }

          // Consulta para resto de usuarios
          mantenimientos = await this.mantenimientoKilometrajeRepository.query(
            `
SELECT
  mk.Id AS id,
  mk.IdInstalacion AS idInstalacion,
  mk.KMinicial AS kmInicial,
  mk.KMDeseado AS kmDeseado,
  mk.Periodo AS periodo,
  mk.Anio AS anio,
  mk.FHRegistro AS fhRegistro,
  mk.Estatus AS estatus,
  veh.Placa AS placaVehiculo,
  veh.Foto AS imagenVehiculo,
  d.Id AS instalacionDispositivoId,
  d.NumeroSerie AS instalacionDispositivoNumeroSerie,
  d.Marca AS instalacionDispositivoMarca,
  d.Modelo AS instalacionDispositivoModelo,
  bv.Id AS instalacionBlueVoxId,
  bv.NumeroSerie AS instalacionBlueVoxNumeroSerie,
  bv.Marca AS instalacionBlueVoxMarca,
  bv.Modelo AS instalacionBlueVoxModelo,
  veh.Id AS instalacionVehiculoId,
  veh.Marca AS instalacionVehiculoMarca,
  veh.Modelo AS instalacionVehiculoModelo
FROM MantenimientoKilometraje mk
INNER JOIN Instalaciones i ON mk.IdInstalacion = i.Id
INNER JOIN Clientes c ON i.IdCliente = c.Id
LEFT JOIN Vehiculos veh ON i.IdVehiculo = veh.Id AND i.IdCliente = veh.IdCliente
LEFT JOIN Dispositivos d ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
LEFT JOIN BlueVoxs bv ON i.IdBlueVox = bv.Id AND i.IdCliente = bv.IdCliente
WHERE c.Id IN (${placeholders})
AND mk.Id = ?
            `,
            [...ids, id],
          );
          break;
      }

      if (mantenimientos.length === 0) {
        throw new NotFoundException('Mantenimiento por kilometraje no encontrado');
      }

      const item = mantenimientos[0];

      const result: ApiResponseCommon = {
        data: [
          {
            id: Number(item.id),
            idInstalacion: item.idInstalacion ? Number(item.idInstalacion) : null,
            kmInicial: item.kmInicial ? Number(item.kmInicial) : null,
            kmDeseado: item.kmDeseado ? Number(item.kmDeseado) : null,
            periodo: item.periodo,
            anio: item.anio,
            fhRegistro: item.fhRegistro,
            estatus: item.estatus,
            placaVehiculo: item.placaVehiculo || null,
            imagenVehiculo: item.imagenVehiculo || null,
            instalacion: item.idInstalacion ? { id: Number(item.idInstalacion) } : null,
            instalacionDispositivo: item.instalacionDispositivoId ? {
              id: Number(item.instalacionDispositivoId),
              numeroSerie: item.instalacionDispositivoNumeroSerie,
              marca: item.instalacionDispositivoMarca,
              modelo: item.instalacionDispositivoModelo,
            } : null,
            instalacionBlueVox: item.instalacionBlueVoxId ? {
              id: Number(item.instalacionBlueVoxId),
              numeroSerie: item.instalacionBlueVoxNumeroSerie,
              marca: item.instalacionBlueVoxMarca,
              modelo: item.instalacionBlueVoxModelo,
            } : null,
            instalacionVehiculo: item.instalacionVehiculoId ? {
              id: Number(item.instalacionVehiculoId),
              marca: item.instalacionVehiculoMarca,
              modelo: item.instalacionVehiculoModelo,
            } : null,
            ...(rol === 1 || rol === 2) && item.idClienteData ? {
              instalacionCliente: {
                id: Number(item.idClienteData),
                nombre: item.nombreClienteData,
                apellidoPaterno: item.apellidoPaternoCliente,
                apellidoMaterno: item.apellidoMaternoCliente,
                estatus: item.estatusCliente,
              },
            } : {},
          },
        ],
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error interno al buscar el mantenimiento por kilometraje',
      );
    }
  }

  async update(
    id: number,
    updateMantenimientoKilometrajeDto: UpdateMantenimientoKilometrajeDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const mantenimiento = await this.mantenimientoKilometrajeRepository.findOne({
        where: { id: id },
      });
      if (!mantenimiento) {
        throw new NotFoundException('Mantenimiento por kilometraje no encontrado');
      }

      await this.mantenimientoKilometrajeRepository.update(
        id,
        updateMantenimientoKilometrajeDto,
      );
      const mantenimientoResult = await this.mantenimientoKilometrajeRepository.findOne({
        where: { id: id },
      });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { updateMantenimientoKilometrajeDto };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoKilometraje',
        `Se actualizó el mantenimiento por kilometraje con ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        5,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Mantenimiento por kilometraje actualizado correctamente',
        data: {
          id: id,
          nombre: `Mantenimiento KM #${id}`,
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { updateMantenimientoKilometrajeDto };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoKilometraje',
        `Error al actualizar mantenimiento por kilometraje con ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        5,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException(
        'Se produjo un error al actualizar el mantenimiento por kilometraje.',
      );
    }
  }

  async desactivar(id: number, idUser: number): Promise<ApiCrudResponse> {
    try {
      const mantenimiento = await this.mantenimientoKilometrajeRepository.findOne({
        where: { id: id },
      });

      if (!mantenimiento) {
        throw new NotFoundException('Mantenimiento por kilometraje no encontrado');
      }

      await this.mantenimientoKilometrajeRepository.update(id, { estatus: 0 });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoKilometraje',
        `Se desactivó el mantenimiento por kilometraje con ID: ${id}`,
        'UPDATE',
        querylogger,
        Number(idUser),
        5,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Mantenimiento por kilometraje desactivado correctamente',
        estatus: { estatus: 0 },
        data: {
          id: id,
          nombre: `Mantenimiento KM #${id}`,
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoKilometraje',
        `Error al desactivar mantenimiento por kilometraje con ID: ${id}`,
        'UPDATE',
        querylogger,
        Number(idUser),
        5,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al desactivar el mantenimiento por kilometraje.',
        error: error.message,
      });
    }
  }

  async activar(id: number, idUser: number): Promise<ApiCrudResponse> {
    try {
      const mantenimiento = await this.mantenimientoKilometrajeRepository.findOne({
        where: { id: id },
      });

      if (!mantenimiento) {
        throw new NotFoundException('Mantenimiento por kilometraje no encontrado');
      }

      if (mantenimiento.estatus === 1) {
        throw new BadRequestException('El mantenimiento por kilometraje ya está activo');
      }

      await this.mantenimientoKilometrajeRepository.update(id, { estatus: 1 });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { id: id, estatus: 1 };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoKilometraje',
        `Se activó el mantenimiento por kilometraje con ID: ${id}`,
        'UPDATE',
        querylogger,
        Number(idUser),
        5,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Mantenimiento por kilometraje activado correctamente',
        estatus: { estatus: 1 },
        data: {
          id: id,
          nombre: `Mantenimiento KM #${id}`,
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { id: id, estatus: 1 };
      await this.bitacoraLogger.logToBitacora(
        'MantenimientoKilometraje',
        `Error al activar mantenimiento por kilometraje con ID: ${id}`,
        'UPDATE',
        querylogger,
        Number(idUser),
        5,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al activar el mantenimiento por kilometraje.',
        error: error.message,
      });
    }
  }
}
