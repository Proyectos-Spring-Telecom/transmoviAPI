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
import { InstalacionesBlueVoxs } from 'src/entities/InstalacionesBlueVoxs';
import { HistoricoinstalacionesService } from 'src/historicoinstalaciones/historicoinstalaciones.service';
import { EnumModulos, EstadoComponente, EstatusEnum } from 'src/common/estatus.enum';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';

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
    @InjectRepository(InstalacionesBlueVoxs)
    private readonly instalacionesBlueVoxsRepository: Repository<InstalacionesBlueVoxs>,
    @InjectDataSource() private readonly dataSource: DataSource,
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
      // ==========================
      // VALIDACIONES + CREACIÓN (ATÓMICO)
      // ==========================
      // Normalizamos idsBlueVoxs (sin duplicados) y validamos que venga al menos 1.
      const idsBlueVoxs = Array.from(
        new Set((createInstalacioneDto.idsBlueVoxs ?? []).map(Number)),
      ).filter((id) => Number.isFinite(id) && id > 0);

      if (idsBlueVoxs.length === 0) {
        throw new BadRequestException('Debe enviar al menos 1 BlueVox en idsBlueVoxs.');
      }

      // Transacción para evitar estados inconsistentes (componentes “asignados” sin instalación, etc.).
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const instalacionesRepo = queryRunner.manager.getRepository(Instalaciones);
        const dispositivosRepo = queryRunner.manager.getRepository(Dispositivos);
        const vehiculosRepo = queryRunner.manager.getRepository(Vehiculos);
        const blueVoxsRepo = queryRunner.manager.getRepository(BlueVoxs);
        const instalacionesBlueVoxsRepo = queryRunner.manager.getRepository(InstalacionesBlueVoxs);
        const usuariosInstRepo =
          queryRunner.manager.getRepository(UsuariosInstalaciones);

        // 1) Validar Dispositivo (existencia + cliente + estatus/estado + no asignado)
        const dispositivo = await dispositivosRepo.findOne({
          where: {
            id: createInstalacioneDto.idDispositivo,
            idCliente: createInstalacioneDto.idCliente,
            estatus: 1,
            estadoActual: EstadoComponente.DISPONIBLE,
          },
        });
        if (!dispositivo) {
          throw new BadRequestException({
            message:
              'Dispositivo inválido o no disponible (Estatus=1 y EstadoActual=1) o no pertenece al cliente.',
            idDispositivo: createInstalacioneDto.idDispositivo,
            idCliente: createInstalacioneDto.idCliente,
          });
        }

        // Conflicto: si hay una instalación activa con ese dispositivo
        const instalacionConDispositivo = await instalacionesRepo.findOne({
          where: { idDispositivo: dispositivo.id, estatus: 1 },
          relations: ['dispositivos'],
        });
        if (instalacionConDispositivo) {
          throw new BadRequestException(
            `El componente ${instalacionConDispositivo.dispositivos.numeroSerie} ya pertenece a una instalación.`,
          );
        }

        // 2) Validar Vehículo (existencia + cliente + estatus/estado + no asignado)
        const vehiculo = await vehiculosRepo.findOne({
          where: {
            id: createInstalacioneDto.idVehiculo,
            idCliente: createInstalacioneDto.idCliente,
            estatus: 1,
            estadoActual: EstadoComponente.DISPONIBLE,
          },
        });
        if (!vehiculo) {
          throw new BadRequestException({
            message:
              'Vehículo inválido o no disponible (Estatus=1 y EstadoActual=1) o no pertenece al cliente.',
            idVehiculo: createInstalacioneDto.idVehiculo,
            idCliente: createInstalacioneDto.idCliente,
          });
        }

        const instalacionConVehiculo = await instalacionesRepo.findOne({
          where: { idVehiculo: vehiculo.id, estatus: 1 },
          relations: ['vehiculos'],
        });
        if (instalacionConVehiculo) {
          throw new BadRequestException(
            `El componente ${instalacionConVehiculo.vehiculos.placa} ya pertenece a una instalación.`,
          );
        }

        // 3) Validar BlueVoxs (existencia + cliente + estatus) y manejar conflictos automáticamente.
        //
        // IMPORTANTE: Ahora usamos la tabla intermedia InstalacionesBlueVoxs para gestionar las asociaciones.
        // - Si algún BlueVox está asignado a otra instalación activa (InstalacionesBlueVoxs.Estatus=1),
        //   desactivamos la asociación previa (Estatus=0) ANTES de crear la nueva instalación.
        // - Esto mantiene el resto del flujo intacto: después, se crean nuevos registros en InstalacionesBlueVoxs
        //   y se actualiza el EstadoActual de los BlueVoxs a ASIGNADO.

        // 3.1) Traemos TODOS los BlueVoxs solicitados para validar existencia y pertenencia al cliente.
        const blueVoxs = await blueVoxsRepo.find({
          where: {
            id: In(idsBlueVoxs),
            idCliente: createInstalacioneDto.idCliente,
            estatus: 1,
          },
        });

        // Validamos existencia y pertenencia al cliente (estatus=1)
        if (blueVoxs.length !== idsBlueVoxs.length) {
          const encontrados = new Set(blueVoxs.map((b) => Number(b.id)));
          const faltantes = idsBlueVoxs.filter((id) => !encontrados.has(id));
          throw new BadRequestException({
            message:
              'Uno o más BlueVoxs no existen, no pertenecen al cliente o no están activos (Estatus=1).',
            faltantes,
          });
        }

        // 3.2) Detectar BlueVoxs ya asignados a otras instalaciones activas (conflictivos) y liberarlos automáticamente.
        // Consultamos InstalacionesBlueVoxs para encontrar asociaciones activas (Estatus=1) de los BlueVoxs solicitados
        const blueVoxsAsignadosActivos = await instalacionesBlueVoxsRepo.find({
          where: {
            idBlueVox: In(idsBlueVoxs),
            estatus: 1, // Solo asociaciones activas
          },
          relations: ['idInstalacion2'], // Cargamos la instalación para validar que esté activa
        });

        // Filtramos solo las asociaciones donde la instalación también está activa
        const conflictos = blueVoxsAsignadosActivos.filter(
          (ibv) => ibv.idInstalacion2 && ibv.idInstalacion2.estatus === 1,
        );

        if (conflictos.length > 0) {
          // Liberación automática: desactivamos las asociaciones previas en InstalacionesBlueVoxs (Estatus=0).
          // Esto ocurre dentro de la misma transacción del create.
          const idsConflictivos = conflictos.map((c) => c.id);
          await instalacionesBlueVoxsRepo.update(
            { id: In(idsConflictivos) },
            { estatus: 0 }, // Desactivación lógica de la asociación previa
          );

          // Actualizamos el EstadoActual de los BlueVoxs conflictivos a DISPONIBLE.
          const idsBlueVoxsConflictivos = conflictos.map((c) => c.idBlueVox);
          await blueVoxsRepo.update(
            { id: In(idsBlueVoxsConflictivos) },
            { estadoActual: EstadoComponente.DISPONIBLE },
          );
        }

        // 4) Crear instalación
        // IMPORTANTE: La asociación con BlueVoxs se gestiona mediante la tabla intermedia InstalacionesBlueVoxs,
        // no mediante un campo directo en Instalaciones.
        const instalacion = instalacionesRepo.create({
          idDispositivo: dispositivo.id,
          idVehiculo: vehiculo.id,
          idCliente: createInstalacioneDto.idCliente,
          estatus: createInstalacioneDto.estatus ?? 1,
        });
        const instalacionSave = await instalacionesRepo.save(instalacion);

        // 5) Permisos (misma lógica existente)
        switch (rol) {
          case 1:
            permiso = {
              estatus: 1,
              idUsuario: 1,
              idInstalacion: instalacionSave.id,
            };
            await usuariosInstRepo.save(permiso);
            break;
          case 2:
            permiso = { estatus: 1, idUsuario: 1, idInstalacion: instalacionSave.id };
            await usuariosInstRepo.save(permiso);
            permiso = { estatus: 1, idUsuario: idUser, idInstalacion: instalacionSave.id };
            await usuariosInstRepo.save(permiso);
            break;
          default:
            permiso = { estatus: 1, idUsuario: 1, idInstalacion: instalacionSave.id };
            await usuariosInstRepo.save(permiso);
            break;
        }

        // 6) Actualizar estados de componentes (dispositivo/vehículo y N BlueVoxs)
        await dispositivosRepo.update(dispositivo.id, {
          estadoActual: EstadoComponente.ASIGNADO,
        });
        await vehiculosRepo.update(vehiculo.id, { estadoActual: EstadoComponente.ASIGNADO });

        // 6.1) Crear registros en InstalacionesBlueVoxs para asociar los BlueVoxs con la instalación.
        // IMPORTANTE: Esta es la forma correcta de asociar BlueVoxs con Instalaciones usando la tabla intermedia.
        const instalacionesBlueVoxs = idsBlueVoxs.map((idBlueVox) =>
          instalacionesBlueVoxsRepo.create({
            idInstalacion: instalacionSave.id,
            idBlueVox: idBlueVox,
            estatus: 1, // Asociación activa
          }),
        );
        await instalacionesBlueVoxsRepo.save(instalacionesBlueVoxs);

        // 6.2) Actualizar EstadoActual de los BlueVoxs a ASIGNADO.
        // NOTA: NO se modifica IdInstalaciones en BlueVoxs (esa columna no existe o se ignora).
        await blueVoxsRepo.update(
          { id: In(idsBlueVoxs) },
          { estadoActual: EstadoComponente.ASIGNADO },
        );

        // 7) Histórico: arreglo de objetos {Id, NumeroSerie}
        const blueVoxsSnapshot = blueVoxs.map((b) => ({
          Id: Number(b.id),
          NumeroSerie: b.numeroSerie,
        }));

        await this.historicoinstalacionesService.createHistorico(
          instalacionSave.id,
          dispositivo.id,
          blueVoxsSnapshot,
          vehiculo.id,
          instalacionSave.idCliente,
          idUser,
          queryRunner.manager,
        );

        // 8) Logging/bitácora (creación y asociación)
        const querylogger = {
          instalacionId: instalacionSave.id,
          idCliente: instalacionSave.idCliente,
          idDispositivo: dispositivo.id,
          idVehiculo: vehiculo.id,
          idsBlueVoxs,
        };
        await this.bitacoraLogger.logToBitacora(
          'Instalaciones',
          `Instalación ${instalacionSave.id} creada. BlueVoxs asociados: ${blueVoxsSnapshot
            .map((b) => b.NumeroSerie)
            .join(', ')}`,
          'CREATE',
          querylogger,
          idUser,
          EnumModulos.INSTALACIONES,
          EstatusEnumBitcora.SUCCESS,
        );

        await queryRunner.commitTransaction();

        // 9) Respuesta
        const result: ApiCrudResponse = {
          status: 'success',
          message: 'La instalación ha sido creada correctamente.',
          data: {
            id: Number(instalacionSave.id),
            nombre: `Instalación ${instalacionSave.id} registrada con Dispositivo: ${dispositivo.id}, Vehículo: ${vehiculo.id} y BlueVoxs: ${blueVoxsSnapshot
              .map((b) => b.NumeroSerie)
              .join(', ')}.`,
          },
        };

        return result;
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
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

  -- BlueVoxs (1..N) asociado(s) mediante tabla intermedia InstalacionesBlueVoxs
  -- IMPORTANTE: La relación se gestiona mediante InstalacionesBlueVoxs (tabla intermedia),
  -- no mediante FK directa en BlueVoxs.IdInstalaciones.
  -- Arreglo JSON con llaves requeridas por frontend
  COALESCE(
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'idBlueVox', bx.Id,
          'numeroSerieBlueVox', bx.NumeroSerie,
          'marcaBlueVox', bx.Marca,
          'modeloBlueVox', bx.Modelo
        )
      )
      FROM InstalacionesBlueVoxs ibv
      INNER JOIN BlueVoxs bx ON ibv.IdBlueVox = bx.Id
      WHERE ibv.IdInstalacion = i.Id
        AND ibv.Estatus = 1  -- Solo asociaciones activas
        AND bx.IdCliente = i.IdCliente
    ),
    JSON_ARRAY()
  ) AS blueVoxs,

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

  -- BlueVoxs (1..N) asociado(s) mediante tabla intermedia InstalacionesBlueVoxs
  COALESCE(
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'idBlueVox', bx.Id,
          'numeroSerieBlueVox', bx.NumeroSerie,
          'marcaBlueVox', bx.Marca,
          'modeloBlueVox', bx.Modelo
        )
      )
      FROM InstalacionesBlueVoxs ibv
      INNER JOIN BlueVoxs bx ON ibv.IdBlueVox = bx.Id
      WHERE ibv.IdInstalacion = i.Id
        AND ibv.Estatus = 1
        AND bx.IdCliente = i.IdCliente
    ),
    JSON_ARRAY()
  ) AS blueVoxs,

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
  
  -- BlueVoxs (1..N) asociado(s) mediante tabla intermedia InstalacionesBlueVoxs
  COALESCE(
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'idBlueVox', bx.Id,
          'numeroSerieBlueVox', bx.NumeroSerie,
          'marcaBlueVox', bx.Marca,
          'modeloBlueVox', bx.Modelo
        )
      )
      FROM InstalacionesBlueVoxs ibv
      INNER JOIN BlueVoxs bx ON ibv.IdBlueVox = bx.Id
      WHERE ibv.IdInstalacion = i.Id
        AND ibv.Estatus = 1
        AND bx.IdCliente = i.IdCliente
    ),
    JSON_ARRAY()
  ) AS blueVoxs,
  
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

  -- BlueVoxs (1..N)
  COALESCE(
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'idBlueVox', bx.Id,
          'numeroSerieBlueVox', bx.NumeroSerie,
          'marcaBlueVox', bx.Marca,
          'modeloBlueVox', bx.Modelo
        )
      )
      FROM InstalacionesBlueVoxs ibv
      INNER JOIN BlueVoxs bx ON ibv.IdBlueVox = bx.Id
      WHERE ibv.IdInstalacion = i.Id
        AND ibv.Estatus = 1
        AND bx.IdCliente = i.IdCliente
    ),
    JSON_ARRAY()
  ) AS blueVoxs,

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

  -- BlueVoxs (1..N)
  COALESCE(
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'idBlueVox', bx.Id,
          'numeroSerieBlueVox', bx.NumeroSerie,
          'marcaBlueVox', bx.Marca,
          'modeloBlueVox', bx.Modelo
        )
      )
      FROM InstalacionesBlueVoxs ibv
      INNER JOIN BlueVoxs bx ON ibv.IdBlueVox = bx.Id
      WHERE ibv.IdInstalacion = i.Id
        AND ibv.Estatus = 1
        AND bx.IdCliente = i.IdCliente
    ),
    JSON_ARRAY()
  ) AS blueVoxs,

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
  
  -- BlueVoxs (1..N)
  COALESCE(
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'idBlueVox', bx.Id,
          'numeroSerieBlueVox', bx.NumeroSerie,
          'marcaBlueVox', bx.Marca,
          'modeloBlueVox', bx.Modelo
        )
      )
      FROM InstalacionesBlueVoxs ibv
      INNER JOIN BlueVoxs bx ON ibv.IdBlueVox = bx.Id
      WHERE ibv.IdInstalacion = i.Id
        AND ibv.Estatus = 1
        AND bx.IdCliente = i.IdCliente
    ),
    JSON_ARRAY()
  ) AS blueVoxs,
  
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

  -- BlueVoxs (1..N)
  COALESCE(
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'idBlueVox', bx.Id,
          'numeroSerieBlueVox', bx.NumeroSerie,
          'marcaBlueVox', bx.Marca,
          'modeloBlueVox', bx.Modelo
        )
      )
      FROM InstalacionesBlueVoxs ibv
      INNER JOIN BlueVoxs bx ON ibv.IdBlueVox = bx.Id
      WHERE ibv.IdInstalacion = i.Id
        AND ibv.Estatus = 1
        AND bx.IdCliente = i.IdCliente
    ),
    JSON_ARRAY()
  ) AS blueVoxs,

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

  -- BlueVoxs (1..N)
  COALESCE(
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'idBlueVox', bx.Id,
          'numeroSerieBlueVox', bx.NumeroSerie,
          'marcaBlueVox', bx.Marca,
          'modeloBlueVox', bx.Modelo
        )
      )
      FROM InstalacionesBlueVoxs ibv
      INNER JOIN BlueVoxs bx ON ibv.IdBlueVox = bx.Id
      WHERE ibv.IdInstalacion = i.Id
        AND ibv.Estatus = 1
        AND bx.IdCliente = i.IdCliente
    ),
    JSON_ARRAY()
  ) AS blueVoxs,

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
  
  -- BlueVoxs (1..N)
  COALESCE(
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'idBlueVox', bx.Id,
          'numeroSerieBlueVox', bx.NumeroSerie,
          'marcaBlueVox', bx.Marca,
          'modeloBlueVox', bx.Modelo
        )
      )
      FROM InstalacionesBlueVoxs ibv
      INNER JOIN BlueVoxs bx ON ibv.IdBlueVox = bx.Id
      WHERE ibv.IdInstalacion = i.Id
        AND ibv.Estatus = 1
        AND bx.IdCliente = i.IdCliente
    ),
    JSON_ARRAY()
  ) AS blueVoxs,
  
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
  /**
   * Actualiza el estatus de una instalación y ajusta automáticamente el estado de los componentes asociados.
   * 
   * Flujo según el estatus objetivo:
   * - Estatus = 1 (activa): Componentes (Dispositivo, Vehículo, BlueVoxs) pasan a ASIGNADO (EstadoActual = 2)
   * - Estatus = 0 (inactiva): Componentes pasan a DISPONIBLE (EstadoActual = 1), manteniendo registros en InstalacionesBlueVoxs
   * 
   * Soporte para múltiples BlueVoxs:
   * - La relación se gestiona mediante la tabla intermedia InstalacionesBlueVoxs (M..N)
   * - Todas las operaciones sobre BlueVoxs consultan primero InstalacionesBlueVoxs para obtener los IDs asociados
   * - Esto permite actualizar múltiples BlueVoxs asociados en una sola operación
   * - NO se modifica BlueVoxs.IdInstalaciones (esa columna no existe o se ignora)
   * 
   * @param id ID de la instalación a actualizar
   * @param idUser ID del usuario que realiza la operación (para bitácora)
   * @param cliente ID del cliente (para validaciones de roles si aplica)
   * @param rol Rol del usuario (para validaciones de permisos si aplica)
   * @param updateInstalacioneEstatusDto DTO con el nuevo estatus (estatus: 0 o 1)
   * @returns Respuesta de la operación con el estatus actualizado
   * @throws NotFoundException Si la instalación no existe
   * @throws BadRequestException Si hay conflictos de uso o componentes no disponibles
   */
  async updateEstatus(
    id: number,
    idUser: number,
    cliente: number,
    rol: number,
    updateInstalacioneEstatusDto: UpdateInstalacioneEstatusDto,
  ) {
    try {
      // 1) Buscar instalación por ID usando TypeORM
      const instalacion = await this.instalacionesRepository.findOne({
        where: { id: id },
      });

      if (!instalacion) {
        throw new NotFoundException(
          `Instalaciones con id: ${id} no encontrado`,
        );
      }

      // 2) Leer el estatus objetivo del DTO
      const estatus = updateInstalacioneEstatusDto.estatus;

      // 3) Lógica según el estatus objetivo
      if (estatus === 1) {
        // ==========================================
        // CASO: ACTIVAR INSTALACIÓN (Estatus = 1)
        // ==========================================
        // Validaciones: conflictos de uso y disponibilidad de componentes

        const errores: string[] = [];

        // 3.1) Validar conflictos: verificar si dispositivo ya está en otra instalación activa
        // (excluyendo la instalación actual, por si se está reactivando)
        const dispositivoEnUso = await this.instalacionesRepository.findOne({
          where: {
            idDispositivo: instalacion.idDispositivo,
            estatus: 1,
          },
          relations: ['dispositivos'],
        });
        // Solo es conflicto si existe otra instalación activa (no la actual)
        if (dispositivoEnUso && dispositivoEnUso.id !== instalacion.id) {
          errores.push(
            `Dispositivo "${dispositivoEnUso.dispositivos.numeroSerie}" ya está en uso`,
          );
        }

        // Nota sobre BlueVoxs:
        // - No se validan conflictos de BlueVoxs aquí porque pueden estar asociados a múltiples instalaciones
        // - La relación se gestiona mediante InstalacionesBlueVoxs (tabla intermedia, relación M..N)
        // - La validación se hace en disponibilidad (que existan BlueVoxs asociados y disponibles)

        // 3.2) Validar conflictos: verificar si vehículo ya está en otra instalación activa
        // (excluyendo la instalación actual, por si se está reactivando)
        const vehiculoEnUso = await this.instalacionesRepository.findOne({
          where: { idVehiculo: instalacion.idVehiculo, estatus: 1 },
          relations: ['vehiculos'],
        });
        // Solo es conflicto si existe otra instalación activa (no la actual)
        if (vehiculoEnUso && vehiculoEnUso.id !== instalacion.id) {
          errores.push(
            `Vehículo con placa "${vehiculoEnUso.vehiculos.placa}" ya está en uso`,
          );
        }

        // 3.3) Si hay conflictos de uso, lanzar error con todos los detalles
        if (errores.length > 0) {
          throw new BadRequestException({
            message: `No se puede activar la instalación debido a los siguientes conflictos: ${errores[0]}`,
            errors: errores,
            conflictsCount: errores.length,
          });
        }

        // 3.4) Validar disponibilidad: verificar que todos los componentes estén disponibles
        const erroresEstado: string[] = [];

        // Verificar dispositivo esté disponible (Estatus=1, EstadoActual=1)
        const dispositivoEstado = await this.dispositivosRepository.findOne({
          where: {
            id: instalacion.idDispositivo,
            estatus: 1,
            estadoActual: 1,
          },
        });
        if (!dispositivoEstado) {
          erroresEstado.push(
            `Dispositivo "${instalacion.idDispositivo}" su estado actual no está disponible`,
          );
        }

        // 3.5) Verificar que existan BlueVoxs asociados a la instalación y que estén disponibles
        // IMPORTANTE: Ahora consultamos BlueVoxs asociados mediante InstalacionesBlueVoxs (tabla intermedia).
        // La consulta retorna TODOS los BlueVoxs asociados que cumplan las condiciones.
        const instalacionesBlueVoxsActivas = await this.instalacionesBlueVoxsRepository.find({
          where: {
            idInstalacion: instalacion.id, // Filtro por FK en tabla intermedia
            estatus: 1, // Solo asociaciones activas
          },
          relations: ['idBlueVox2'], // Cargamos los BlueVoxs relacionados
        });

        // Validar que todos los BlueVoxs asociados estén disponibles (Estatus=1, EstadoActual=1)
        const blueVoxsAsociados = instalacionesBlueVoxsActivas
          .map((ibv) => ibv.idBlueVox2)
          .filter((bx) => bx && bx.estatus === 1 && bx.estadoActual === 1);

        // Validación: debe haber al menos 1 BlueVox disponible asociado
        if (blueVoxsAsociados.length === 0) {
          erroresEstado.push(
            `No hay BlueVoxs disponibles asociados a la instalación "${instalacion.id}".`,
          );
        }

        // 3.6) Verificar vehículo esté disponible (Estatus=1, EstadoActual=1)
        const vehiculoEstado = await this.vehiculosRepository.findOne({
          where: { id: instalacion.idVehiculo, estatus: 1, estadoActual: 1 },
        });
        if (!vehiculoEstado) {
          erroresEstado.push(
            `Vehículo con placa "${instalacion.idVehiculo}" su estado actual no está disponible`,
          );
        }

        // 3.7) Si hay conflictos de disponibilidad, lanzar error con todos los detalles
        if (erroresEstado.length > 0) {
          throw new BadRequestException({
            message: `No se puede activar la instalación debido a los siguientes conflictos: ${erroresEstado[0]}`,
            errors: erroresEstado,
            conflictsCount: erroresEstado.length,
          });
        }

        // 3.8) Actualizar componentes a ASIGNADO (EstadoActual = 2)
        const body = { estadoActual: EstadoComponente.ASIGNADO };

        // Actualizar Dispositivo
        await this.dispositivosRepository.update(
          instalacion.idDispositivo,
          body,
        );

        // Actualizar TODOS los BlueVoxs asociados a esta instalación
        // IMPORTANTE: Obtenemos los IDs de BlueVoxs desde InstalacionesBlueVoxs y actualizamos su EstadoActual.
        // NO se modifica BlueVoxs.IdInstalaciones (esa columna no existe o se ignora).
        const idsBlueVoxsAsociados = instalacionesBlueVoxsActivas.map((ibv) => ibv.idBlueVox);
        if (idsBlueVoxsAsociados.length > 0) {
          await this.bluevoxsRepository.update(
            { id: In(idsBlueVoxsAsociados) }, // Filtro: IDs de BlueVoxs obtenidos de InstalacionesBlueVoxs
            body, // Actualización: EstadoActual = ASIGNADO
          );
        }

        // Actualizar Vehículo
        await this.vehiculosRepository.update(instalacion.idVehiculo, body);
      } else if (estatus === 0) {
        // ==========================================
        // CASO: DESACTIVAR INSTALACIÓN (Estatus = 0)
        // ==========================================
        // Regla de negocio: componentes pasan a DISPONIBLE, pero se mantienen los registros en InstalacionesBlueVoxs
        // (esto preserva la relación histórica para auditoría y reportes)

        const body = { estadoActual: EstadoComponente.DISPONIBLE };

        // Actualizar Dispositivo a DISPONIBLE (EstadoActual = 1)
        await this.dispositivosRepository.update(
          instalacion.idDispositivo,
          body,
        );

        // Actualizar TODOS los BlueVoxs asociados a DISPONIBLE
        // IMPORTANTE: Obtenemos los IDs de BlueVoxs desde InstalacionesBlueVoxs y actualizamos su EstadoActual.
        // NO se modifica InstalacionesBlueVoxs (se mantienen los registros activos para relación histórica).
        // NO se modifica BlueVoxs.IdInstalaciones (esa columna no existe o se ignora).
        const instalacionesBlueVoxsDesactivar = await this.instalacionesBlueVoxsRepository.find({
          where: {
            idInstalacion: instalacion.id,
            estatus: 1, // Solo asociaciones activas
          },
        });
        const idsBlueVoxsDesactivar = instalacionesBlueVoxsDesactivar.map((ibv) => ibv.idBlueVox);
        if (idsBlueVoxsDesactivar.length > 0) {
          await this.bluevoxsRepository.update(
            { id: In(idsBlueVoxsDesactivar) }, // Filtro: IDs de BlueVoxs obtenidos de InstalacionesBlueVoxs
            body, // Actualización: EstadoActual = DISPONIBLE
          );
        }

        // Actualizar Vehículo a DISPONIBLE (EstadoActual = 1)
        await this.vehiculosRepository.update(instalacion.idVehiculo, body);
      }

      // 4) Actualizar estatus de la instalación usando TypeORM
      await this.instalacionesRepository.update(id, { estatus: estatus });

      // 5) Registro en bitácora - SUCCESS
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

      // 6) Respuesta de la API
      const result: ApiCrudResponse = {
        status: 'success',
        message:
          'El estatus de las instalaciones ha sido actualizado con éxito.',
        estatus: { estatus: estatus },
        data: {
          id: id,
          nombre:
            `${instalacion.id} dispositivo:${instalacion.idDispositivo} vehiculo: ${instalacion.idVehiculo}` ||
            '',
        },
      };
      return result;
    } catch (error) {
      console.log(error);
      // Registro en bitácora - ERROR
      const querylogger = { updateInstalacioneEstatusDto };
      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `Error al cambiar el estatus de instalación con id: ${id}`,
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
  /**
   * Actualiza una instalación y sus componentes asociados (Dispositivo, Vehículo, BlueVoxs).
   * 
   * Actualización de BlueVoxs mediante Matriz de Decisiones (similar a usuarios-permisos):
   * - La relación se gestiona mediante la tabla intermedia InstalacionesBlueVoxs
   * - Matriz de decisiones:
   *   • En nueva lista + Existe en BD activo (Estatus=1) → No hacer nada
   *   • En nueva lista + Existe en BD inactivo (Estatus=0) → Activar (Estatus=1, EstadoActual=ASIGNADO)
   *   • En nueva lista + NO existe en BD → Crear nuevo (Estatus=1, EstadoActual=ASIGNADO)
   *   • NO en nueva lista + Existe activo (Estatus=1) → Desactivar (Estatus=0, EstadoActual=DISPONIBLE)
   *   • NO en nueva lista + Existe inactivo (Estatus=0) → No hacer nada
   * 
   * Reglas de negocio:
   * - El cliente se obtiene del DTO (updateInstalacioneDto.idCliente). Si no se proporciona, se usa el de la instalación existente.
   * - Los BlueVoxs deben pertenecer al mismo cliente que la instalación (del DTO o existente)
   * - Los BlueVoxs deben estar activos (Estatus=1) para ser asignados
   * - Si un BlueVox está asignado a otra instalación activa, se lanza un error indicando que ya está asignado
   * - Si un Dispositivo está asignado a otra instalación activa, se lanza un error indicando que ya está asignado
   * - Se actualiza EstadoActual de BlueVoxs (ASIGNADO al asignar, DISPONIBLE al desasignar)
   * - Los cambios se registran en el histórico de instalaciones
   * 
   * @param id ID de la instalación a actualizar
   * @param idUser ID del usuario que realiza la operación (para bitácora e histórico)
   * @param cliente ID del cliente del token (mantenido por compatibilidad, pero no se usa para validaciones)
   * @param rol Rol del usuario (para validaciones de permisos si aplica)
   * @param updateInstalacioneDto DTO con los campos a actualizar (opcionales). El idCliente se obtiene de aquí.
   * @returns Respuesta de la operación con la instalación actualizada
   * @throws NotFoundException Si la instalación no existe
   * @throws BadRequestException Si los BlueVoxs no existen o no pertenecen al cliente
   */
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

      // Obtener el cliente del DTO o usar el de la instalación existente como fallback
      // IMPORTANTE: El cliente ahora se obtiene del DTO, no del token
      const idClienteParaValidacion = updateInstalacioneDto.idCliente 
        ? Number(updateInstalacioneDto.idCliente) 
        : instalacion.idCliente;

      // Si se proporciona idCliente en el DTO, actualizar la instalación
      if (updateInstalacioneDto.idCliente !== undefined) {
        await this.instalacionesRepository.update(id, {
          idCliente: Number(updateInstalacioneDto.idCliente),
        });
      }

      // ==========================================
      // ACTUALIZACIÓN DE DISPOSITIVO
      // ==========================================
      // Validar conflictos: Si se intenta cambiar el dispositivo, verificar que no esté asignado a otra instalación activa
      if (updateInstalacioneDto.estatusDispositivoAnterior && updateInstalacioneDto.idDispositivo) {
        // Verificar que el nuevo dispositivo no esté asignado a otra instalación activa (excluyendo la actual)
        const instalacionConDispositivo = await this.instalacionesRepository.findOne({
          where: { 
            idDispositivo: Number(updateInstalacioneDto.idDispositivo), 
            estatus: 1 
          },
          relations: ['dispositivos'],
        });

        // Si existe una instalación activa con ese dispositivo Y no es la instalación actual, lanzar error
        if (instalacionConDispositivo && instalacionConDispositivo.id !== id) {
          throw new BadRequestException(
            `El dispositivo con ID ${updateInstalacioneDto.idDispositivo} ya se encuentra asignado a la instalación ${instalacionConDispositivo.id}.`,
          );
        }

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

      // ==========================================
      // ACTUALIZACIÓN DE BLUEVOXS (MATRIZ DE DECISIONES)
      // ==========================================
      // IMPORTANTE: La actualización de BlueVoxs usa la misma matriz de decisiones que usuarios-permisos.
      // La relación se gestiona mediante la tabla intermedia InstalacionesBlueVoxs.
      // 
      // Matriz de decisiones:
      // - En nueva lista + Existe en BD activo (Estatus=1) → No hacer nada
      // - En nueva lista + Existe en BD inactivo (Estatus=0) → Activar (Estatus=1, EstadoActual=ASIGNADO)
      // - En nueva lista + NO existe en BD → Crear nuevo (pero primero validar que no esté asignado a otra instalación activa)
      // - NO en nueva lista + Existe activo (Estatus=1) → Desactivar (Estatus=0, EstadoActual=DISPONIBLE)
      // - NO en nueva lista + Existe inactivo (Estatus=0) → No hacer nada
      //
      // REGLA DE NEGOCIO: Si un BlueVox está asignado a otra instalación activa, se lanza un error.
      //
      if (
        updateInstalacioneDto.idsBlueVoxs &&
        Array.isArray(updateInstalacioneDto.idsBlueVoxs)
      ) {
        // Normalizamos idsBlueVoxs (sin duplicados) y validamos que sean números válidos
        const nuevaLista: number[] = Array.from(
          new Set(updateInstalacioneDto.idsBlueVoxs.map(Number)),
        ).filter((id) => Number.isFinite(id) && id > 0);

        // Validar que los BlueVoxs solicitados existan, pertenezcan al cliente y estén activos
        // IMPORTANTE: Usamos el cliente del DTO (o el de la instalación si no se proporciona)
        const blueVoxsSolicitados = await this.bluevoxsRepository.find({
          where: {
            id: In(nuevaLista),
            idCliente: idClienteParaValidacion, // Debe pertenecer al cliente (del DTO o instalación)
            estatus: 1, // Solo BlueVoxs activos
          },
        });

        // Si algún BlueVox no existe o no pertenece al cliente, lanzar error
        if (blueVoxsSolicitados.length !== nuevaLista.length) {
          const encontrados = new Set(blueVoxsSolicitados.map((b) => Number(b.id)));
          const faltantes = nuevaLista.filter((id) => !encontrados.has(id));
          throw new BadRequestException({
            message:
              'Uno o más BlueVoxs no existen, no pertenecen al cliente o no están activos (Estatus=1).',
            faltantes,
          });
        }

        // Obtener todos los registros actuales en InstalacionesBlueVoxs para esta instalación
        // (incluyendo inactivos para poder reactivarlos si es necesario)
        const creadaLista = await this.instalacionesBlueVoxsRepository.find({
          where: { idInstalacion: id },
        });

        // Crear estructuras de datos para comparación eficiente
        const nuevaSet = new Set<number>(nuevaLista);
        const creadaMap = new Map<number, InstalacionesBlueVoxs>(
          creadaLista.map((p) => [Number(p.idBlueVox), p] as const),
        );

        // Unir todos los IDs (de la nueva lista y de la creada) para iterar sobre todos
        const todosIds = new Set<number>([
          ...nuevaSet,
          ...creadaLista.map((p) => Number(p.idBlueVox)),
        ]);

        // Iterar sobre todos los IDs y aplicar la matriz de decisiones
        for (const blueVoxId of todosIds) {
          const enNueva = nuevaSet.has(blueVoxId);
          const creado = creadaMap.get(blueVoxId);

          if (enNueva && creado) {
            // CASO 1: Existe en nueva lista Y existe en BD
            if (creado.estatus === 0) {
              // Subcaso 1.1: Está inactivo en BD → Activar y asignar
              await this.instalacionesBlueVoxsRepository.update(creado.id, {
                estatus: 1, // Activar asociación
              });
              // Actualizar EstadoActual del BlueVox a ASIGNADO
              await this.bluevoxsRepository.update(blueVoxId, {
                estadoActual: EstadoComponente.ASIGNADO,
              });
            } else {
              // Subcaso 1.2: Ya está activo → No hacer nada (ya asignado)
              continue;
            }
          } else if (enNueva && !creado) {
            // CASO 2: Existe en nueva lista pero NO existe en BD → Crear nuevo registro
            // Verificar que no exista (por el índice único, pero validamos antes)
            const existe = await this.instalacionesBlueVoxsRepository.findOne({
              where: { idInstalacion: id, idBlueVox: blueVoxId },
            });

            if (!existe) {
              // REGLA DE NEGOCIO: Verificar si el BlueVox está asignado a otra instalación activa (conflicto)
              // Si está asignado a otra instalación activa, lanzar error en lugar de desasociarlo automáticamente
              const conflictos = await this.instalacionesBlueVoxsRepository.find({
                where: {
                  idBlueVox: blueVoxId,
                  estatus: 1, // Solo asociaciones activas
                },
                relations: ['idInstalacion2', 'idBlueVox2'], // Cargar instalación y BlueVox para validar y mensaje
              });

              // Filtrar conflictos donde la instalación también está activa Y no es la instalación actual
              const conflictosActivos = conflictos.filter(
                (c) => c.idInstalacion2 && c.idInstalacion2.estatus === 1 && c.idInstalacion2.id !== id,
              );

              // Si hay conflictos activos, lanzar error indicando que el BlueVox ya está asignado
              if (conflictosActivos.length > 0) {
                const blueVox = conflictosActivos[0].idBlueVox2;
                const instalacionConflictiva = conflictosActivos[0].idInstalacion2;
                throw new BadRequestException(
                  `El BlueVox con ID ${blueVoxId} (${blueVox?.numeroSerie || 'N/A'}) ya se encuentra asignado a la instalación ${instalacionConflictiva.id}.`,
                );
              }

              // Crear nuevo registro en InstalacionesBlueVoxs
              await this.instalacionesBlueVoxsRepository.save({
                idInstalacion: id,
                idBlueVox: blueVoxId,
                estatus: 1, // Asociación activa
              });

              // Actualizar EstadoActual del BlueVox a ASIGNADO
              await this.bluevoxsRepository.update(blueVoxId, {
                estadoActual: EstadoComponente.ASIGNADO,
              });
            }
          } else if (!enNueva && creado) {
            // CASO 3: NO está en nueva lista pero SÍ existe en BD
            if (creado.estatus === 1) {
              // Subcaso 3.1: Está activo → Desactivar y liberar
              await this.instalacionesBlueVoxsRepository.update(creado.id, {
                estatus: 0, // Desactivar asociación (eliminación lógica)
              });
              // Actualizar EstadoActual del BlueVox a DISPONIBLE
              await this.bluevoxsRepository.update(blueVoxId, {
                estadoActual: EstadoComponente.DISPONIBLE,
              });
            } else {
              // Subcaso 3.2: Ya estaba inactivo → No hacer nada
              continue;
            }
          } else {
            // CASO 4: No existe ni en nueva lista ni en BD → No hacer nada (caso imposible en este loop)
            continue;
          }
        }
      }

      const instalacionActualizada = await this.instalacionesRepository.findOne(
        {
          where: { id: id },
        },
      );

      // Validar que la instalación actualizada existe (por seguridad)
      if (!instalacionActualizada) {
        throw new NotFoundException(
          `No se pudo recuperar la instalación actualizada con ID: ${id}.`,
        );
      }

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

      // Usar el cliente actualizado (del DTO si se proporcionó, o el de la instalación)
      const clienteFinal = updateInstalacioneDto.idCliente 
        ? Number(updateInstalacioneDto.idCliente) 
        : instalacionActualizada.idCliente;

      const body = {
        idInstalacion: id,
        idDispositivo: instalacionActualizada.idDispositivo,
        idVehiculo: instalacionActualizada.idVehiculo,
        idCliente: clienteFinal,
      };
      const comentario = `${updateInstalacioneDto.comentariosBluevox ?? ''} ${updateInstalacioneDto.comentariosDispositivo ?? ''}`;

      //Registro historico
      // Snapshot: BlueVoxs asociados mediante tabla intermedia InstalacionesBlueVoxs
      // IMPORTANTE: Consultamos BlueVoxs mediante InstalacionesBlueVoxs en lugar de BlueVoxs.IdInstalaciones.
      const instalacionesBlueVoxsUpdate = await this.instalacionesBlueVoxsRepository.find({
        where: { idInstalacion: id, estatus: 1 }, // Solo asociaciones activas
        relations: ['idBlueVox2'], // Cargamos los BlueVoxs relacionados
      });

      const blueVoxsUpdate = instalacionesBlueVoxsUpdate
        .map((ibv) => ibv.idBlueVox2)
        .filter((bx) => bx !== null && bx !== undefined);

      const blueVoxsSnapshot = blueVoxsUpdate.map((b) => ({
        Id: Number(b.id),
        NumeroSerie: b.numeroSerie,
      }));

      await this.historicoinstalacionesService.updateHistorico(
        body,
        Number(instalacionActualizada?.idDispositivo),
        blueVoxsSnapshot,
        Number(instalacionActualizada?.idVehiculo),
        clienteFinal, // Usar el cliente final (del DTO si se proporcionó, o el de la instalación)
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
            `Instalación ${instalacion.id} asociada a Dispositivo: ${instalacion.idDispositivo} y Vehículo: ${instalacion.idVehiculo}.` ||
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
      // Operación crítica: baja lógica + liberación de componentes debe ser atómica.
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const instalacionesRepo = queryRunner.manager.getRepository(Instalaciones);
        const dispositivosRepo = queryRunner.manager.getRepository(Dispositivos);
        const vehiculosRepo = queryRunner.manager.getRepository(Vehiculos);
        const blueVoxsRepo = queryRunner.manager.getRepository(BlueVoxs);
        const instalacionesBlueVoxsRepo = queryRunner.manager.getRepository(InstalacionesBlueVoxs);

        // 1) Buscar instalación
        const instalacion = await instalacionesRepo.findOne({
          where: { id: id },
        });

        if (!instalacion) {
          throw new NotFoundException(
            `La instalación con ID: ${id} no está disponible.`,
          );
        }

        // 1.1) Regla de negocio: Solo se puede realizar eliminado lógico cuando la instalación esté activa (Estatus = 1)
        // Si la instalación ya está inactiva, se rechaza la operación.
        if (instalacion.estatus !== 1) {
          throw new BadRequestException(
            `No se puede eliminar la instalación con ID: ${id} porque no está activa (Estatus actual: ${instalacion.estatus}). Solo se puede eliminar instalaciones activas (Estatus = 1).`,
          );
        }

        // 2) Baja lógica de instalación
        await instalacionesRepo.update(id, {
          estatus: EstatusEnum.INACTIVO,
        });

        // 3) Regla de negocio confirmada: al dar baja lógica, SIEMPRE dejar componentes en DISPONIBLE
        const body = { estadoActual: EstadoComponente.DISPONIBLE };
        await dispositivosRepo.update(instalacion.idDispositivo, body);
        await vehiculosRepo.update(instalacion.idVehiculo, body);

        // 3.1) Actualizar BlueVoxs asociados a DISPONIBLE mediante InstalacionesBlueVoxs
        // IMPORTANTE: Obtenemos los IDs de BlueVoxs desde InstalacionesBlueVoxs y actualizamos su EstadoActual.
        // NO se modifica InstalacionesBlueVoxs (se mantienen los registros activos para relación histórica).
        // NO se modifica BlueVoxs.IdInstalaciones (esa columna no existe o se ignora).
        const instalacionesBlueVoxsEliminar = await instalacionesBlueVoxsRepo.find({
          where: {
            idInstalacion: instalacion.id,
            estatus: 1, // Solo asociaciones activas
          },
        });
        const idsBlueVoxsEliminar = instalacionesBlueVoxsEliminar.map((ibv) => ibv.idBlueVox);
        if (idsBlueVoxsEliminar.length > 0) {
          await blueVoxsRepo.update(
            { id: In(idsBlueVoxsEliminar) }, // Filtro: IDs de BlueVoxs obtenidos de InstalacionesBlueVoxs
            body, // Actualización: EstadoActual = DISPONIBLE
          );
        }

        await queryRunner.commitTransaction();

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
              `${instalacion.id} dispositivo:${instalacion.idDispositivo} vehiculo: ${instalacion.idVehiculo}` ||
              '',
          },
        };
        return result;
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      console.log(error);
      //-----Registro en la bitacora----- ERROR
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `Error al eliminar (baja lógica) la instalación con ID: ${id}.`,
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
