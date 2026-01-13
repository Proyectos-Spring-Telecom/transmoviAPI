import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateInstalacionesDto } from './dto/create-instalacione.dto';
import { UpdateInstalacioneDto } from './dto/update-instalacione.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Instalaciones } from 'src/entities/Instalaciones';
import { Repository } from 'typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { UpdateInstalacioneEstatusDto } from './dto/update-instalacione-estatus.dto';
import { UsuariosInstalaciones } from 'src/entities/UsuariosInstalaciones';
import { Dispositivos } from 'src/entities/Dispositivos';
import { BlueVoxs } from 'src/entities/BlueVoxs';
import { Vehiculos } from 'src/entities/Vehiculos';
import { Clientes } from 'src/entities/Clientes';
import { HistoricoInstalaciones } from 'src/entities/historico-instalaciones';
import { HistoricoinstalacionesService } from 'src/historicoinstalaciones/historicoinstalaciones.service';
import { EnumModulos, EstadoComponente, EstatusEnum } from 'src/common/estatus.enum';

@Injectable()
export class InstalacionesService {
  constructor(
    @InjectRepository(Instalaciones)
    private readonly instalacionesRepository: Repository<Instalaciones>,
    @InjectRepository(Dispositivos)
    private readonly dispositivosRepository: Repository<Dispositivos>,
    @InjectRepository(BlueVoxs)
    private readonly bluevoxsRepository: Repository<BlueVoxs>,
    @InjectRepository(Vehiculos)
    private readonly vehiculosRepository: Repository<Vehiculos>,
    @InjectRepository(UsuariosInstalaciones)
    private readonly usuariosinstalacionesRepository: Repository<UsuariosInstalaciones>,
    @InjectRepository(Clientes)
    private readonly clienteRepository: Repository<Clientes>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly historicoinstalacionesService: HistoricoinstalacionesService,
  ) { }

  // ========================================
  // 🔹 CREAR UN INSTALACION
  // ========================================
  async create(
    idUser: number,
    cliente: number,
    rol: number,
    createInstalacioneDto: CreateInstalacionesDto,
  ): Promise<ApiCrudResponse> {
    try {
      let permiso;
      // ✅ VALIDACIÓN MEJORADA: Verificar todos los conflictos con relaciones
      const errores: string[] = [];

      // Verificar dispositivo CON relaciones
      const dispositivoEnUso = await this.instalacionesRepository.findOne({
        where: {
          idDispositivo: createInstalacioneDto.idDispositivo,
          estatus: 1,
        },
        relations: ['dispositivos'],
      });
      if (dispositivoEnUso) {
        errores.push(
          ` Dispositivo ${dispositivoEnUso.dispositivos.numeroSerie} ya está en uso.`,
        );
      }

      // Verificar BlueVox CON relaciones
      const blueVoxEnUso = await this.instalacionesRepository.findOne({
        where: { idBlueVox: createInstalacioneDto.idBlueVox, estatus: 1 },
        relations: ['blueVoxs'],
      });
      if (blueVoxEnUso) {
        errores.push(
          ` BlueVox ${blueVoxEnUso.blueVoxs.numeroSerie} ya está en uso.`,
        );
      }

      // Verificar Vehículo CON relaciones
      const vehiculoEnUso = await this.instalacionesRepository.findOne({
        where: { idVehiculo: createInstalacioneDto.idVehiculo, estatus: 1 },
        relations: ['vehiculos'],
      });
      if (vehiculoEnUso) {
        errores.push(
          ` Vehículo con placa ${vehiculoEnUso.vehiculos.placa} ya está en uso.`,
        );
      }

      // Si hay conflictos, lanzar error con todos los detalles
      if (errores.length > 0) {
        throw new BadRequestException({
          message: `No se puede crear la instalación debido a los siguientes conflictos: ${errores[0]}`,
          errors: errores,
          conflictsCount: errores.length,
        });
      }

      // Crear instalación y guardarla en la base de datos
      const newInstalaciones = await this.instalacionesRepository.create(
        createInstalacioneDto,
      );
      const instalacionSave =
        await this.instalacionesRepository.save(newInstalaciones);

      //Asignamos a root la region
      switch (rol) {
        case 1:
          permiso = {
            estatus: 1,
            idUsuario: 1, //Se asigna al usuario supremo
            idInstalacion: instalacionSave.id,
          };
          await this.usuariosinstalacionesRepository.save(permiso);
          break;

        case 2:
          permiso = {
            estatus: 1,
            idUsuario: 1, //Se asigna al usuario supremo
            idInstalacion: instalacionSave.id,
          };
          await this.usuariosinstalacionesRepository.save(permiso);
          permiso = {
            estatus: 1,
            idUsuario: idUser, //Se asigna al Administrador
            idInstalacion: instalacionSave.id,
          };
          await this.usuariosinstalacionesRepository.save(permiso);
          break;

        default:
          permiso = {
            estatus: 1,
            idUsuario: 1, //Se asigna al usuario supremo SuperAdministrador
            idInstalacion: instalacionSave.id,
          };
          await this.usuariosinstalacionesRepository.save(permiso);
          break;
      }
      const body = { estadoActual: EstadoComponente.ASIGNADO };

      //actualizamos estatus de los componentes de la instalacion
      await this.dispositivosRepository.update(
        createInstalacioneDto.idDispositivo,
        body,
      );
      await this.bluevoxsRepository.update(
        createInstalacioneDto.idBlueVox,
        body,
      );
      await this.vehiculosRepository.update(
        createInstalacioneDto.idVehiculo,
        body,
      );

      // Registro en la bitácora SUCCESS
      const querylogger = { createInstalacioneDto };
      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `La instalación con ID: ${instalacionSave.id} ha sido creada exitosamente.`,
        'CREATE',
        querylogger,
        idUser,
        EnumModulos.INSTALACIONES,
        EstatusEnumBitcora.SUCCESS,
      );

      //Registro historico
      await this.historicoinstalacionesService.createHistorico(
        instalacionSave.id,
        instalacionSave.idDispositivo,
        instalacionSave.idBlueVox,
        instalacionSave.idVehiculo,
        instalacionSave.idCliente,
        idUser,
      );

      // API response (con mensajes corregidos)
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'La instalación ha sido creada correctamente.',
        data: {
          id: Number(instalacionSave.id),
          nombre: `Instalación ${instalacionSave.id} registrada con los siguientes detalles: Dispositivo: ${instalacionSave.idDispositivo}, BlueVox: ${instalacionSave.idBlueVox}, Vehículo: ${instalacionSave.idVehiculo}.`, // ✅ Mejorado
        },
      };

      return result;
    } catch (error) {
      console.log(error);
      // Registro en la bitácora ERROR
      const querylogger = { createInstalacioneDto };
      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `Se creó una Instalación con `, // ✅ Corregido
        'CREATE',
        querylogger,
        idUser,
        EnumModulos.INSTALACIONES,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }

      // ✅ Manejo específico para errores de FK (del error original que tenías)
      if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        throw new BadRequestException({
          message: 'Error de referencia en la base de datos',
          details:
            'Verifica que los IDs de Cliente, Dispositivo, BlueVox y Vehículo sean válidos y existan en el sistema',
          sqlError: 'La combinación Cliente-Dispositivo no es válida',
        });
      }

      throw new InternalServerErrorException({
        message: 'Error al crear Instalación',
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

  private async consultarInstalacionesPaginado(
    cliente: number,
    limit: number,
    offset: number,
  ) {
    const { ids, placeholders } = await this.clienteHijos(cliente);
    const query = `
SELECT
  -- Instalación
  i.Id AS id,
  i.FechaCreacion AS fechaCreacion,
  i.FechaActualizacion AS fechaActualizacion,
  i.Estatus AS estatus,

  -- Dispositivo
  i.IdDispositivo AS idDispositivo,
  d.NumeroSerie AS numeroSerieDispositivo,
  d.Marca AS marcaDispositivo,
  d.Modelo AS modeloDispositivo,

  -- BlueVox
  i.IdBlueVox AS idBlueVox,
  b.NumeroSerie AS numeroSerieBlueVox,
  b.Marca AS marcaBlueVox,
  b.Modelo AS modeloBlueVox,

  -- Vehículo
  i.IdVehiculo AS idVehiculo,
  v.Marca AS marcaVehiculo,
  v.Modelo AS modeloVehiculo,
  v.Placa AS placaVehiculo,
  v.NumeroEconomico AS numeroEconomicoVehiculo,

  -- Cliente
  i.IdCliente AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM Instalaciones i
INNER JOIN Dispositivos d ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
INNER JOIN BlueVoxs b ON i.IdBlueVox = b.Id AND i.IdCliente = b.IdCliente
INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
INNER JOIN Clientes c ON i.IdCliente = c.Id

WHERE c.Id IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar
  

ORDER BY i.Id DESC
LIMIT ? OFFSET ?;
   `;
    return this.instalacionesRepository.query(query, [...ids, limit, offset]);
  }

  private async consultarTotalInstalacionesPaginados(cliente: number) {
    const { ids, placeholders } = await this.clienteHijos(cliente);
    const query = `  
  SELECT COUNT(*) AS total
  FROM Instalaciones i
INNER JOIN Dispositivos d ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
INNER JOIN BlueVoxs b ON i.IdBlueVox = b.Id AND i.IdCliente = b.IdCliente
INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
INNER JOIN Clientes c ON i.IdCliente = c.Id

WHERE c.Id IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar
  
`;
    return await this.instalacionesRepository.query(query, [...ids]);
  }

  // ========================================
  // 🔹 OBTENER PAGINADO DE INSTALACIONES
  // ========================================
  async findAll(
    idUser: number,
    cliente: number,
    rol: number,
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    try {
      let instalaciones;
      let totalResult;
      const offset = (page - 1) * limit;
      switch (rol) {
        case 1:
          // Consulta de datos paginados Usuario SuperAdministrador
          instalaciones = await this.usuariosinstalacionesRepository.query(
            `
SELECT
  -- Instalación
  i.Id AS id,
  i.FechaCreacion AS fechaCreacion,
  i.FechaActualizacion AS fechaActualizacion,
  i.Estatus AS estatus,

  -- Dispositivo
  i.IdDispositivo AS idDispositivo,
  d.NumeroSerie AS numeroSerieDispositivo,
  d.Marca AS marcaDispositivo,
  d.Modelo AS modeloDispositivo,

  -- BlueVox
  i.IdBlueVox AS idBlueVox,
  b.NumeroSerie AS numeroSerieBlueVox,
  b.Marca AS marcaBlueVox,
  b.Modelo AS modeloBlueVox,

  -- Vehículo
  i.IdVehiculo AS idVehiculo,
  v.Marca AS marcaVehiculo,
  v.Modelo AS modeloVehiculo,
  v.Placa AS placaVehiculo,
  v.NumeroEconomico AS numeroEconomicoVehiculo,

  -- Cliente
  i.IdCliente AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM Instalaciones i
INNER JOIN Dispositivos d ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
INNER JOIN BlueVoxs b ON i.IdBlueVox = b.Id AND i.IdCliente = b.IdCliente
INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
INNER JOIN Clientes c ON i.IdCliente = c.Id


  

ORDER BY i.Id DESC
  LIMIT ? OFFSET ?;

  `,
            [limit, offset],
          );
          // Query para total (sin paginación)
          totalResult = await this.instalacionesRepository.query(
            `
  SELECT COUNT(*) AS total
  FROM Instalaciones i
INNER JOIN Dispositivos d ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
INNER JOIN BlueVoxs b ON i.IdBlueVox = b.Id AND i.IdCliente = b.IdCliente
INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
INNER JOIN Clientes c ON i.IdCliente = c.Id


		
  `,
          );
          break;

        case 2:
          // Consulta de datos paginados Usuario Administrador
          instalaciones = await this.consultarInstalacionesPaginado(
            cliente,
            limit,
            offset,
          );
          // Query para total (sin paginación)
          totalResult =
            await this.consultarTotalInstalacionesPaginados(cliente);
          break;

        case 3:
          // Consulta de datos paginados Usuario Operador
          instalaciones = await this.consultarInstalacionesPaginado(
            cliente,
            limit,
            offset,
          );
          // Query para total (sin paginación)
          totalResult =
            await this.consultarTotalInstalacionesPaginados(cliente);
          break;

        case 8:
          // Consulta de datos paginados Usuario Reportes
          instalaciones = await this.consultarInstalacionesPaginado(
            cliente,
            limit,
            offset,
          );
          // Query para total (sin paginación)
          totalResult =
            await this.consultarTotalInstalacionesPaginados(cliente);
          break;

        case 10:
          // Consulta de datos paginados Usuario Capturista
          instalaciones = await this.consultarInstalacionesPaginado(
            cliente,
            limit,
            offset,
          );
          // Query para total (sin paginación)
          totalResult =
            await this.consultarTotalInstalacionesPaginados(cliente);
          break;

        default:
          // Usuarios normales - solo sus instalaciones asignadas
          instalaciones = await this.usuariosinstalacionesRepository.query(
            `
SELECT
  -- Instalación */*/*/* para resto Usuarios
  i.Id AS id,
  i.FechaCreacion AS fechaCreacion,
  i.FechaActualizacion AS fechaActualizacion,
  i.Estatus AS estatus,
  
  -- Dispositivo
  i.IdDispositivo AS idDispositivo,
  d.NumeroSerie AS numeroSerieDispositivo,
  d.Marca AS marcaDispositivo,
  d.Modelo AS modeloDispositivo,
  
  -- BlueVox
  i.IdBlueVox AS idBlueVox,
  b.NumeroSerie AS numeroSerieBlueVox,
  b.Marca AS marcaBlueVox,
  b.Modelo AS modeloBlueVox,
  
  -- Vehículo
  i.IdVehiculo AS idVehiculo,
  v.Marca AS marcaVehiculo,
  v.Modelo AS modeloVehiculo,
  v.Placa AS placaVehiculo,
  v.NumeroEconomico AS numeroEconomicoVehiculo,
  
  -- Cliente
  i.IdCliente AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM UsuariosInstalaciones ui
INNER JOIN Instalaciones i ON ui.IdInstalacion = i.Id
INNER JOIN Dispositivos d ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
INNER JOIN BlueVoxs b ON i.IdBlueVox = b.Id AND i.IdCliente = b.IdCliente
INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
INNER JOIN Clientes c ON i.IdCliente = c.Id

WHERE ui.IdUsuario = ?
  AND ui.Estatus = 1

ORDER BY i.Id DESC
  LIMIT ? OFFSET ?;

  `,
            [idUser, limit, offset],
          );
          // Query para total (sin paginación)
          totalResult = await this.instalacionesRepository.query(
            `
    SELECT COUNT(*) AS total
  FROM UsuariosInstalaciones ui
INNER JOIN Instalaciones i ON ui.IdInstalacion = i.Id
INNER JOIN Dispositivos d ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
INNER JOIN BlueVoxs b ON i.IdBlueVox = b.Id AND i.IdCliente = b.IdCliente
INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
INNER JOIN Clientes c ON i.IdCliente = c.Id
	WHERE ui.IdUsuario = ?
	AND ui.Estatus = 1
  `,
            [idUser],
          );
          break;
      }

      const total = Number(totalResult[0]?.total || 0);

      // 🔥 Transformación de datos (ids → number, nombreCompleto)
      const data = instalaciones.map((item) => ({
        ...item,
        id: Number(item.id),
        idDispositivo: Number(item.idDispositivo),
        idBlueVox: Number(item.idBlueVox),
        idVehiculo: Number(item.idVehiculo),
        idCliente: Number(item.idCliente),
      }));

      //APi response
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
        message:
          'Ocurrió un problema al intentar cargar la paginación de instalaciones.',
        error: error.message,
      });
    }
  }

  private async consultarInstalacionesListado(cliente: number) {
    const { ids, placeholders } = await this.clienteHijos(cliente);
    const query = `
SELECT
  -- Instalación
  i.Id AS id,
  i.FechaCreacion AS fechaCreacion,
  i.FechaActualizacion AS fechaActualizacion,
  i.Estatus AS estatus,

  -- Dispositivo
  i.IdDispositivo AS idDispositivo,
  d.NumeroSerie AS numeroSerieDispositivo,
  d.Marca AS marcaDispositivo,
  d.Modelo AS modeloDispositivo,

  -- BlueVox
  i.IdBlueVox AS idBlueVox,
  b.NumeroSerie AS numeroSerieBlueVox,
  b.Marca AS marcaBlueVox,
  b.Modelo AS modeloBlueVox,

  -- Vehículo
  i.IdVehiculo AS idVehiculo,
  v.Marca AS marcaVehiculo,
  v.Modelo AS modeloVehiculo,
  v.Placa AS placaVehiculo,
  v.NumeroEconomico AS numeroEconomicoVehiculo,

  -- Cliente
  i.IdCliente AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM Instalaciones i
INNER JOIN Dispositivos d ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
INNER JOIN BlueVoxs b ON i.IdBlueVox = b.Id AND i.IdCliente = b.IdCliente
INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
INNER JOIN Clientes c ON i.IdCliente = c.Id

WHERE c.Estatus = 1
AND c.Id IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar
AND i.Estatus = 1
  

ORDER BY i.Id DESC
   `;
    return this.instalacionesRepository.query(query, [...ids]);
  }

  // ========================================
  // 🔹 OBTENER LISTADO DE INSTALACIONES
  // ========================================
  async findAllList(
    idUser: number,
    cliente: number,
    rol: number,
  ): Promise<ApiResponseCommon> {
    try {
      let instalaciones;

      switch (rol) {
        case 1:
          // Usuario SuperAdministrador - obtiene todas las instalaciones
          instalaciones = await this.usuariosinstalacionesRepository.query(
            `
SELECT
  -- Instalación
  i.Id AS id,
  i.FechaCreacion AS fechaCreacion,
  i.FechaActualizacion AS fechaActualizacion,
  i.Estatus AS estatus,

  -- Dispositivo
  i.IdDispositivo AS idDispositivo,
  d.NumeroSerie AS numeroSerieDispositivo,
  d.Marca AS marcaDispositivo,
  d.Modelo AS modeloDispositivo,

  -- BlueVox
  i.IdBlueVox AS idBlueVox,
  b.NumeroSerie AS numeroSerieBlueVox,
  b.Marca AS marcaBlueVox,
  b.Modelo AS modeloBlueVox,

  -- Vehículo
  i.IdVehiculo AS idVehiculo,
  v.Marca AS marcaVehiculo,
  v.Modelo AS modeloVehiculo,
  v.Placa AS placaVehiculo,
  v.NumeroEconomico AS numeroEconomicoVehiculo,

  -- Cliente
  i.IdCliente AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM Instalaciones i
INNER JOIN Dispositivos d ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
INNER JOIN BlueVoxs b ON i.IdBlueVox = b.Id AND i.IdCliente = b.IdCliente
INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
INNER JOIN Clientes c ON i.IdCliente = c.Id

WHERE i.Estatus = 1
AND c.Estatus = 1

ORDER BY i.Id DESC;

  `,
          );
          break;

        case 2:
          // Consulta de datos paginados Usuario Administrador
          instalaciones = await this.consultarInstalacionesListado(cliente);
          break;

        case 3:
          // Consulta de datos paginados Usuario Operador
          instalaciones = await this.consultarInstalacionesListado(cliente);
          break;

        case 8:
          // Consulta de datos paginados Usuario Reportes
          instalaciones = await this.consultarInstalacionesListado(cliente);
          break;

        case 10:
          // Consulta de datos paginados Usuario Capturista
          instalaciones = await this.consultarInstalacionesListado(cliente);
          break;

        default:
          // Usuarios normales - solo sus instalaciones asignadas
          instalaciones = await this.usuariosinstalacionesRepository.query(
            `
SELECT
  -- Instalación */*/*/* para resto Usuarios
  i.Id AS id,
  i.FechaCreacion AS fechaCreacion,
  i.FechaActualizacion AS fechaActualizacion,
  i.Estatus AS estatus,
  
  -- Dispositivo
  i.IdDispositivo AS idDispositivo,
  d.NumeroSerie AS numeroSerieDispositivo,
  d.Marca AS marcaDispositivo,
  d.Modelo AS modeloDispositivo,
  
  -- BlueVox
  i.IdBlueVox AS idBlueVox,
  b.NumeroSerie AS numeroSerieBlueVox,
  b.Marca AS marcaBlueVox,
  b.Modelo AS modeloBlueVox,
  
  -- Vehículo
  i.IdVehiculo AS idVehiculo,
  v.Marca AS marcaVehiculo,
  v.Modelo AS modeloVehiculo,
  v.Placa AS placaVehiculo,
  v.NumeroEconomico AS numeroEconomicoVehiculo,
  
  -- Cliente
  i.IdCliente AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM UsuariosInstalaciones ui
INNER JOIN Instalaciones i ON ui.IdInstalacion = i.Id
INNER JOIN Dispositivos d ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
INNER JOIN BlueVoxs b ON i.IdBlueVox = b.Id AND i.IdCliente = b.IdCliente
INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
INNER JOIN Clientes c ON i.IdCliente = c.Id

WHERE ui.IdUsuario = ?
  AND ui.Estatus = 1
  AND i.Estatus = 1
  AND c.Estatus = 1

ORDER BY i.Id DESC;

  `,
            [idUser],
          );
          break;
      }

      // 🔥 Transformación de datos (ids → number, nombreCompleto)
      const data = instalaciones.map((item) => ({
        ...item,
        id: Number(item.id),
        idDispositivo: Number(item.idDispositivo),
        idBlueVox: Number(item.idBlueVox),
        idVehiculo: Number(item.idVehiculo),
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
      throw new InternalServerErrorException({
        message: 'No fue posible obtener el listado de instalaciones.',
        error,
      });
    }
  }

  private async consultarInstalacionesOne(cliente: number, id: number) {
    const { ids, placeholders } = await this.clienteHijos(cliente);
    const query = `
SELECT
  -- Instalación
  i.Id AS id,
  i.FechaCreacion AS fechaCreacion,
  i.FechaActualizacion AS fechaActualizacion,
  i.Estatus AS estatus,

  -- Dispositivo
  i.IdDispositivo AS idDispositivo,
  d.NumeroSerie AS numeroSerieDispositivo,
  d.Marca AS marcaDispositivo,
  d.Modelo AS modeloDispositivo,

  -- BlueVox
  i.IdBlueVox AS idBlueVox,
  b.NumeroSerie AS numeroSerieBlueVox,
  b.Marca AS marcaBlueVox,
  b.Modelo AS modeloBlueVox,

  -- Vehículo
  i.IdVehiculo AS idVehiculo,
  v.Marca AS marcaVehiculo,
  v.Modelo AS modeloVehiculo,
  v.Placa AS placaVehiculo,
  v.NumeroEconomico AS numeroEconomicoVehiculo,

  -- Cliente
  i.IdCliente AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM Instalaciones i
INNER JOIN Dispositivos d ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
INNER JOIN BlueVoxs b ON i.IdBlueVox = b.Id AND i.IdCliente = b.IdCliente
INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
INNER JOIN Clientes c ON i.IdCliente = c.Id

WHERE i.Id = ?
AND i.IdCliente IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar

ORDER BY i.Id DESC;
   `;
    return this.instalacionesRepository.query(query, [id, ...ids]);
  }

  // ========================================
  // 🔹 OBTENER UNA INSTALACION
  // ========================================
  async findOne(id: number, idUser: number, cliente: number, rol: number) {
    try {
      let instalaciones;
      switch (rol) {
        case 1:
          // Usuario SuperAdministrador - obtiene todas las instalaciones
          instalaciones = await this.usuariosinstalacionesRepository.query(
            `
SELECT
  -- Instalación
  i.Id AS id,
  i.FechaCreacion AS fechaCreacion,
  i.FechaActualizacion AS fechaActualizacion,
  i.Estatus AS estatus,

  -- Dispositivo
  i.IdDispositivo AS idDispositivo,
  d.NumeroSerie AS numeroSerieDispositivo,
  d.Marca AS marcaDispositivo,
  d.Modelo AS modeloDispositivo,

  -- BlueVox
  i.IdBlueVox AS idBlueVox,
  b.NumeroSerie AS numeroSerieBlueVox,
  b.Marca AS marcaBlueVox,
  b.Modelo AS modeloBlueVox,

  -- Vehículo
  i.IdVehiculo AS idVehiculo,
  v.Marca AS marcaVehiculo,
  v.Modelo AS modeloVehiculo,
  v.Placa AS placaVehiculo,
  v.NumeroEconomico AS numeroEconomicoVehiculo,

  -- Cliente
  i.IdCliente AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM Instalaciones i
INNER JOIN Dispositivos d ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
INNER JOIN BlueVoxs b ON i.IdBlueVox = b.Id AND i.IdCliente = b.IdCliente
INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
INNER JOIN Clientes c ON i.IdCliente = c.Id

WHERE i.Id = ?

ORDER BY i.Id DESC;

  `,
            [id],
          );
          break;

        case 2:
          // Consulta de datos paginados Usuario Administrador
          instalaciones = await this.consultarInstalacionesOne(cliente, id);
          break;

        case 3:
          // Consulta de datos paginados Usuario Operador
          instalaciones = await this.consultarInstalacionesOne(cliente, id);
          break;

        case 8:
          // Consulta de datos paginados Usuario Reportes
          instalaciones = await this.consultarInstalacionesOne(cliente, id);
          break;

        case 10:
          // Consulta de datos paginados Usuario Capturista
          instalaciones = await this.consultarInstalacionesOne(cliente, id);
          break;

        default:
          // Usuarios normales - solo sus instalaciones asignadas
          instalaciones = await this.usuariosinstalacionesRepository.query(
            `
SELECT
  -- Instalación */*/*/* para resto Usuarios
  i.Id AS id,
  i.FechaCreacion AS fechaCreacion,
  i.FechaActualizacion AS fechaActualizacion,
  i.Estatus AS estatus,
  
  -- Dispositivo
  i.IdDispositivo AS idDispositivo,
  d.NumeroSerie AS numeroSerieDispositivo,
  d.Marca AS marcaDispositivo,
  d.Modelo AS modeloDispositivo,
  
  -- BlueVox
  i.IdBlueVox AS idBlueVox,
  b.NumeroSerie AS numeroSerieBlueVox,
  b.Marca AS marcaBlueVox,
  b.Modelo AS modeloBlueVox,
  
  -- Vehículo
  i.IdVehiculo AS idVehiculo,
  v.Marca AS marcaVehiculo,
  v.Modelo AS modeloVehiculo,
  v.Placa AS placaVehiculo,
  v.NumeroEconomico AS numeroEconomicoVehiculo,
  
  -- Cliente
  i.IdCliente AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM UsuariosInstalaciones ui
INNER JOIN Instalaciones i ON ui.IdInstalacion = i.Id
INNER JOIN Dispositivos d ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
INNER JOIN BlueVoxs b ON i.IdBlueVox = b.Id AND i.IdCliente = b.IdCliente
INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
INNER JOIN Clientes c ON i.IdCliente = c.Id

WHERE ui.IdUsuario = ?
  AND ui.Estatus = 1
  AND i.Id = ?

ORDER BY i.Id DESC;

  `,
            [idUser, id],
          );
          break;
      }

      if (instalaciones.length === 0) {
        throw new NotFoundException('No se encontraron instalaciones.');
      }

      // 🔥 Transformamos ids a number y añadimos nombreCompleto
      const data = instalaciones.map((item) => ({
        ...item,
        id: Number(item.id),
        idDispositivo: Number(item.idDispositivo),
        idBlueVox: Number(item.idBlueVox),
        idVehiculo: Number(item.idVehiculo),
        idCliente: Number(item.idCliente),
      }));

      return { data: data };
    } catch (error) {
      console.log(error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message:
          'Ocurrió un problema al intentar acceder a las instalaciones por ID.',
        error: error.message,
      });
    }
  }

  // ========================================
  // 🔹 ACTUALIZAR ESTATUS
  // ========================================
  async updateEstatus(
    id: number,
    idUser: number,
    cliente: number,
    rol: number,
    updateInstalacioneEstatusDto: UpdateInstalacioneEstatusDto,
  ) {
    try {
      const instalacion = await this.instalacionesRepository.findOne({
        where: { id: id },
      });

      if (!instalacion) {
        throw new NotFoundException(
          `Instalaciones con id: ${id} no encontrado`,
        );
      }

      //Actualizamos el estatus
      const estatus = updateInstalacioneEstatusDto.estatus;
      if (estatus === 1) {
        // ✅ VALIDACIÓN MEJORADA: Verificar todos los conflictos con relaciones
        const errores: string[] = [];

        // Verificar dispositivo CON relaciones
        const dispositivoEnUso = await this.instalacionesRepository.findOne({
          where: {
            idDispositivo: instalacion.idDispositivo,
            estatus: 1,
          },
          relations: ['dispositivos'],
        });
        if (dispositivoEnUso) {
          errores.push(
            `Dispositivo "${dispositivoEnUso.dispositivos.numeroSerie}" ya está en uso`,
          );
        }

        // Verificar BlueVox CON relaciones
        const blueVoxEnUso = await this.instalacionesRepository.findOne({
          where: { idBlueVox: instalacion.idBlueVox, estatus: 1 },
          relations: ['blueVoxs'],
        });
        if (blueVoxEnUso) {
          errores.push(
            `BlueVox "${blueVoxEnUso.blueVoxs.numeroSerie}" ya está en uso`,
          );
        }

        // Verificar Vehículo CON relaciones
        const vehiculoEnUso = await this.instalacionesRepository.findOne({
          where: { idVehiculo: instalacion.idVehiculo, estatus: 1 },
          relations: ['vehiculos'],
        });
        if (vehiculoEnUso) {
          errores.push(
            `Vehículo con placa "${vehiculoEnUso.vehiculos.placa}" ya está en uso`,
          );
        }

        // Si hay conflictos, lanzar error con todos los detalles
        if (errores.length > 0) {
          throw new BadRequestException({
            message: `No se puede crear la instalación debido a los siguientes conflictos: ${errores[0]}`,
            errors: errores,
            conflictsCount: errores.length,
          });
        }

        // ✅ Verificar todos los componentes esten disponibles
        const erroresEstado: string[] = [];
        console.log(instalacion.idDispositivo);
        // Verificar dispositivo este disponible
        const dispositivoEstado = await this.dispositivosRepository.findOne({
          where: {
            id: instalacion.idDispositivo,
            estatus: 1,
            estadoActual: 1,
          },
        });
        if (!dispositivoEstado) {
          erroresEstado.push(
            `Dispositivo "${instalacion.idDispositivo}" su estado actual, no esta disponible`,
          );
        }

        // Verificar BlueVox este disponible
        const blueVoxEstado = await this.bluevoxsRepository.findOne({
          where: { id: instalacion.idBlueVox, estatus: 1, estadoActual: 1 },
        });
        if (!blueVoxEstado) {
          erroresEstado.push(
            `BlueVox "${instalacion.idBlueVox}" su estado actual, no esta disponible`,
          );
        }

        // Verificar Vehículo este disponible
        const vehiculoEstado = await this.vehiculosRepository.findOne({
          where: { id: instalacion.idVehiculo, estatus: 1, estadoActual: 1 },
        });
        if (!vehiculoEstado) {
          erroresEstado.push(
            `Vehículo con placa "${instalacion.idVehiculo}" su estado actual, no esta disponible`,
          );
        }

        // Si hay conflictos, lanzar error con todos los detalles
        if (erroresEstado.length > 0) {
          throw new BadRequestException({
            message: `No se puede crear la instalación debido a los siguientes conflictos: ${erroresEstado[0]}`,
            errors: erroresEstado,
            conflictsCount: erroresEstado.length,
          });
        }

        // Cambiar estatus de componentes a 2 (Asignado)
        const body = { estadoActual: EstadoComponente.ASIGNADO };
        await this.dispositivosRepository.update(
          instalacion.idDispositivo,
          body,
        );
        await this.bluevoxsRepository.update(instalacion.idBlueVox, body);
        await this.vehiculosRepository.update(instalacion.idVehiculo, body);
      } else if (estatus === 0) {
        // Desactivar instalación → activar componentes a 1(Disponible)
        const body = { estadoActual: EstadoComponente.DISPONIBLE };
        await this.dispositivosRepository.update(
          instalacion.idDispositivo,
          body,
        );
        await this.bluevoxsRepository.update(instalacion.idBlueVox, body);
        await this.vehiculosRepository.update(instalacion.idVehiculo, body);
      }

      await this.instalacionesRepository.update(id, { estatus: estatus });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { updateInstalacioneEstatusDto };
      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `Se actualizó el estatus de la instalación con ID: ${instalacion.id}.`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.INSTALACIONES,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message:
          'El estatus de las instalaciones ha sido actualizado con éxito.',
        estatus: { estatus: estatus },
        data: {
          id: id,
          nombre:
            `${instalacion.id} dispositivo:${instalacion.idDispositivo} bluevox: ${instalacion.idBlueVox} vehiculo: ${instalacion.idVehiculo}` ||
            '',
        },
      };
      return result;
    } catch (error) {
      console.log(error);
      //-----Registro en la bitacora----- ERROR
      const querylogger = { updateInstalacioneEstatusDto };
      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `Se cambio el estatus de instalacion con id: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.INSTALACIONES,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: `Ocurrió un problema al intentar modificar el estatus de la instalación con ID: ${id}.`,
        error: error.message,
      });
    }
  }

  // ========================================
  // 🔹 ACTUALIZAR INSTALACION
  // ========================================
  async update(
    id: number,
    idUser: number,
    cliente: number,
    rol: number,
    updateInstalacioneDto: UpdateInstalacioneDto,
  ): Promise<ApiCrudResponse> {
    try {
      const instalacion = await this.instalacionesRepository.findOne({
        where: { id: id },
      });

      if (!instalacion) {
        throw new NotFoundException(
          `No se encontró la instalación con ID: ${id}.`,
        );
      }

      //verificamos que exista el dispositivo a actualizar
      if (updateInstalacioneDto.estatusDispositivoAnterior) {
        //Actualizamos el estado del dispositivo anterior
        const estadoViejoDispositivo =
          updateInstalacioneDto.estatusDispositivoAnterior;
        await this.dispositivosRepository.update(instalacion.idDispositivo, {
          estadoActual: estadoViejoDispositivo,
        });
        //Actualizamos el estado del dispositivo nuevo a asignado
        await this.dispositivosRepository.update(
          Number(updateInstalacioneDto.idDispositivo),
          { estadoActual: EstadoComponente.ASIGNADO },
        );
        //Actualizamos el dispositivo en la instalacion
        await this.instalacionesRepository.update(id, {
          idDispositivo: updateInstalacioneDto.idDispositivo,
        });
      }

      //verificamos que exista el bluevoxs a actualizar
      if (updateInstalacioneDto.estatusBluevoxsAnterior) {
        //Actualizamos el estado del bluevoxs anterior
        await this.bluevoxsRepository.update(instalacion.idBlueVox, {
          estadoActual: updateInstalacioneDto.estatusBluevoxsAnterior,
        });
        //Actualizamos el estado del bluevoxs nuevo a asignado
        await this.bluevoxsRepository.update(
          Number(updateInstalacioneDto.idBlueVox),
          { estadoActual: EstadoComponente.ASIGNADO },
        );
        //Actualizamos el bluevoxs en la instalacion
        await this.instalacionesRepository.update(id, {
          idBlueVox: updateInstalacioneDto.idBlueVox,
        });
      }

      const instalacionActualizada = await this.instalacionesRepository.findOne(
        {
          where: { id: id },
        },
      );

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { updateInstalacioneDto };
      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `Se actualizo instalacion con id: ${instalacion.id}`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.INSTALACIONES,
        EstatusEnumBitcora.SUCCESS,
      );

      const body = {
        idInstalacion: id,
        idDispositivo: instalacion.idDispositivo,
        idBlueVox: instalacion.idBlueVox,
        idVehiculo: instalacion.idVehiculo,
        idCliente: instalacion.idCliente,
      };
      const comentario = `${updateInstalacioneDto.comentariosBluevox ?? ''} ${updateInstalacioneDto.comentariosDispositivo ?? ''}`;

      //Registro historico
      await this.historicoinstalacionesService.updateHistorico(
        body,
        Number(instalacionActualizada?.idDispositivo),
        Number(instalacionActualizada?.idBlueVox),
        Number(instalacionActualizada?.idVehiculo),
        Number(instalacionActualizada?.idCliente),
        idUser,
        comentario,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Las instalaciones se actualizaron con éxito.',
        data: {
          id: id,
          nombre:
            `Instalación ${instalacion.id} asociada a Dispositivo: ${instalacion.idDispositivo}, BlueVox: ${instalacion.idBlueVox} y Vehículo: ${instalacion.idVehiculo}.` ||
            '',
        },
      };
      return result;
    } catch (error) {
      console.log(error);
      //-----Registro en la bitacora----- ERROR
      const querylogger = { updateInstalacioneDto };
      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `Se actualizo instalacion con id: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.INSTALACIONES,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al actualizar Instalación',
        error: error, // ✅ Solo el mensaje, no todo el objeto
      });
    }
  }

  // ========================================
  // 🔹 ELIMINADO LOGICO
  // ========================================
  async remove(
    id: number,
    cliente: number,
    idUser: number,
    rol: number,
  ): Promise<ApiCrudResponse> {
    try {
      let instalacion;
      instalacion = await this.instalacionesRepository.findOne({
        where: { id: id },
      });

      if (!instalacion) {
        throw new NotFoundException(
          `La instalación con ID: ${id} no está disponible.`,
        );
      }

      //Actualizamos datos
      await this.instalacionesRepository.update(id, {
        estatus: EstatusEnum.INACTIVO,
      });

      // Desactivar instalación → activar componentes
      const body = { estadoActual: EstadoComponente.DISPONIBLE };
      await this.dispositivosRepository.update(instalacion.idDispositivo, body);
      await this.bluevoxsRepository.update(instalacion.idBlueVox, body);
      await this.vehiculosRepository.update(instalacion.idVehiculo, body);

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `La instalación con ID: ${instalacion.id} ha sido eliminada exitosamente.`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.INSTALACIONES,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Instalaciones eliminado correctamente',
        data: {
          id: id,
          nombre:
            `${instalacion.id} dispositivo:${instalacion.idDispositivo} bluevox: ${instalacion.idBlueVox} vehiculo: ${instalacion.idVehiculo}` ||
            '',
        },
      };
      return result;
    } catch (error) {
      console.log(error);
      //-----Registro en la bitacora----- ERROR
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `La instalación con ID: ${id} ha sido eliminada exitosamente.`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.INSTALACIONES,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al eliminar de instalaciones con id: ${id}`,
      );
    }
  }
}
