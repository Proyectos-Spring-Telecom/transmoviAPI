import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateDerroteroDto } from './dto/create-derrotero.dto';
import { UpdateDerroteroDto } from './dto/update-derrotero.dto';
import { generarRecorridoDetallado } from '../utils/recorrido.utils';
import {
  ApiDerroteroResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from '../common/ApiResponse';
import { InjectRepository } from '@nestjs/typeorm';
import { Rutas } from 'src/entities/Rutas';
import { Repository } from 'typeorm';
import { Derroteros } from 'src/entities/Derroteros';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { UsuariosRegiones } from 'src/entities/UsuariosRegiones';
import { UpdateDerroterosEstatusDto } from './dto/update-derrotero-estatus.dto';
import { Clientes } from 'src/entities/Clientes';
import { EnumModulos } from 'src/common/estatus.enum';
import { Tarifas } from 'src/entities/Tarifas';

@Injectable()
export class DerroterosService {
  constructor(
    @InjectRepository(Rutas)
    private readonly rutasRepository: Repository<Rutas>,
    @InjectRepository(Tarifas)
    private readonly tarifasRepository: Repository<Tarifas>,
    @InjectRepository(UsuariosRegiones)
    private readonly usuariosregionesRepository: Repository<UsuariosRegiones>,
    @InjectRepository(Derroteros)
    private readonly derroterosRepository: Repository<Derroteros>,
    @InjectRepository(Clientes)
    private readonly clienteRepository: Repository<Clientes>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) { }

  async create(
    idUser: number,
    cliente: number,
    rol: number,
    createDerroteroDto: CreateDerroteroDto,
  ) {
    try {
      const {
        recorridoDetallado: puntos,
        crearDerroteroRegreso,
        // Campos de tarifa
        tarifaBase,
        distanciaBaseKm,
        incrementoCadaMetros,
        costoAdicional,
        tipoTarifa,
        estatusTarifa,
      } = createDerroteroDto;

      // ========================================
      // 🔹 VALIDAR QUE LA RUTA EXISTA
      // ========================================
      const ruta = await this.rutasRepository.findOne({
        where: { id: createDerroteroDto.idRuta },
      });

      if (!ruta) {
        throw new NotFoundException('Ruta no encontrada');
      }

      // ========================================
      // 🔹 SEPARAR DATOS DEL DERROTERO
      // ========================================
      const {
        crearDerroteroRegreso: _,
        tarifaBase: _tb,
        distanciaBaseKm: _dbk,
        incrementoCadaMetros: _icm,
        costoAdicional: _ca,
        tipoTarifa: _tt,
        estatusTarifa: _et,
        ...bodyDerrotero
      } = createDerroteroDto;

      // ========================================
      // 🔹 CREAR DERROTERO PRINCIPAL
      // ========================================
      const newDerrotero = this.derroterosRepository.create(bodyDerrotero);

      const { recorridoDetallado, distanciaKm } =
        await generarRecorridoDetallado(puntos as any);

      newDerrotero.recorridoInterpolar = recorridoDetallado;

      const derroteroSave = await this.derroterosRepository.save(newDerrotero);

      // ========================================
      // 🔹 CREAR TARIFA PRINCIPAL
      // ========================================
      const newTarifa = this.tarifasRepository.create({
        tarifaBase,
        distanciaBaseKm: distanciaBaseKm,
        incrementoCadaMetros: incrementoCadaMetros,
        costoAdicional: costoAdicional,
        tipoTarifa,
        estatus: estatusTarifa ?? 1,
        idDerrotero: derroteroSave.id,
      })

      const tarifaSave = await this.tarifasRepository.save(newTarifa);

      await this.bitacoraLogger.logToBitacora(
        'Tarifas',
        `Se creó tarifa con ID: ${tarifaSave.id} para derrotero ID: ${derroteroSave.id}`,
        'CREATE',
        { tarifa: tarifaSave },
        idUser,
        EnumModulos.DERROTEROS,
        EstatusEnumBitcora.SUCCESS,
      );

      // ========================================
      // 🔹 CREAR DERROTERO Y TARIFA DE REGRESO (SI APLICA)
      // ========================================
      let derroteroRegresoSave;
      let tarifaRegresoSave;

      if (crearDerroteroRegreso === 1 && ruta.idRutaRegreso) {
        // Invertir puntos
        const puntosRegreso = [...puntos].reverse();

        const {
          recorridoDetallado: recorridoRegreso,
          distanciaKm: distanciaRegreso
        } = await generarRecorridoDetallado(puntosRegreso as any);

        // Crear derrotero de regreso
        const derroteroRegreso = this.derroterosRepository.create({
          nombre: `${bodyDerrotero.nombre} Regreso`,
          puntoInicio: bodyDerrotero.puntoFin,
          puntoFin: bodyDerrotero.puntoInicio,
          recorridoDetallado: puntosRegreso,
          distanciaKm: distanciaRegreso || bodyDerrotero.distanciaKm,
          estatus: bodyDerrotero.estatus ?? 1,
          idRuta: ruta.idRutaRegreso,
        });

        derroteroRegreso.recorridoInterpolar = recorridoRegreso;

        derroteroRegresoSave = await this.derroterosRepository.save(derroteroRegreso);

        await this.bitacoraLogger.logToBitacora(
          'Derroteros',
          `Se creó derrotero de regreso con nombre: ${derroteroRegresoSave.nombre} y Id: ${derroteroRegresoSave.id}`,
          'CREATE',
          { derroteroRegreso: derroteroRegresoSave },
          idUser,
          EnumModulos.DERROTEROS,
          EstatusEnumBitcora.SUCCESS,
        );

        // Crear tarifa de regreso
        const tarifaRegreso = this.tarifasRepository.create({
          tarifaBase,
          distanciaBaseKm: distanciaBaseKm,
          incrementoCadaMetros: incrementoCadaMetros,
          costoAdicional: costoAdicional,
          tipoTarifa,
          estatus: estatusTarifa ?? 1,
          idDerrotero: derroteroRegresoSave.id,
        });

        tarifaRegresoSave = await this.tarifasRepository.save(tarifaRegreso);

        await this.bitacoraLogger.logToBitacora(
          'Tarifas',
          `Se creó tarifa de regreso con ID: ${tarifaRegresoSave.id} para derrotero ID: ${derroteroRegresoSave.id}`,
          'CREATE',
          { tarifaRegreso: tarifaRegresoSave },
          idUser,
          EnumModulos.TARIFAS,
          EstatusEnumBitcora.SUCCESS,
        );
      }

      // ========================================
      // 🔹 BITÁCORA - DERROTERO PRINCIPAL
      // ========================================
      await this.bitacoraLogger.logToBitacora(
        'Derroteros',
        `Se creó un derrotero con nombre: ${derroteroSave.nombre} y Id: ${derroteroSave.id}`,
        'CREATE',
        { createDerroteroDto },
        idUser,
        EnumModulos.DERROTEROS,
        EstatusEnumBitcora.SUCCESS,
      );

      // ========================================
      // 🔹 API RESPONSE
      // ========================================
      const result = {
        status: 'success',
        message: derroteroRegresoSave
          ? 'Se creó correctamente derrotero, tarifa, derrotero de regreso y tarifa de regreso'
          : 'Se creó correctamente derrotero y tarifa',
        data: {
          derroteroPrincipal: {
            id: Number(derroteroSave.id),
            nombre: derroteroSave.nombre,
            distanciaKm: Number(derroteroSave.distanciaKm),
            estatus: derroteroSave.estatus,
            idRuta: Number(derroteroSave.idRuta),
          },
          tarifaPrincipal: {
            id: Number(tarifaSave.id),
            tarifaBase: Number(tarifaSave.tarifaBase),
            tipoTarifa: tarifaSave.tipoTarifa,
            estatus: tarifaSave.estatus,
            idDerrotero: Number(tarifaSave.idDerrotero),
          },
          ...(derroteroRegresoSave && {
            derroteroRegreso: {
              id: Number(derroteroRegresoSave.id),
              nombre: derroteroRegresoSave.nombre,
              distanciaKm: Number(derroteroRegresoSave.distanciaKm),
              estatus: derroteroRegresoSave.estatus,
              idRuta: Number(derroteroRegresoSave.idRuta),
            },
          }),
          ...(tarifaRegresoSave && {
            tarifaRegreso: {
              id: Number(tarifaRegresoSave.id),
              tarifaBase: Number(tarifaRegresoSave.tarifaBase),
              tipoTarifa: tarifaRegresoSave.tipoTarifa,
              estatus: tarifaRegresoSave.estatus,
              idDerrotero: Number(tarifaRegresoSave.idDerrotero),
            },
          }),
        },
      };

      return result;

    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Derroteros',
        `Error al crear derrotero con nombre: ${createDerroteroDto.nombre}`,
        'CREATE',
        { createDerroteroDto },
        idUser,
        EnumModulos.DERROTEROS,
        EstatusEnumBitcora.ERROR,
        error.message,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException({
        message: 'Error al crear derrotero',
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

  private async consultarDerroteroPaginado(
    cliente: number,
    limit: number,
    offset: number,
  ) {
    const { ids, placeholders } = await this.clienteHijos(cliente);
    const query = `
  SELECT 
    -- Datos del derrotero (datos principales)
    d.Id AS id,
    d.Nombre AS nombreDerrotero,
    d.PuntoInicio AS puntoInicio,
    d.PuntoFin AS puntoFin,
    d.RecorridoDetallado AS recorridoDetallado,
    d.DistanciaKm AS distanciaKm,
    d.FechaCreacion AS fechaCreacionDerrotero,
    d.Estatus AS estatusDerrotero,

    -- Datos de la ruta asociada
    ru.Id AS idRuta,
    ru.Nombre AS nombreRuta,
    ru.NombreInicio AS nombreInicio,
    ru.NombreFin AS nombreFin,
    ru.FechaCreacion AS fechaCreacionRuta,
    ru.Estatus AS estatusRuta,

    -- Región de inicio
    r.Id AS idRegionInicio,
    r.Nombre AS nombreRegionInicio,
    r.Descripcion AS descripcionRegionInicio,
    r.FechaCreacion AS fechaCreacionRegionInicio,
    r.FechaActualizacion AS fechaActualizacionRegionInicio,
    r.Estatus AS estatusRegionInicio,

    -- Región de fin
    rf.Id AS idRegionFin,
    rf.Nombre AS nombreRegionFin,
    rf.Descripcion AS descripcionRegionFin,
    rf.FechaCreacion AS fechaCreacionRegionFin,
    rf.FechaActualizacion AS fechaActualizacionRegionFin,
    rf.Estatus AS estatusRegionFin,

    -- Cliente relacionado
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,
    c.Estatus AS estatusCliente,
    CONCAT(c.Nombre, ' ', c.ApellidoPaterno, ' ', c.ApellidoMaterno) AS nombreCompletoCliente

FROM Derroteros d
INNER JOIN Rutas ru ON d.IdRuta = ru.Id
INNER JOIN Regiones r ON ru.IdRegion = r.Id
LEFT JOIN Regiones rf ON ru.IdRegionFin = rf.Id
INNER JOIN Clientes c ON r.IdCliente = c.Id

WHERE c.Id IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar
  AND ru.Estatus = 1         -- Solo rutas activas
  AND r.Estatus = 1          -- Solo regiones activas

ORDER BY d.Id DESC

  LIMIT ? OFFSET ?;
    `;
    return this.usuariosregionesRepository.query(query, [
      ...ids,
      limit,
      offset,
    ]);
  }

  private async consultarTotalDerroteroPaginados(cliente: number) {
    const { ids, placeholders } = await this.clienteHijos(cliente);
    const query = `  
    SELECT COUNT(*) AS total
FROM Derroteros d
INNER JOIN Rutas ru ON d.IdRuta = ru.Id
INNER JOIN Regiones r ON ru.IdRegion = r.Id
LEFT JOIN Regiones rf ON ru.IdRegionFin = rf.Id
INNER JOIN Clientes c ON r.IdCliente = c.Id

WHERE c.Id IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar
  AND ru.Estatus = 1         -- Solo rutas activas
  AND r.Estatus = 1          -- Solo regiones activas
`;
    return await this.usuariosregionesRepository.query(query, [...ids]);
  }

  async findAll(
    idUser: number,
    cliente: number,
    rol: number,
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    try {
      const offset = (page - 1) * limit;
      let data;
      let totalResult;
      switch (rol) {
        case 1:
          // Consulta de datos paginados Usuario SuperAdministrador
          data = await this.usuariosregionesRepository.query(
            `
  SELECT 
    -- Datos del derrotero (datos principales)
    d.Id AS id,
    d.Nombre AS nombreDerrotero,
    d.PuntoInicio AS puntoInicio,
    d.PuntoFin AS puntoFin,
    d.RecorridoDetallado AS recorridoDetallado,
    d.DistanciaKm AS distanciaKm,
    d.FechaCreacion AS fechaCreacionDerrotero,
    d.Estatus AS estatusDerrotero,

    -- Datos de la ruta asociada
    ru.Id AS idRuta,
    ru.Nombre AS nombreRuta,
    ru.NombreInicio AS nombreInicio,
    ru.NombreFin AS nombreFin,
    ru.FechaCreacion AS fechaCreacionRuta,
    ru.Estatus AS estatusRuta,

    -- Región de inicio
    r.Id AS idRegionInicio,
    r.Nombre AS nombreRegionInicio,
    r.Descripcion AS descripcionRegionInicio,
    r.FechaCreacion AS fechaCreacionRegionInicio,
    r.FechaActualizacion AS fechaActualizacionRegionInicio,
    r.Estatus AS estatusRegionInicio,

    -- Región de fin
    rf.Id AS idRegionFin,
    rf.Nombre AS nombreRegionFin,
    rf.Descripcion AS descripcionRegionFin,
    rf.FechaCreacion AS fechaCreacionRegionFin,
    rf.FechaActualizacion AS fechaActualizacionRegionFin,
    rf.Estatus AS estatusRegionFin,

    -- Cliente relacionado
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,
    c.Estatus AS estatusCliente,
    CONCAT(c.Nombre, ' ', c.ApellidoPaterno, ' ', c.ApellidoMaterno) AS nombreCompletoCliente

FROM Derroteros d
INNER JOIN Rutas ru ON d.IdRuta = ru.Id
INNER JOIN Regiones r ON ru.IdRegion = r.Id
LEFT JOIN Regiones rf ON ru.IdRegionFin = rf.Id
INNER JOIN Clientes c ON r.IdCliente = c.Id

WHERE ru.Estatus = 1         -- Solo rutas activas
  AND r.Estatus = 1          -- Solo regiones activas

ORDER BY d.Id DESC

  LIMIT ? OFFSET ?;
  `,
            [limit, offset],
          );

          // Query para total (sin paginación)
          totalResult = await this.usuariosregionesRepository.query(
            `
SELECT COUNT(*) AS total
FROM Derroteros d
INNER JOIN Rutas ru ON d.IdRuta = ru.Id
INNER JOIN Regiones r ON ru.IdRegion = r.Id
LEFT JOIN Regiones rf ON ru.IdRegionFin = rf.Id
INNER JOIN Clientes c ON r.IdCliente = c.Id

WHERE ru.Estatus = 1         -- Solo rutas activas
  AND r.Estatus = 1  
  `,
          );
          break;

        case 2:
          // Consulta de datos paginados Usuario Administrador
          data = await this.consultarDerroteroPaginado(cliente, limit, offset);

          // Query para total (sin paginación)
          totalResult = await this.consultarTotalDerroteroPaginados(cliente);
          break;

        case 3:
          // Consulta de datos paginados Usuario Operador
          data = await this.consultarDerroteroPaginado(cliente, limit, offset);

          // Query para total (sin paginación)
          totalResult = await this.consultarTotalDerroteroPaginados(cliente);
          break;

        case 8:
          // Consulta de datos paginados Usuario Reportes
          data = await this.consultarDerroteroPaginado(cliente, limit, offset);

          // Query para total (sin paginación)
          totalResult = await this.consultarTotalDerroteroPaginados(cliente);
          break;

        case 10:
          // Consulta de datos paginados Usuario Capturista
          data = await this.consultarDerroteroPaginado(cliente, limit, offset);

          // Query para total (sin paginación)
          totalResult = await this.consultarTotalDerroteroPaginados(cliente);
          break;

        default:
          // Consulta de datos paginados Usuario
          const { ids, placeholders } = await this.clienteHijos(cliente)
          data = await this.usuariosregionesRepository.query(
            `
  SELECT 
    -- Datos del derrotero (datos principales)
    d.Id AS id,
    d.Nombre AS nombreDerrotero,
    d.PuntoInicio AS puntoInicio,
    d.PuntoFin AS puntoFin,
    d.RecorridoDetallado AS recorridoDetallado,
    d.DistanciaKm AS distanciaKm,
    d.FechaCreacion AS fechaCreacionDerrotero,
    d.Estatus AS estatusDerrotero,

    -- Datos de la ruta asociada
    ru.Id AS idRuta,
    ru.Nombre AS nombreRuta,
    ru.NombreInicio AS nombreInicio,
    ru.NombreFin AS nombreFin,
    ru.FechaCreacion AS fechaCreacionRuta,
    ru.Estatus AS estatusRuta,

    -- Región de inicio
    r.Id AS idRegionInicio,
    r.Nombre AS nombreRegionInicio,
    r.Descripcion AS descripcionRegionInicio,
    r.FechaCreacion AS fechaCreacionRegionInicio,
    r.FechaActualizacion AS fechaActualizacionRegionInicio,
    r.Estatus AS estatusRegionInicio,

    -- Región de fin
    rf.Id AS idRegionFin,
    rf.Nombre AS nombreRegionFin,
    rf.Descripcion AS descripcionRegionFin,
    rf.FechaCreacion AS fechaCreacionRegionFin,
    rf.FechaActualizacion AS fechaActualizacionRegionFin,
    rf.Estatus AS estatusRegionFin,

    -- Cliente relacionado
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,
    c.Estatus AS estatusCliente,
    CONCAT(c.Nombre, ' ', c.ApellidoPaterno, ' ', c.ApellidoMaterno) AS nombreCompletoCliente

  FROM Derroteros d
  INNER JOIN Rutas ru ON d.IdRuta = ru.Id
  INNER JOIN Regiones r ON ru.IdRegion = r.Id
  LEFT JOIN Regiones rf ON ru.IdRegionFin = rf.Id
  INNER JOIN Clientes c ON r.IdCliente = c.Id
  INNER JOIN UsuariosRegiones ur ON ur.IdRegion = r.Id

  WHERE ur.IdUsuario = ?
    AND ur.Estatus = 1
    AND r.Estatus = 1
    AND ru.Estatus = 1
    AND c.Id = IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar

  ORDER BY d.Id DESC
  LIMIT ? OFFSET ?
  `,
            [idUser, ...ids, limit, offset],
          );

          // Query para total (sin paginación)
          totalResult = await this.usuariosregionesRepository.query(
            `
SELECT COUNT(*) AS total
FROM Derroteros d
INNER JOIN Rutas ru ON d.IdRuta = ru.Id
INNER JOIN Regiones r ON ru.IdRegion = r.Id
INNER JOIN UsuariosRegiones ur ON ur.IdRegion = r.Id
WHERE ur.IdUsuario = ?
  AND ur.Estatus = 1
  AND r.Estatus = 1
  AND ru.Estatus = 1
  AND r.IdCliente IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar
  `,
            [idUser, ...ids],
          );
          break;
      }

      const total = Number(totalResult[0]?.total ?? 0);

      const derroteros = data.map((item) => ({
        ...item,
        id: Number(item.id),
        idRuta: Number(item.idRuta),
        idRegionInicio: Number(item.idRegionInicio),
        idRegionFin: item.idRegionFin ? Number(item.idRegionFin) : null,
        idCliente: Number(item.idCliente),
        distanciaKm: Number(item.distanciaKm),
      }));

      // Transformación de resultados
      const result: ApiResponseCommon = {
        data: derroteros,
        paginated: {
          total,
          page,
          lastPage: Math.ceil(total / limit),
        },
      };

      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException({
        message: 'Error al obtener paginado derroteros',
        error: error.message,
      });
    }
  }

  private async consultarDerroteroListado(cliente: number) {
    const { ids, placeholders } = await this.clienteHijos(cliente);
    const query = `
  SELECT 
    -- Datos del derrotero (datos principales)
    d.Id AS id,
    d.Nombre AS nombreDerrotero,
    d.PuntoInicio AS puntoInicio,
    d.PuntoFin AS puntoFin,
    d.RecorridoDetallado AS recorridoDetallado,
    d.DistanciaKm AS distanciaKm,
    d.FechaCreacion AS fechaCreacionDerrotero,
    d.Estatus AS estatusDerrotero,

    -- Datos de la ruta asociada
    ru.Id AS idRuta,
    ru.Nombre AS nombreRuta,
    ru.NombreInicio AS nombreInicio,
    ru.NombreFin AS nombreFin,
    ru.FechaCreacion AS fechaCreacionRuta,
    ru.Estatus AS estatusRuta,

    -- Región de inicio
    r.Id AS idRegionInicio,
    r.Nombre AS nombreRegionInicio,
    r.Descripcion AS descripcionRegionInicio,
    r.FechaCreacion AS fechaCreacionRegionInicio,
    r.FechaActualizacion AS fechaActualizacionRegionInicio,
    r.Estatus AS estatusRegionInicio,

    -- Región de fin
    rf.Id AS idRegionFin,
    rf.Nombre AS nombreRegionFin,
    rf.Descripcion AS descripcionRegionFin,
    rf.FechaCreacion AS fechaCreacionRegionFin,
    rf.FechaActualizacion AS fechaActualizacionRegionFin,
    rf.Estatus AS estatusRegionFin,

    -- Cliente relacionado
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,
    c.Estatus AS estatusCliente,
    CONCAT(c.Nombre, ' ', c.ApellidoPaterno, ' ', c.ApellidoMaterno) AS nombreCompletoCliente

FROM Derroteros d
INNER JOIN Rutas ru ON d.IdRuta = ru.Id
INNER JOIN Regiones r ON ru.IdRegion = r.Id
LEFT JOIN Regiones rf ON ru.IdRegionFin = rf.Id
INNER JOIN Clientes c ON r.IdCliente = c.Id

WHERE c.Id IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar
  AND c.Estatus = 1
  AND ru.Estatus = 1         -- Solo rutas activas
  AND r.Estatus = 1          -- Solo regiones activas
  AND d.Estatus = 1

ORDER BY d.Id DESC;
    `;
    return this.usuariosregionesRepository.query(query, [...ids]);
  }

  async findAllList(idUser: number, cliente: number, rol: number) {
    try {
      let data;
      switch (rol) {
        case 1:
          // Consulta de datos paginados Usuario SuperAdministrador
          data = await this.usuariosregionesRepository.query(
            `
  SELECT 
    -- Datos del derrotero (datos principales)
    d.Id AS id,
    d.Nombre AS nombreDerrotero,
    d.PuntoInicio AS puntoInicio,
    d.PuntoFin AS puntoFin,
    d.RecorridoDetallado AS recorridoDetallado,
    d.DistanciaKm AS distanciaKm,
    d.FechaCreacion AS fechaCreacionDerrotero,
    d.Estatus AS estatusDerrotero,

    -- Datos de la ruta asociada
    ru.Id AS idRuta,
    ru.Nombre AS nombreRuta,
    ru.NombreInicio AS nombreInicio,
    ru.NombreFin AS nombreFin,
    ru.FechaCreacion AS fechaCreacionRuta,
    ru.Estatus AS estatusRuta,

    -- Región de inicio
    r.Id AS idRegionInicio,
    r.Nombre AS nombreRegionInicio,
    r.Descripcion AS descripcionRegionInicio,
    r.FechaCreacion AS fechaCreacionRegionInicio,
    r.FechaActualizacion AS fechaActualizacionRegionInicio,
    r.Estatus AS estatusRegionInicio,

    -- Región de fin
    rf.Id AS idRegionFin,
    rf.Nombre AS nombreRegionFin,
    rf.Descripcion AS descripcionRegionFin,
    rf.FechaCreacion AS fechaCreacionRegionFin,
    rf.FechaActualizacion AS fechaActualizacionRegionFin,
    rf.Estatus AS estatusRegionFin,

    -- Cliente relacionado
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,
    c.Estatus AS estatusCliente,
    CONCAT(c.Nombre, ' ', c.ApellidoPaterno, ' ', c.ApellidoMaterno) AS nombreCompletoCliente

FROM Derroteros d
INNER JOIN Rutas ru ON d.IdRuta = ru.Id
INNER JOIN Regiones r ON ru.IdRegion = r.Id
LEFT JOIN Regiones rf ON ru.IdRegionFin = rf.Id
INNER JOIN Clientes c ON r.IdCliente = c.Id

WHERE ru.Estatus = 1         -- Solo rutas activas
  AND r.Estatus = 1          -- Solo regiones activas
  AND d.Estatus = 1
  AND c.Estatus = 1

ORDER BY d.Id DESC;
      `,
          );
          break;

        case 2:
          // Consulta de datos paginados Usuario Administrador
          data = await this.consultarDerroteroListado(cliente);
          break;

        case 3:
          // Consulta de datos paginados Usuario Operador
          data = await this.consultarDerroteroListado(cliente);
          break;

        case 8:
          // Consulta de datos paginados Usuario Reportes
          data = await this.consultarDerroteroListado(cliente);
          break;

        case 10:
          // Consulta de datos paginados Usuario Capturista
          data = await this.consultarDerroteroListado(cliente);
          break;

        default:
          // Consulta de datos paginados Usuario
          const { ids, placeholders } = await this.clienteHijos(cliente)
          data = await this.usuariosregionesRepository.query(
            `
      SELECT 
  -- Datos del derrotero (datos principales)
  d.Id AS id,
  d.Nombre AS nombreDerrotero,
  d.PuntoInicio AS puntoInicio,
  d.PuntoFin AS puntoFin,
  d.RecorridoDetallado AS recorridoDetallado,
  d.DistanciaKm AS distanciaKm,
  d.FechaCreacion AS fechaCreacionDerrotero,
  d.Estatus AS estatusDerrotero,

  -- Datos de la ruta asociada
  ru.Id AS idRuta,
  ru.Nombre AS nombreRuta,
  ru.NombreInicio AS nombreInicio,
  ru.NombreFin AS nombreFin,
  ru.FechaCreacion AS fechaCreacionRuta,
  ru.Estatus AS estatusRuta,

  -- Región de inicio
  r.Id AS idRegionInicio,
  r.Nombre AS nombreRegionInicio,
  r.Descripcion AS descripcionRegionInicio,
  r.FechaCreacion AS fechaCreacionRegionInicio,
  r.FechaActualizacion AS fechaActualizacionRegionInicio,
  r.Estatus AS estatusRegionInicio,

  -- Región de fin
  rf.Id AS idRegionFin,
  rf.Nombre AS nombreRegionFin,
  rf.Descripcion AS descripcionRegionFin,
  rf.FechaCreacion AS fechaCreacionRegionFin,
  rf.FechaActualizacion AS fechaActualizacionRegionFin,
  rf.Estatus AS estatusRegionFin,

  -- Cliente relacionado
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente,
  CONCAT(c.Nombre, ' ', c.ApellidoPaterno, ' ', c.ApellidoMaterno) AS nombreCompletoCliente

FROM Derroteros d
INNER JOIN Rutas ru ON d.IdRuta = ru.Id
INNER JOIN Regiones r ON ru.IdRegion = r.Id
LEFT JOIN Regiones rf ON ru.IdRegionFin = rf.Id
INNER JOIN Clientes c ON r.IdCliente = c.Id
INNER JOIN UsuariosRegiones ur ON ur.IdRegion = r.Id

WHERE ur.IdUsuario = ?
  AND ur.Estatus = 1
  AND r.Estatus = 1
  AND ru.Estatus = 1
  AND d.Estatus = 1
  AND c.Estatus = 1
   AND c.Id IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar

ORDER BY d.Id DESC;
      `,
            [idUser, ids], // parámetro seguro
          );
          break;
      }

      const derroteros = data.map((item) => ({
        ...item,
        id: Number(item.id),
        idRuta: Number(item.idRuta),
        idRegionInicio: Number(item.idRegionInicio),
        idRegionFin: item.idRegionFin ? Number(item.idRegionFin) : null,
        idCliente: Number(item.idCliente),
        distanciaKm: Number(item.distanciaKm),
      }));

      // Transformación de resultados
      const result: ApiResponseCommon = {
        data: derroteros,
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException({
        message: 'Error al obtener listado derroteros',
        error: error.message,
      });
    }
  }

  // ========================================
  // 🔹 OBTENER DERROTEROS POR RUTA
  // ========================================
  async findByRuta(idRuta: number, idUser: number, rol: number) {
    try {
      // Consulta directa de derroteros por ruta (solo la ruta especificada)
      const derroteros = await this.derroterosRepository.query(
        `
SELECT 
  -- Datos del derrotero (datos principales)
  d.Id AS id,
  d.Nombre AS nombreDerrotero,
  d.PuntoInicio AS puntoInicio,
  d.PuntoFin AS puntoFin,
  d.RecorridoDetallado AS recorridoDetallado,
  d.DistanciaKm AS distanciaKm,
  d.FechaCreacion AS fechaCreacionDerrotero,
  d.Estatus AS estatusDerrotero,

  -- Datos de la ruta asociada
  ru.Id AS idRuta,
  ru.Nombre AS nombreRuta,
  ru.NombreInicio AS nombreInicio,
  ru.NombreFin AS nombreFin,
  ru.FechaCreacion AS fechaCreacionRuta,
  ru.Estatus AS estatusRuta,

  -- Región de inicio
  r.Id AS idRegionInicio,
  r.Nombre AS nombreRegionInicio,
  r.Descripcion AS descripcionRegionInicio,
  r.FechaCreacion AS fechaCreacionRegionInicio,
  r.FechaActualizacion AS fechaActualizacionRegionInicio,
  r.Estatus AS estatusRegionInicio,

  -- Región de fin
  rf.Id AS idRegionFin,
  rf.Nombre AS nombreRegionFin,
  rf.Descripcion AS descripcionRegionFin,
  rf.FechaCreacion AS fechaCreacionRegionFin,
  rf.FechaActualizacion AS fechaActualizacionRegionFin,
  rf.Estatus AS estatusRegionFin,

  -- Cliente relacionado
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente,
  CONCAT(c.Nombre, ' ', c.ApellidoPaterno, ' ', c.ApellidoMaterno) AS nombreCompletoCliente

FROM Derroteros d
INNER JOIN Rutas ru ON d.IdRuta = ru.Id
INNER JOIN Regiones r ON ru.IdRegion = r.Id
LEFT JOIN Regiones rf ON ru.IdRegionFin = rf.Id
INNER JOIN Clientes c ON r.IdCliente = c.Id

WHERE 
  d.IdRuta = ?
  AND r.Estatus = 1
  AND ru.Estatus = 1
  AND d.Estatus = 1
  AND c.Estatus = 1

ORDER BY d.Id DESC
        `,
        [idRuta],
      );

      // Mapeo de resultados con conversión de tipos
      const data = derroteros.map((item) => ({
        ...item,
        id: Number(item.id),
        idRuta: Number(item.idRuta),
        idRegionInicio: Number(item.idRegionInicio),
        idRegionFin: item.idRegionFin ? Number(item.idRegionFin) : null,
        idCliente: Number(item.idCliente),
        distanciaKm: Number(item.distanciaKm),
      }));

      // API response
      const result: ApiResponseCommon = {
        data: data,
      };

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtener derroteros por ruta',
        error: error.message,
      });
    }
  }

  private async consultarDerroteroOne(cliente: number, id: number) {
    const { ids, placeholders } = await this.clienteHijos(cliente);
    const query = `
  SELECT 
    -- Datos del derrotero (datos principales)
    d.Id AS id,
    d.Nombre AS nombreDerrotero,
    d.PuntoInicio AS puntoInicio,
    d.PuntoFin AS puntoFin,
    d.RecorridoDetallado AS recorridoDetallado,
    d.DistanciaKm AS distanciaKm,
    d.FechaCreacion AS fechaCreacionDerrotero,
    d.Estatus AS estatusDerrotero,

    -- Datos de la ruta asociada
    ru.Id AS idRuta,
    ru.Nombre AS nombreRuta,
    ru.NombreInicio AS nombreInicio,
    ru.NombreFin AS nombreFin,
    ru.FechaCreacion AS fechaCreacionRuta,
    ru.Estatus AS estatusRuta,

    -- Región de inicio
    r.Id AS idRegionInicio,
    r.Nombre AS nombreRegionInicio,
    r.Descripcion AS descripcionRegionInicio,
    r.FechaCreacion AS fechaCreacionRegionInicio,
    r.FechaActualizacion AS fechaActualizacionRegionInicio,
    r.Estatus AS estatusRegionInicio,

    -- Región de fin
    rf.Id AS idRegionFin,
    rf.Nombre AS nombreRegionFin,
    rf.Descripcion AS descripcionRegionFin,
    rf.FechaCreacion AS fechaCreacionRegionFin,
    rf.FechaActualizacion AS fechaActualizacionRegionFin,
    rf.Estatus AS estatusRegionFin,

    -- Cliente relacionado
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,
    c.Estatus AS estatusCliente,
    CONCAT(c.Nombre, ' ', c.ApellidoPaterno, ' ', c.ApellidoMaterno) AS nombreCompletoCliente

FROM Derroteros d
INNER JOIN Rutas ru ON d.IdRuta = ru.Id
INNER JOIN Regiones r ON ru.IdRegion = r.Id
LEFT JOIN Regiones rf ON ru.IdRegionFin = rf.Id
INNER JOIN Clientes c ON r.IdCliente = c.Id

WHERE c.Id IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar
  AND ru.Estatus = 1         -- Solo rutas activas
  AND r.Estatus = 1          -- Solo regiones activas
  AND d.Estatus = 1
  AND d.Id = ?

ORDER BY d.Id DESC;
    `;
    return this.usuariosregionesRepository.query(query, [...ids, id]);
  }

  async findOne(id: number, idUser: number, cliente: number, rol: number) {
    try {
      let data;
      switch (rol) {
        case 1:
          // Consulta de datos paginados Usuario SuperAdministrador
          data = await this.usuariosregionesRepository.query(
            `
    SELECT 
  -- Datos del derrotero (datos principales)
  d.Id AS id,
  d.Nombre AS nombreDerrotero,
  d.PuntoInicio AS puntoInicio,
  d.PuntoFin AS puntoFin,
  d.RecorridoDetallado AS recorridoDetallado,
  d.RecorridoInterpolar AS recorridoInterpolar,
  d.DistanciaKm AS distanciaKm,
  d.FechaCreacion AS fechaCreacionDerrotero,
  d.FechaActualizacion AS fechaActualizacion,
  d.Estatus AS estatusDerrotero,

  -- Datos de la ruta asociada
  ru.Id AS idRuta,
  ru.Nombre AS nombreRuta,
  ru.NombreInicio AS nombreInicio,
  ru.NombreFin AS nombreFin,
  ru.FechaCreacion AS fechaCreacionRuta,
  ru.Estatus AS estatusRuta,

  -- Región de inicio
  r.Id AS idRegionInicio,
  r.Nombre AS nombreRegionInicio,
  r.Descripcion AS descripcionRegionInicio,
  r.FechaCreacion AS fechaCreacionRegionInicio,
  r.FechaActualizacion AS fechaActualizacionRegionInicio,
  r.Estatus AS estatusRegionInicio,

  -- Región de fin
  rf.Id AS idRegionFin,
  rf.Nombre AS nombreRegionFin,
  rf.Descripcion AS descripcionRegionFin,
  rf.FechaCreacion AS fechaCreacionRegionFin,
  rf.FechaActualizacion AS fechaActualizacionRegionFin,
  rf.Estatus AS estatusRegionFin,

  -- Cliente relacionado
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente,
  CONCAT(c.Nombre, ' ', c.ApellidoPaterno, ' ', c.ApellidoMaterno) AS nombreCompletoCliente

FROM Derroteros d
INNER JOIN Rutas ru ON d.IdRuta = ru.Id
INNER JOIN Regiones r ON ru.IdRegion = r.Id
LEFT JOIN Regiones rf ON ru.IdRegionFin = rf.Id
INNER JOIN Clientes c ON r.IdCliente = c.Id
INNER JOIN UsuariosRegiones ur ON ur.IdRegion = r.Id

WHERE ur.IdUsuario = ?
  AND ur.Estatus = 1
  AND r.Estatus = 1
  AND ru.Estatus = 1
  AND d.Id = ? -- Id del derrotero
      `,
            [idUser, id], // parámetro seguro
          );
          break;

        case 2:
          // Consulta de datos paginados Usuario Administrador
          data = await this.consultarDerroteroOne(cliente, id);
          break;

        case 3:
          // Consulta de datos paginados Usuario Operador
          data = await this.consultarDerroteroOne(cliente, id);
          break;

        case 8:
          // Consulta de datos paginados Usuario Reportes
          data = await this.consultarDerroteroOne(cliente, id);
          break;

        case 10:
          // Consulta de datos paginados Usuario Capturista
          data = await this.consultarDerroteroOne(cliente, id);
          break;

        default:
          // Consulta de datos paginados Usuario
          const { ids, placeholders } = await this.clienteHijos(cliente)
          data = await this.usuariosregionesRepository.query(
            `
    SELECT 
  -- Datos del derrotero (datos principales)
  d.Id AS id,
  d.Nombre AS nombreDerrotero,
  d.PuntoInicio AS puntoInicio,
  d.PuntoFin AS puntoFin,
  d.RecorridoDetallado AS recorridoDetallado,
  d.RecorridoInterpolar AS recorridoInterpolar,
  d.DistanciaKm AS distanciaKm,
  d.FechaCreacion AS fechaCreacionDerrotero,
  d.FechaActualizacion AS fechaActualizacion,
  d.Estatus AS estatusDerrotero,

  -- Datos de la ruta asociada
  ru.Id AS idRuta,
  ru.Nombre AS nombreRuta,
  ru.NombreInicio AS nombreInicio,
  ru.NombreFin AS nombreFin,
  ru.FechaCreacion AS fechaCreacionRuta,
  ru.Estatus AS estatusRuta,

  -- Región de inicio
  r.Id AS idRegionInicio,
  r.Nombre AS nombreRegionInicio,
  r.Descripcion AS descripcionRegionInicio,
  r.FechaCreacion AS fechaCreacionRegionInicio,
  r.FechaActualizacion AS fechaActualizacionRegionInicio,
  r.Estatus AS estatusRegionInicio,

  -- Región de fin
  rf.Id AS idRegionFin,
  rf.Nombre AS nombreRegionFin,
  rf.Descripcion AS descripcionRegionFin,
  rf.FechaCreacion AS fechaCreacionRegionFin,
  rf.FechaActualizacion AS fechaActualizacionRegionFin,
  rf.Estatus AS estatusRegionFin,

  -- Cliente relacionado
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente,
  CONCAT(c.Nombre, ' ', c.ApellidoPaterno, ' ', c.ApellidoMaterno) AS nombreCompletoCliente

FROM Derroteros d
INNER JOIN Rutas ru ON d.IdRuta = ru.Id
INNER JOIN Regiones r ON ru.IdRegion = r.Id
LEFT JOIN Regiones rf ON ru.IdRegionFin = rf.Id
INNER JOIN Clientes c ON r.IdCliente = c.Id
INNER JOIN UsuariosRegiones ur ON ur.IdRegion = r.Id

WHERE ur.IdUsuario = ?
  AND ur.Estatus = 1
  AND r.Estatus = 1
  AND ru.Estatus = 1
  AND d.Id = ? -- Id del derrotero
  AND c.Id = IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar
      `,
            [idUser, id, ids], // parámetro seguro
          );
          break;
      }

      if (data.length === 0) {
        throw new NotFoundException('Derrotero no encontradas');
      }

      const derrotero = data.map((item) => ({
        ...item,
        id: Number(item.id),
        idRuta: Number(item.idRuta),
        idRegionInicio: Number(item.idRegionInicio),
        idRegionFin: item.idRegionFin ? Number(item.idRegionFin) : null,
        idCliente: Number(item.idCliente),
        distanciaKm: Number(item.distanciaKm),
      }));

      return { data: derrotero };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException({
        message: 'Error al obtener derroteros por ID',
        error: error.message,
      });
    }
  }

  async updateEstatus(
    id: number,
    idUser: number,
    cliente: number,
    rol: number,
    updateDerroterosEstatusDto: UpdateDerroterosEstatusDto,
  ) {
    try {
      let derrotero;
      derrotero = await this.derroterosRepository.findOne({
        where: { id: id },
      });
      if (!derrotero) throw new NotFoundException('Derrotero no encontrado');

      //actualizacion de estatus
      const estatus = updateDerroterosEstatusDto.estatus;
      await this.derroterosRepository.update(id, { estatus: estatus });

      // Registro en la bitácora SUCCESS
      const querylogger = { updateDerroterosEstatusDto };
      await this.bitacoraLogger.logToBitacora(
        'Derroteros',
        `Se actualizo estatus a ${updateDerroterosEstatusDto.estatus} de un derrotero con nombre: ${derrotero.nombre}  y Id ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.RUTAS,
        EstatusEnumBitcora.SUCCESS,
      );

      //API response
      const result: ApiDerroteroResponse = {
        status: 'success',
        message: 'Se actualizo correctamente estatus del derrotero',
        id: Number(derrotero.id),
        nombre: derrotero.nombre,
        distancia: Number(derrotero.distanciaKm),
        estatus: estatus,
      };

      return result;
    } catch (error) {
      // Registro en la bitácora ERROR
      const querylogger = { updateDerroterosEstatusDto };
      await this.bitacoraLogger.logToBitacora(
        'Derroteros',
        `Se actualizo estatus a ${updateDerroterosEstatusDto.estatus} de un derrotero con ID: ${id} y Id ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.RUTAS,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException({
        message: 'Error al actualizar estatus derroteros',
        error: error.message,
      });
    }
  }

  async update(
    id: number,
    idUser: number,
    cliente: number,
    rol: number,
    updateDerroteroDto: UpdateDerroteroDto,
  ) {
    try {
      let newDerrotero = this.derroterosRepository.create(updateDerroteroDto);

      if (
        Array.isArray(updateDerroteroDto.recorridoDetallado) &&
        updateDerroteroDto.recorridoDetallado.length > 0
      ) {
        const puntos = updateDerroteroDto.recorridoDetallado;

        const { recorridoDetallado: nuevoRecorrido, distanciaKm } =
          await generarRecorridoDetallado(puntos as any);

        newDerrotero.recorridoInterpolar = nuevoRecorrido;
      }

      await this.derroterosRepository.update(id, newDerrotero);

      // Registro en la bitácora SUCCESS
      const querylogger = { updateDerroteroDto };
      await this.bitacoraLogger.logToBitacora(
        'Derroteros',
        `Se actualizo un derrotero con nombre: ${newDerrotero.nombre} y Id ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.RUTAS,
        EstatusEnumBitcora.SUCCESS,
      );

      //API response
      const result: ApiDerroteroResponse = {
        status: 'succes',
        message: 'Se actualizo correctamente derrotero',
        id: id,
        nombre: newDerrotero.nombre,
        distancia: Number(newDerrotero.distanciaKm),
        estatus: newDerrotero.estatus,
      };

      return result;
    } catch (error) {
      // Registro en la bitácora ERROR
      const querylogger = { updateDerroteroDto };
      await this.bitacoraLogger.logToBitacora(
        'Derroteros',
        `Se actualizo un derrotero con ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.RUTAS,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al actualizar derrotero',
        error: error.message,
      });
    }
  }

  async remove(id: number, idUser: number, cliente: number, rol: number) {
    try {
      let derrotero;
      derrotero = await this.derroterosRepository.findOne({
        where: { id: id },
      });
      if (!derrotero) throw new NotFoundException('Derrotero no encontrado');

      //eliminado logico
      await this.derroterosRepository.update(id, { estatus: 0 });

      // Registro en la bitácora SUCCESS
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Derroteros',
        `Se elimino estatus a ${0} de un derrotero con nombre: ${derrotero.nombre} y Id ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.RUTAS,
        EstatusEnumBitcora.SUCCESS,
      );

      //API response
      const result: ApiDerroteroResponse = {
        status: 'succes',
        message: 'Se elimino correctamente el derrotero',
        id: Number(derrotero.id),
        nombre: derrotero.nombre,
        distancia: Number(derrotero.distanciaKm),
        estatus: 0,
      };

      return result;
    } catch (error) {
      // Registro en la bitácora SUCCESS
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Derroteros',
        `Se elimino a estatus a ${0} de un derrotero con ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.RUTAS,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException({
        message: 'Error al eliminado logico derroteros',
        error: error.message,
      });
    }
  }

  async removeTotal(id: number, idUser: number, cliente: number, rol: number) {
    try {
      let derrotero;
      switch (rol) {
        case 1:
          // Usuario SuperAdministrador
          derrotero = await this.derroterosRepository.findOne({
            where: { id: id },
          });
          if (!derrotero)
            throw new NotFoundException('Derrotero no encontrado');
          break;

        default:
          throw new BadRequestException(`Acceso denegado`);
          break;
      }

      //eliminado completo
      await this.derroterosRepository.delete({ id: id });

      // Registro en la bitácora SUCCESS
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Derroteros',
        `Se elimino  un derrotero con nombre: ${derrotero.nombre} y Id ${id}`,
        'DELETE',
        querylogger,
        idUser,
        EnumModulos.RUTAS,
        EstatusEnumBitcora.SUCCESS,
      );

      //API response
      const result: ApiDerroteroResponse = {
        status: 'succes',
        message: 'Se elimino correctamente el derrotero',
        id: Number(derrotero.id),
        nombre: derrotero.nombre,
        distancia: Number(derrotero.distanciaKm),
        estatus: 0,
      };

      return result;
    } catch (error) {
      // Registro en la bitácora SUCCESS
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Derroteros',
        `Se elimino derrotero con ID: ${id}`,
        'DELETE',
        querylogger,
        idUser,
        EnumModulos.RUTAS,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException({
        message: 'Error al eliminado total derroteros',
        error: error.message,
      });
    }
  }
}
