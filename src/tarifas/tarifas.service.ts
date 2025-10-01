import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateTarifaDto } from './dto/create-tarifa.dto';
import { UpdateTarifaDto } from './dto/update-tarifa.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Tarifas } from 'src/entities/Tarifas';
import { Repository } from 'typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { Derroteros } from 'src/entities/Derroteros';
import { UsuariosRegiones } from 'src/entities/UsuariosRegiones';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { UpdateTarifasEstatusDto } from './dto/update-tarifa-estatus.dto';

@Injectable()
export class TarifasService {
  constructor(
    @InjectRepository(Tarifas)
    private readonly tarifasRepository: Repository<Tarifas>,
    @InjectRepository(Derroteros)
    private readonly derroterosRepository: Repository<Derroteros>,
    @InjectRepository(UsuariosRegiones)
    private readonly usuariosregionesRepository: Repository<UsuariosRegiones>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}
  async create(
    idUser: number,
    cliente: number,
    rol: number,
    createTarifaDto: CreateTarifaDto,
  ): Promise<ApiCrudResponse> {
    try {
      let derrotero;
      switch (rol) {
        case 1:
          derrotero = await this.derroterosRepository.findOne({
            where: { id: createTarifaDto.idDerrotero },
          });
          if (!derrotero)
            throw new NotFoundException(`Derrotero no encontrado`);
          break;

        case 2:
          derrotero = await this.derroterosRepository.findOne({
            where: { id: createTarifaDto.idDerrotero },
          });
          if (!derrotero)
            throw new NotFoundException(`Derrotero no encontrado`);
          break;

        default:
          derrotero = await this.derroterosRepository.findOne({
            where: { id: createTarifaDto.idDerrotero },
          });
          if (!derrotero)
            throw new NotFoundException(`Derrotero no encontrado`);
          break;
      }

      const newTarifas = this.tarifasRepository.create(createTarifaDto);
      const tarifaSave = await this.tarifasRepository.save(newTarifas);

      // Registro en la bitácora SUCCESS
      await this.bitacoraLogger.logToBitacora(
        'Regiones',
        `Se creó una Tarifa con Id: ${tarifaSave.id}`,
        'CREATE',
        `${createTarifaDto}`,
        idUser,
        19,
        EstatusEnumBitcora.SUCCESS,
      );

      // API response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Region creada correctamente', // ✅ Corregido
        data: {
          id: Number(tarifaSave.id),
          nombre: `Tarifa con Id: ${tarifaSave.id} tarifaBase:${tarifaSave.tarifaBase}`, // ✅ Mejorado
        },
      };
      return result;
    } catch (error) {
      // Registro en la bitácora ERROR
      await this.bitacoraLogger.logToBitacora(
        'Regiones',
        `Se creó una Tarifa con IdDerrotero: ${createTarifaDto.idDerrotero}`,
        'CREATE',
        `${createTarifaDto}`,
        idUser,
        19,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException({
        message: 'Error al crear Tarifa',
        error: error.message,
      });
    }
  }

  async findAllList(idUser: number, cliente: number, rol: number) {
    try {
      let data;
      switch (rol) {
        case 1:
          // Usuario SuperAdministrador - obtiene todas las regiones
          data = await this.usuariosregionesRepository.query(
            `
SELECT 
  -- Datos de la tarifa
  t.Id AS id,
  t.TarifaBase,
  t.DistanciaBaseKm,
  t.IncrementoCadaMetros,
  t.CostoAdicional,
  t.FechaCreacion AS fechaCreacionTarifa,
  t.FechaActualizacion AS fechaActualizacionTarifa,
  t.Estatus AS estatusTarifa,

  -- Datos del derrotero
  d.Id AS idDerrotero,
  d.Nombre AS nombreDerrotero,
  d.PuntoInicio AS puntoInicio,
  d.PuntoFin AS puntoFin,
  d.DistanciaKm AS distanciaKm,

  -- Datos de la ruta
  ru.Id AS idRuta,
  ru.Nombre AS nombreRuta,
  ru.NombreInicio,
  ru.NombreFin,

  -- Región de inicio (la importante para filtro del usuario)
  r.Id AS idRegionInicio,
  r.Nombre AS nombreRegionInicio,

  -- Región de fin
  rf.Id AS idRegionFin,
  rf.Nombre AS nombreRegionFin,

  -- Cliente
  c.Id AS idCliente,
  CONCAT(c.Nombre, ' ', c.ApellidoPaterno, ' ', c.ApellidoMaterno) AS nombreCompletoCliente

FROM Tarifas t
INNER JOIN Derroteros d ON t.IdDerrotero = d.Id
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
  AND t.Estatus = 1

ORDER BY t.Id DESC;
      `,
            [idUser], // parámetro seguro
          );
          break;

        case 2:
          // Usuario Administrador - obtiene todas las regiones
          data = await this.usuariosregionesRepository.query(
            `
SELECT 
  -- Datos de la tarifa
  t.Id AS id,
  t.TarifaBase,
  t.DistanciaBaseKm,
  t.IncrementoCadaMetros,
  t.CostoAdicional,
  t.FechaCreacion AS fechaCreacionTarifa,
  t.FechaActualizacion AS fechaActualizacionTarifa,
  t.Estatus AS estatusTarifa,

  -- Datos del derrotero
  d.Id AS idDerrotero,
  d.Nombre AS nombreDerrotero,
  d.PuntoInicio AS puntoInicio,
  d.PuntoFin AS puntoFin,
  d.DistanciaKm AS distanciaKm,

  -- Datos de la ruta
  ru.Id AS idRuta,
  ru.Nombre AS nombreRuta,
  ru.NombreInicio,
  ru.NombreFin,

  -- Región de inicio (la importante para filtro del usuario)
  r.Id AS idRegionInicio,
  r.Nombre AS nombreRegionInicio,

  -- Región de fin
  rf.Id AS idRegionFin,
  rf.Nombre AS nombreRegionFin,

  -- Cliente
  c.Id AS idCliente,
  CONCAT(c.Nombre, ' ', c.ApellidoPaterno, ' ', c.ApellidoMaterno) AS nombreCompletoCliente

FROM Tarifas t
INNER JOIN Derroteros d ON t.IdDerrotero = d.Id
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
  AND t.Estatus = 1
  AND c.Id = ?  -- Filtro por cliente específico

ORDER BY t.Id DESC;
      `,
            [idUser, cliente], // parámetro seguro
          );
          break;

        default:
          // Usuarios normales - solo sus regiones asignadas
          data = await this.usuariosregionesRepository.query(
            `
SELECT 
  -- Datos de la tarifa
  t.Id AS id,
  t.TarifaBase,
  t.DistanciaBaseKm,
  t.IncrementoCadaMetros,
  t.CostoAdicional,
  t.FechaCreacion AS fechaCreacionTarifa,
  t.FechaActualizacion AS fechaActualizacionTarifa,
  t.Estatus AS estatusTarifa,

  -- Datos del derrotero
  d.Id AS idDerrotero,
  d.Nombre AS nombreDerrotero,
  d.PuntoInicio AS puntoInicio,
  d.PuntoFin AS puntoFin,
  d.DistanciaKm AS distanciaKm,

  -- Datos de la ruta
  ru.Id AS idRuta,
  ru.Nombre AS nombreRuta,
  ru.NombreInicio,
  ru.NombreFin,

  -- Región de inicio (la importante para filtro del usuario)
  r.Id AS idRegionInicio,
  r.Nombre AS nombreRegionInicio,

  -- Región de fin
  rf.Id AS idRegionFin,
  rf.Nombre AS nombreRegionFin,

  -- Cliente
  c.Id AS idCliente,
  CONCAT(c.Nombre, ' ', c.ApellidoPaterno, ' ', c.ApellidoMaterno) AS nombreCompletoCliente

FROM Tarifas t
INNER JOIN Derroteros d ON t.IdDerrotero = d.Id
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
  AND t.Estatus = 1
  AND c.Id = ?  -- Filtro por cliente específico

ORDER BY t.Id DESC;
      `,
            [idUser, cliente], // parámetro seguro
          );
          break;
      }

      if (data.length === 0) {
        throw new NotFoundException('No se encontraron derroteros activos');
      }

      const tarifas = data.map((item) => ({
        ...item,
        id: Number(item.id),
        TarifaBase: Number(item.TarifaBase),
        DistanciaBaseKm: Number(item.DistanciaBaseKm),
        CostoAdicional: Number(item.CostoAdicional),
        distanciaKm: Number(item.distanciaKm),
        idDerrotero: Number(item.idDerrotero),
        idRuta: Number(item.idRuta),
        idRegionInicio: item.idRegionInicio
          ? Number(item.idRegionInicio)
          : null,
        idRegionFin: item.idRegionFin ? Number(item.idRegionFin) : null,
        idCliente: Number(item.idCliente),
      }));

      // Transformación de resultados
      const result: ApiResponseCommon = {
        data: tarifas,
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtner un listado Tarifas',
        error: error.message,
      });
    }
  }

  async findAll(
    idUser: number,
    cliente: number,
    rol: number,
    page: number,
    limit: number,
  ) {
    try {
      const offset = (page - 1) * limit;
      let data;
      let totalResult;
      data = await this.usuariosregionesRepository.query(
        `
SELECT 
  -- Datos de la tarifa
  t.Id AS id,
  t.TarifaBase,
  t.DistanciaBaseKm,
  t.IncrementoCadaMetros,
  t.CostoAdicional,
  t.FechaCreacion AS fechaCreacionTarifa,
  t.FechaActualizacion AS fechaActualizacionTarifa,
  t.Estatus AS estatusTarifa,

  -- Datos del derrotero
  d.Id AS idDerrotero,
  d.Nombre AS nombreDerrotero,
  d.PuntoInicio AS puntoInicio,
  d.PuntoFin AS puntoFin,
  d.DistanciaKm AS distanciaKm,

  -- Datos de la ruta
  ru.Id AS idRuta,
  ru.Nombre AS nombreRuta,
  ru.NombreInicio,
  ru.NombreFin,

  -- Región de inicio (la importante para filtro del usuario)
  r.Id AS idRegionInicio,
  r.Nombre AS nombreRegionInicio,

  -- Región de fin
  rf.Id AS idRegionFin,
  rf.Nombre AS nombreRegionFin,

  -- Cliente
  c.Id AS idCliente,
  CONCAT(c.Nombre, ' ', c.ApellidoPaterno, ' ', c.ApellidoMaterno) AS nombreCompletoCliente

FROM Tarifas t
INNER JOIN Derroteros d ON t.IdDerrotero = d.Id
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
  AND t.Estatus = 1
  AND c.Id = ?  -- Filtro por cliente específico

ORDER BY t.Id DESC
  LIMIT ? OFFSET ?
  `,
        [idUser, cliente, limit, offset],
      );

      // Query para total (sin paginación)
      totalResult = await this.usuariosregionesRepository.query(
        `
SELECT COUNT(*) AS total
FROM Tarifas t
INNER JOIN Derroteros d ON t.IdDerrotero = d.Id
INNER JOIN Rutas ru ON d.IdRuta = ru.Id
INNER JOIN Regiones r ON ru.IdRegion = r.Id
INNER JOIN UsuariosRegiones ur ON ur.IdRegion = r.Id
WHERE ur.IdUsuario = ?
  AND ur.Estatus = 1         -- Relación usuario-región activa
  AND r.Estatus = 1          -- Región activa
  AND ru.Estatus = 1         -- Ruta activa
  AND d.Estatus = 1          -- Derrotero activo
  AND t.Estatus = 1          -- Tarifa activa
  AND r.IdCliente = ?;       -- Cliente específico
  `,
        [idUser, cliente],
      );
      const total = Number(totalResult[0]?.total ?? 0);
      // Transformación de resultados
      const result: ApiResponseCommon = {
        data: data,
        paginated: {
          total,
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
        message: 'Error al obtner un paginado Tarifas',
        error: error.message,
      });
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} tarifa`;
  }

  async updateEstatus(
    id: number,
    idUser: number,
    updateTarifasEstatusDto: UpdateTarifasEstatusDto,
  ): Promise<ApiCrudResponse> {
    try {
      const tarifa = await this.tarifasRepository.findOne({
        where: { id: id },
      });
      if (!tarifa) throw new NotFoundException(`Tarifa no encontrado`);

      //actualizacion de estatus
      const estatus = updateTarifasEstatusDto.estatus;
      await this.tarifasRepository.update(id, { estatus: estatus });

      // Registro en la bitácora SUCCESS
      await this.bitacoraLogger.logToBitacora(
        'Regiones',
        `Se actualizo el estatus: ${estatus} de una Tarifa con Id: ${tarifa.id}`,
        'UPDATE',
        `UPDATE FROM Tarifas SET Estatus = ${updateTarifasEstatusDto.estatus} WHERE Id = ${id}`,
        idUser,
        19,
        EstatusEnumBitcora.SUCCESS,
      );

      // API response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Tarifa estatus actualizado correctamente',
        estatus: { estatus: estatus },
        data: {
          id: id,
          nombre: `Tarifa con Id: ${id} tarifaBase:${tarifa.tarifaBase}`,
        },
      };
      return result;
    } catch (error) {
      // Registro en la bitácora Error
      await this.bitacoraLogger.logToBitacora(
        'Regiones',
        `Se actualizo el estatus: ${updateTarifasEstatusDto.estatus} de una Tarifa con Id: ${id}`,
        'UPDATE',
        `UPDATE FROM Tarifas SET Estatus = ${updateTarifasEstatusDto.estatus} WHERE Id = ${id}`,
        idUser,
        19,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al actualizar estatus de una tarifa',
        error: error.message,
      });
    }
  }

  async update(id: number, idUser: number, updateTarifaDto: UpdateTarifaDto) {
    try {
      const tarifa = await this.tarifasRepository.findOne({
        where: { id: id },
      });
      if (!tarifa) throw new NotFoundException(`Tarifa no encontrado`);

      //actualizacion de tarifa
      await this.tarifasRepository.update(id, updateTarifaDto);

      // Registro en la bitácora SUCCESS
      await this.bitacoraLogger.logToBitacora(
        'Regiones',
        `Se actualizo una Tarifa con Id: ${tarifa.id}`,
        'UPDATE',
        `${updateTarifaDto}`,
        idUser,
        19,
        EstatusEnumBitcora.SUCCESS,
      );

      // API response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Tarifa actualizado correctamente',
        data: {
          id: id,
          nombre: `Tarifa con Id: ${id} tarifaBase:${tarifa.tarifaBase}`,
        },
      };
      return result;
    } catch (error) {
      // Registro en la bitácora Error
      await this.bitacoraLogger.logToBitacora(
        'Regiones',
        `Se actualizo una Tarifa con Id: ${id}`,
        'UPDATE',
        `${updateTarifaDto}`,
        idUser,
        19,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al actualizar una tarifa',
        error: error.message,
      });
    }
  }

  async remove(id: number, idUser: number) {
    try {
      const tarifa = await this.tarifasRepository.findOne({
        where: { id: id },
      });
      if (!tarifa) throw new NotFoundException(`Tarifa no encontrado`);

      //eliminado logico de estatus
      await this.tarifasRepository.update(id, { estatus: 0 });

      // Registro en la bitácora SUCCESS
      await this.bitacoraLogger.logToBitacora(
        'Regiones',
        `Se actualizo el estatus: ${0} de una Tarifa con Id: ${tarifa.id}`,
        'UPDATE',
        `UPDATE FROM Tarifas SET Estatus = ${0} WHERE Id = ${id}`,
        idUser,
        19,
        EstatusEnumBitcora.SUCCESS,
      );

      // API response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Tarifa eliminado correctamente correctamente',
        data: {
          id: id,
          nombre: `Tarifa con Id: ${id} tarifaBase:${tarifa.tarifaBase}`,
        },
      };
      return result;
    } catch (error) {
      // Registro en la bitácora Error
      await this.bitacoraLogger.logToBitacora(
        'Regiones',
        `Se actualizo el estatus: ${0} de una Tarifa con Id: ${id}`,
        'UPDATE',
        `UPDATE FROM Tarifas SET Estatus = ${0} WHERE Id = ${id}`,
        idUser,
        19,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al eliminado logico de una tarifa',
        error: error.message,
      });
    }
  }
}
