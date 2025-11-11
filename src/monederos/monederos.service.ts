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
import { PasajerosService } from 'src/pasajeros/pasajeros.service';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import {
  EnumEstatusMonederos,
  EnumModulos,
  EnumSolicitudPasajero,
  EstatusEnum,
} from 'src/common/estatus.enum';
import { Clientes } from 'src/entities/Clientes';
import { UpdateMonederoCatPasajeroDto } from './dto/update-monedero-catpasajero.dto';
import { UpdateMonederoExtravioDto } from './dto/update-monedero-extravio.dto';

@Injectable()
export class MonederosService {
  constructor(
    @InjectRepository(Monederos)
    private readonly monederoRepository: Repository<Monederos>,
    @InjectRepository(Clientes)
    private readonly clienteRepository: Repository<Clientes>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly pasajerosService: PasajerosService,
  ) {}

  // ========================================
  // 🔹 CREAR UN MONEDERO
  // ========================================
  async createMonedero(
    createMonederoDto: CreateMonederoDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const monedero = await this.monederoRepository.findOne({
        where: { numeroSerie: createMonederoDto.numeroSerie },
      });
      if (monedero) {
        throw new NotFoundException(
          `El monedero con número de serie: ${createMonederoDto.numeroSerie} está registrado.`,
        );
      }

      //Agregamos la fecha actual
      function pad(n: number) {
        return n < 10 ? '0' + n : n;
      }

      const ahora = new Date();
      const desfaseMs = -6 * 60 * 60 * 1000; // -6 horas en milisegundos
      const fechaDesfasada = new Date(ahora.getTime() + desfaseMs);

      const fechaActual = `${fechaDesfasada.getFullYear()}-${pad(fechaDesfasada.getMonth() + 1)}-${pad(fechaDesfasada.getDate())} ${pad(fechaDesfasada.getHours())}:${pad(fechaDesfasada.getMinutes())}:${pad(fechaDesfasada.getSeconds())}`;

      //Añadimos fecha
      createMonederoDto.fechaActivacion = fechaActual;
      createMonederoDto.estatus = EnumEstatusMonederos.ACTIVO;

      //Guardamos el monedero
      const newMonedero =
        await this.monederoRepository.create(createMonederoDto);
      const monederoSave = await this.monederoRepository.save(newMonedero);

      // --- Registro en la bitácora --- SUCCESS
      const querylogger = { createMonederoDto };
      await this.bitacoraLogger.logToBitacora(
        'Monederos',
        `Se creó un monedero con número de serie: ${monederoSave.numeroSerie}.`,
        'CREATE',
        querylogger,
        idUser,
        EnumModulos.MONEDEROS,
        EstatusEnumBitcora.SUCCESS,
      );

      //API response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Monedero creado correctamente.',
        data: {
          id: Number(monederoSave.id),
          nombre: `${monederoSave.numeroSerie} ${monederoSave.saldo} ` || '',
        },
      };
      return result;
    } catch (error) {
      // -------------   ERROR -------------****-*-*
      // --- Registro en la bitácora --- ERROR
      const querylogger = { createMonederoDto };
      await this.bitacoraLogger.logToBitacora(
        'Monederos',
        `Se creó un monedero con número de serie: ${createMonederoDto.numeroSerie}.`,
        'CREATE',
        querylogger,
        idUser,
        EnumModulos.MONEDEROS,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Hubo un error al crear el monedero.',
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

  // ========================================
  // 🔹 OBTENER PAGINADO DE MONEDEROS
  // ========================================
  async findAllPagMonederos(
    idUser: number,
    email: string,
    cliente: number,
    rol: number,
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    try {
      const offset = (page - 1) * limit;
      let totalResult;
      let monederos;
      switch (rol) {
        case 1:
          monederos = await this.monederoRepository.query(
            `
SELECT 
    m.Id AS id,
    m.NumeroSerie AS numeroSerie,
    m.Saldo AS saldo,
    m.FechaActivacion AS fechaActivacion,
    m.FechaCreacion AS fechaCreacion,
    m.FechaActualizacion AS fechaActualizacion,
    m.Estatus AS estatus,
    m.IdPasajero AS idPasajero,
    m.IdCliente AS idCliente,

    p.Id AS idPasajeroMonederos,
    p.Nombre AS pasajeroNombre,
    p.ApellidoPaterno AS pasajeroApellidoPaterno,
    p.ApellidoMaterno AS pasajeroApellidoMaterno,
    CONCAT(p.Nombre, ' ', p.ApellidoPaterno, ' ', p.ApellidoMaterno) AS nombreCompletoPasajero,

    c.Id AS idClienteMonederos,
    c.Nombre AS clienteNombre,
    c.ApellidoPaterno AS clienteApellidoPaterno,
    c.ApellidoMaterno AS clienteApellidoMaterno,
    CONCAT(c.Nombre, ' ', c.ApellidoPaterno, ' ', c.ApellidoMaterno) AS nombreCompletoCliente

FROM Monederos m
LEFT JOIN Pasajeros p ON m.IdPasajero = p.Id
INNER JOIN Clientes c ON m.IdCliente = c.Id



ORDER BY m.Id DESC;

            `,
          );

          totalResult = await this.monederoRepository.query(
            `
  SELECT COUNT(*) AS total
FROM Monederos m
LEFT JOIN Pasajeros p ON m.IdPasajero = p.Id
INNER JOIN Clientes c ON m.IdCliente = c.Id


  `,
          );
          break;

        case 9:
          const pasajero =
            await this.pasajerosService.findOnePasajeroCorreo(email);
          monederos = await this.monederoRepository.query(
            `
SELECT 
    m.Id AS id,
    m.NumeroSerie AS numeroSerie,
    m.Saldo AS saldo,
    m.FechaActivacion AS fechaActivacion,
    m.FechaCreacion AS fechaCreacion,
    m.FechaActualizacion AS fechaActualizacion,
    m.Estatus AS estatus,
    m.IdPasajero AS idPasajero,
    m.IdCliente AS idCliente,

    p.Id AS idPasajeroMonederos,
    p.Nombre AS pasajeroNombre,
    p.ApellidoPaterno AS pasajeroApellidoPaterno,
    p.ApellidoMaterno AS pasajeroApellidoMaterno,
    CONCAT(p.Nombre, ' ', p.ApellidoPaterno, ' ', p.ApellidoMaterno) AS nombreCompletoPasajero,

    c.Id AS idClienteMonederos,
    c.Nombre AS clienteNombre,
    c.ApellidoPaterno AS clienteApellidoPaterno,
    c.ApellidoMaterno AS clienteApellidoMaterno,
    CONCAT(c.Nombre, ' ', c.ApellidoPaterno, ' ', c.ApellidoMaterno) AS nombreCompletoCliente

FROM Monederos m
LEFT JOIN Pasajeros p ON m.IdPasajero = p.Id
INNER JOIN Clientes c ON m.IdCliente = c.Id

WHERE p.Id = ?
AND m.Estatus = 1

ORDER BY m.Id DESC;

            `,
            [pasajero.id],
          );

          totalResult = await this.monederoRepository.query(
            `
  SELECT COUNT(*) AS total
FROM Monederos m
LEFT JOIN Pasajeros p ON m.IdPasajero = p.Id
INNER JOIN Clientes c ON m.IdCliente = c.Id

WHERE p.Id = ?
AND m.Estatus = 1
  `,
            [pasajero.id],
          );
          break;

        default:
          const { ids, placeholders } = await this.clienteHijos(cliente);
          monederos = await this.monederoRepository.query(
            `
SELECT 
    m.Id AS id,
    m.NumeroSerie AS numeroSerie,
    m.Saldo AS saldo,
    m.FechaActivacion AS fechaActivacion,
    m.FechaCreacion AS fechaCreacion,
    m.FechaActualizacion AS fechaActualizacion,
    m.Estatus AS estatus,
    m.IdPasajero AS idPasajero,
    m.IdCliente AS idCliente,

    p.Id AS idPasajeroMonederos,
    p.Nombre AS pasajeroNombre,
    p.ApellidoPaterno AS pasajeroApellidoPaterno,
    p.ApellidoMaterno AS pasajeroApellidoMaterno,
    CONCAT(p.Nombre, ' ', p.ApellidoPaterno, ' ', p.ApellidoMaterno) AS nombreCompletoPasajero,

    c.Id AS idClienteMonederos,
    c.Nombre AS clienteNombre,
    c.ApellidoPaterno AS clienteApellidoPaterno,
    c.ApellidoMaterno AS clienteApellidoMaterno,
    CONCAT(c.Nombre, ' ', c.ApellidoPaterno, ' ', c.ApellidoMaterno) AS nombreCompletoCliente

FROM Monederos m
LEFT JOIN Pasajeros p ON m.IdPasajero = p.Id
INNER JOIN Clientes c ON m.IdCliente = c.Id

WHERE c.Id IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar

ORDER BY m.Id DESC;

            `,
            [...ids],
          );

          totalResult = await this.monederoRepository.query(
            `
  SELECT COUNT(*) AS total
FROM Monederos m
LEFT JOIN Pasajeros p ON m.IdPasajero = p.Id
INNER JOIN Clientes c ON m.IdCliente = c.Id
WHERE c.Id IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar

  `,
            [...ids],
          );
          break;
      }

      const data = monederos.map((item) => ({
        ...item,
        id: Number(item.id),
        saldo: Number(item.saldo),
        idPasajero: Number(item.idPasajero),
        idCliente: Number(item.idCliente),
        idPasajeroMonedero: Number(item.idPasajeroMonederos),
        idClienteMonedero: Number(item.idClienteMonedero),
      }));

      const total = Number(totalResult[0]?.total || 0);

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
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Hubo un error al obtener el listado de monederos.',
      );
    }
  }

  //Obtener todos los monederos paginado //no sirve
  async findAllMonederos(
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    try {
      const monederos = await this.monederoRepository.find();
      if (monederos.length === 0) {
        throw new NotFoundException('No se encontraron monederos.');
      }
      const [data, total] = await this.monederoRepository.findAndCount({
        relations: [],
        skip: (page - 1) * limit,
        take: limit,
        order: {
          id: 'DESC',
        },
      });

      //Cambiamos los datos numericos a number
      const monederoResult = data.map((item) => ({
        ...item,
        id: Number(item.id),
        saldo: Number(item.saldo),
        idPasajero: Number(item.idPasajero),
        idCliente: Number(item.idCliente),
      }));

      const result: ApiResponseCommon = {
        data: monederoResult,
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
        'Hubo un error al obtener los monederos paginados.',
      );
    }
  }

  // ========================================
  // 🔹 OBTENER LISTADO DE MONEDEROS
  // ========================================
  async findAllListMonederos(
    idUser: number,
    email: string,
    cliente: number,
    rol: number,
  ): Promise<ApiResponseCommon> {
    try {
      let monederos;
      switch (rol) {
        case 1:
          monederos = await this.monederoRepository.query(
            `
SELECT 
    m.Id AS id,
    m.NumeroSerie AS numeroSerie,
    m.Saldo AS saldo,
    m.FechaActivacion AS fechaActivacion,
    m.FechaCreacion AS fechaCreacion,
    m.FechaActualizacion AS fechaActualizacion,
    m.Estatus AS estatusMonedero,

    p.Id AS idPasajero,
    p.Nombre AS pasajeroNombre,
    p.ApellidoPaterno AS pasajeroApellidoPaterno,
    p.ApellidoMaterno AS pasajeroApellidoMaterno,
    CONCAT(p.Nombre, ' ', p.ApellidoPaterno, ' ', p.ApellidoMaterno) AS nombreCompletoPasajero,

    c.Id AS idCliente,
    c.Nombre AS clienteNombre,
    c.ApellidoPaterno AS clienteApellidoPaterno,
    c.ApellidoMaterno AS clienteApellidoMaterno,
    CONCAT(c.Nombre, ' ', c.ApellidoPaterno, ' ', c.ApellidoMaterno) AS nombreCompletoCliente

FROM Monederos m
LEFT JOIN Pasajeros p ON m.IdPasajero = p.Id
INNER JOIN Clientes c ON m.IdCliente = c.Id

WHERE m.Estatus = 1 -- estatus activo
AND c.Estatus = 1

ORDER BY m.Id DESC;

            `,
          );
          break;

        case 9:
          const pasajero =
            await this.pasajerosService.findOnePasajeroCorreo(email);
          monederos = await this.monederoRepository.query(
            `
SELECT 
    m.Id AS id,
    m.NumeroSerie AS numeroSerie,
    m.Saldo AS saldo,
    m.FechaActivacion AS fechaActivacion,
    m.FechaCreacion AS fechaCreacion,
    m.FechaActualizacion AS fechaActualizacion,
    m.Estatus AS estatusMonedero,

    p.Id AS idPasajero,
    p.Nombre AS pasajeroNombre,
    p.ApellidoPaterno AS pasajeroApellidoPaterno,
    p.ApellidoMaterno AS pasajeroApellidoMaterno,
    CONCAT(p.Nombre, ' ', p.ApellidoPaterno, ' ', p.ApellidoMaterno) AS nombreCompletoPasajero,

    c.Id AS idCliente,
    c.Nombre AS clienteNombre,
    c.ApellidoPaterno AS clienteApellidoPaterno,
    c.ApellidoMaterno AS clienteApellidoMaterno,
    CONCAT(c.Nombre, ' ', c.ApellidoPaterno, ' ', c.ApellidoMaterno) AS nombreCompletoCliente

FROM Monederos m
LEFT JOIN Pasajeros p ON m.IdPasajero = p.Id
INNER JOIN Clientes c ON m.IdCliente = c.Id

WHERE m.Estatus = 1 -- estatus activo
AND c.Estatus = 1
AND p.Id = ?

ORDER BY m.Id DESC;

            `,
            [pasajero.id],
          );
          break;

        default:
          const { ids, placeholders } = await this.clienteHijos(cliente);
          monederos = await this.monederoRepository.query(
            `
SELECT 
    m.Id AS id,
    m.NumeroSerie AS numeroSerie,
    m.Saldo AS saldo,
    m.FechaActivacion AS fechaActivacion,
    m.FechaCreacion AS fechaCreacion,
    m.FechaActualizacion AS fechaActualizacion,
    m.Estatus AS estatusMonedero,

    p.Id AS idPasajero,
    p.Nombre AS pasajeroNombre,
    p.ApellidoPaterno AS pasajeroApellidoPaterno,
    p.ApellidoMaterno AS pasajeroApellidoMaterno,
    CONCAT(p.Nombre, ' ', p.ApellidoPaterno, ' ', p.ApellidoMaterno) AS nombreCompletoPasajero,

    c.Id AS idCliente,
    c.Nombre AS clienteNombre,
    c.ApellidoPaterno AS clienteApellidoPaterno,
    c.ApellidoMaterno AS clienteApellidoMaterno,
    CONCAT(c.Nombre, ' ', c.ApellidoPaterno, ' ', c.ApellidoMaterno) AS nombreCompletoCliente

FROM Monederos m
LEFT JOIN Pasajeros p ON m.IdPasajero = p.Id
INNER JOIN Clientes c ON m.IdCliente = c.Id

WHERE c.Id IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar
AND m.Estatus = 1 -- estatus activo
AND c.Estatus = 1

ORDER BY m.Id DESC;

            `,
            [...ids],
          );
          break;
      }

      const data = monederos.map((item) => ({
        ...item,
        id: Number(item.id),
        saldo: Number(item.saldo),
        idPasajero: Number(item.idPasajero),
        idCliente: Number(item.idCliente),
      }));

      //Api response
      const result: ApiResponseCommon = {
        data: data,
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Hubo un error al obtener el listado de monederos.',
      );
    }
  }

  // ========================================
  // 🔹 OBTENER UN MONEDERO POR ID
  // ========================================
  async findOneMonedero(id: number) {
    try {
      const monedero = await this.monederoRepository.findOne({
        where: { id: id },
      });
      if (!monedero) {
        throw new NotFoundException(
          `El monedero con ID: ${id} no fue encontrado.`,
        );
      }

      //Cambiamos los datos numericos a number
      const monederoResult = {
        ...monedero,
        id: Number(monedero.id),
        saldo: Number(monedero.saldo),
        idPasajero: Number(monedero.idPasajero),
        idCliente: Number(monedero.idCliente),
      };
      return { data: monederoResult };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Hubo un error al obtener el monedero.',
      );
    }
  }

  // ========================================
  // 🔹 OBTENER MONEDERO POR NUMERO DE SERIE
  // ========================================
  async findOneMonederoBySerie(NumeroSerie: string) {
    try {
      const monedero = await this.monederoRepository.findOne({
        where: { numeroSerie: NumeroSerie },
      });
      if (!monedero) {
        throw new NotFoundException(
          `El monedero con número de serie: ${NumeroSerie} no fue encontrado.`,
        );
      }
      //Cambiamos los datos numericos a number
      const monederoResult = {
        ...monedero,
        id: Number(monedero.id),
        saldo: Number(monedero.saldo),
        idPasajero: Number(monedero.idPasajero),
        idCliente: Number(monedero.idCliente),
      };
      return { data: monederoResult };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Hubo un error al obtener el monedero por número de serie.',
      );
    }
  }

  // ========================================
  // 🔹 CAMBIAR ESTATUS DEL MONEDERO
  // ========================================
  async updateMonederoEstatus(
    id: number,
    idUser: number,
    updateMonederoEstatusDto: UpdateMonederoEstatusDto,
  ) {
    try {
      const monedero = await this.monederoRepository.findOne({
        where: { id: id },
      });
      if (!monedero) {
        throw new NotFoundException(
          `El monedero con ID: ${id} no fue encontrado.`,
        );
      }

      //Actualizamos estatus
      const { estatus } = updateMonederoEstatusDto;
      await this.monederoRepository.update(id, { estatus: estatus });

      // --- Registro en la bitácora --- SUCCESS
      const querylogger = { updateMonederoEstatusDto };
      await this.bitacoraLogger.logToBitacora(
        'Monederos',
        `Se actualizó el estatus del monedero con ID: ${id} a ${estatus}.`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.MONEDEROS,
        EstatusEnumBitcora.SUCCESS,
      );

      //API response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'El estatus del monedero se actualizó correctamente.',
        estatus: { estatus: estatus },
        data: {
          id: Number(monedero.id),
          nombre: `${monedero.numeroSerie} ${monedero.saldo} ` || '',
        },
      };

      return result;
    } catch (error) {
      // --- Registro en la bitácora --- ERROR
      const querylogger = { updateMonederoEstatusDto };
      await this.bitacoraLogger.logToBitacora(
        'Monederos',
        `Se actualizó el estatus del monedero con ID: ${id} a ${updateMonederoEstatusDto.estatus}.`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.MONEDEROS,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error.message;
      }
      throw new InternalServerErrorException(
        'Hubo un error al actualizar el estatus del monedero.',
      );
    }
  }

  // ========================================
  // 🔹 ACTUALIZAR TIPO DE PASJERO EN EL MONEDERO
  // ========================================
  async updateMonederoTipoPasajero(
    id: number,
    idUser: number,
    updateMonederoCatPasajeroDto: UpdateMonederoCatPasajeroDto,
  ) {
    try {
      //Buscamos y validamos que exista el monedero
      const monedero = await this.monederoRepository.findOne({
        where: { id: id },
      });
      if (!monedero) {
        throw new NotFoundException(
          `El monedero con número de ID: ${id} no fue encontrado.`,
        );
      }

      //extraemos la variable a actualizar
      const { idTipoPasajero } = updateMonederoCatPasajeroDto;

      //Actualizamos los datos
      await this.monederoRepository.update(id, {
        idTipoPasajero: idTipoPasajero,
      });

      // --- Registro en la bitácora --- SUCCESS
      const querylogger = { updateMonederoCatPasajeroDto };
      await this.bitacoraLogger.logToBitacora(
        'Monederos',
        `Se actualizó el tipo de pasajero del monedero con ID: ${id} a ${updateMonederoCatPasajeroDto.idTipoPasajero}.`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.MONEDEROS,
        EstatusEnumBitcora.SUCCESS,
      );

      //Si el monedero esta asociado a un pasajero se debe actualizar su estado de solicitud
      if (monedero.idPasajero) {
        //Actualizamos el estado de la solicitud
        const idPasajero = Number(monedero.idPasajero);
        const bodyPasajero = {
          estadoSolicitud: EnumSolicitudPasajero.APROVADO,
        };
        await this.pasajerosService.updatePasajero(
          idPasajero,
          idUser,
          bodyPasajero,
        );
      }

      //API response
      const result: ApiCrudResponse = {
        status: 'success',
        message: `Se actualizó el tipo de pasajero del monedero con ID: ${id} correctamente.`,
        data: {
          id: Number(monedero.id),
          nombre: `${monedero.numeroSerie} ` || '',
        },
      };

      return result;
    } catch (error) {
      // --- Registro en la bitácora --- SUCCESS
      const querylogger = { updateMonederoCatPasajeroDto };
      await this.bitacoraLogger.logToBitacora(
        'Monederos',
        `Se actualizó el tipo de pasajero del monedero con ID: ${id} a ${updateMonederoCatPasajeroDto.idTipoPasajero}.`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.MONEDEROS,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Hubo un error al actualizar el tipo de pasajero del monedero.',
      );
    }
  }

  // ========================================
  // 🔹 ACTUALIZAR SALDO DEL MONEDERO
  // ========================================
  async updateMonederoSaldo(
    numeroSerie: string,
    idUser: number,
    saldo: number,
  ) {
    try {
      const monedero = await this.monederoRepository.findOne({
        where: { numeroSerie: numeroSerie },
      });
      if (!monedero) {
        throw new NotFoundException(
          `El monedero con número de serie: ${numeroSerie} no fue encontrado.`,
        );
      }
      const id = Number(monedero.id);

      //Actualizamos saldo
      await this.monederoRepository.update(id, { saldo: saldo });

      // --- Registro en la bitácora --- SUCCESS
      const querylogger = { numeroSerie: numeroSerie, saldo: saldo };
      await this.bitacoraLogger.logToBitacora(
        'Monederos',
        `Se actualizó el saldo del monedero con ID: ${id}.`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.MONEDEROS,
        EstatusEnumBitcora.SUCCESS,
      );

      //API response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'El saldo del monedero se actualizó correctamente.',
        data: {
          id: id,
          nombre: `${monedero.numeroSerie} ${monedero.saldo} ` || '',
        },
      };
      return result;
    } catch (error) {
      // --- Registro en la bitácora --- ERROR
      const querylogger = { numeroSerie: numeroSerie, saldo: saldo };
      await this.bitacoraLogger.logToBitacora(
        'Monederos',
        `Se actualizó el saldo del monedero con número de serie: ${numeroSerie}`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.MONEDEROS,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al crear ruta',
        error: error.message,
      });
    }
  }

  // ========================================
  // 🔹 ACTUALIZAR MONEDERO
  // ========================================
  async updateMonedero(
    id: number,
    idUser: number,
    updateMonederoDto: UpdateMonederoDto,
  ) {
    try {
      const monedero = await this.monederoRepository.findOne({
        where: { id: id },
      });
      if (!monedero) {
        throw new NotFoundException(
          `El monedero con ID: ${id} no fue encontrado.`,
        );
      }

      //Actualizamos monedero
      const monederoData =
        await this.monederoRepository.create(updateMonederoDto);
      await this.monederoRepository.update(id, monederoData);

      // --- Registro en la bitácora --- SUCCESS
      const querylogger = { updateMonederoDto };
      await this.bitacoraLogger.logToBitacora(
        'Monederos',
        `Se actualizó el monedero con ID: ${id}.`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.MONEDEROS,
        EstatusEnumBitcora.SUCCESS,
      );

      //API response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Monedero actualizado correctamente.',
        data: {
          id: id,
          nombre: `${monedero.numeroSerie} ${monedero.saldo} ` || '',
        },
      };
      return result;
    } catch (error) {
      // --- Registro en la bitácora --- ERROR
      const querylogger = { updateMonederoDto };
      await this.bitacoraLogger.logToBitacora(
        'Monederos',
        `Se actualizó el monedero con ID: ${id}.`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.MONEDEROS,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al actualizar monedero',
        error: error.message,
      });
    }
  }

  // ========================================
  // 🔹 ELIMINADO LOGICO DE MONEDERO
  // ========================================
  async removeMonedero(id: number, idUser: number) {
    try {
      const monedero = await this.monederoRepository.findOne({
        where: { id: id },
      });
      if (!monedero) {
        throw new NotFoundException(
          `El monedero con ID: ${id} no fue encontrado.`,
        );
      }

      //Eliminamos de manera logica
      await this.monederoRepository.update(id, {
        estatus: EstatusEnum.INACTIVO,
      });

      // --- Registro en la bitácora --- SUCCESS
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Monederos',
        `Se eliminó el monedero con ID: ${id}.`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.MONEDEROS,
        EstatusEnumBitcora.SUCCESS,
      );

      //API response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Monedero eliminado correctamente.',
        data: {
          id: id,
          nombre: `${monedero.numeroSerie} ${monedero.saldo} ` || '',
        },
      };
      return result;
    } catch (error) {
      // --- Registro en la bitácora --- ERROR
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Monederos',
        `Se eliminó el monedero con ID: ${id}.`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.MONEDEROS,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Hubo un error al eliminar el monedero.',
      );
    }
  }

  async reportarExtravio(
    idUser: number,
    updateMonederoExtravioDto: UpdateMonederoExtravioDto,
  ) {
    try {
      const { correo, numeroSerie } = updateMonederoExtravioDto;
      //Buscamos el pasajero por correo y validamos que exista
      const pasajero =
        await this.pasajerosService.findOnePasajeroCorreo(correo);
      if (!pasajero) {
        throw new NotFoundException(
          `El pasajero con correo: ${correo} no fue encontrado.`,
        );
      }

      //Buscamos monedero asociado al pasajero
      const monedero = await this.monederoRepository.findOne({
        where: { idPasajero: pasajero.id },
      });
      if (!monedero) {
        throw new NotFoundException(
          `No se encontro un monedero asociado al pasajero con ID: ${pasajero.id}`,
        );
      }

      //Buscamos el nuevo monedero
      const nuevoMonedero = await this.monederoRepository.findOne({
        where: { numeroSerie: numeroSerie },
      });
      if (!nuevoMonedero) {
        throw new NotFoundException(
          `No se encontro un monedero asociado al pasajero con ID: ${pasajero.id}`,
        );
      }
      //Agregamos la fecha actual
      function pad(n: number) {
        return n < 10 ? '0' + n : n;
      }

      const ahora = new Date();
      const desfaseMs = -6 * 60 * 60 * 1000; // -6 horas en milisegundos
      const fechaDesfasada = new Date(ahora.getTime() + desfaseMs);

      const fechaActual = `${fechaDesfasada.getFullYear()}-${pad(fechaDesfasada.getMonth() + 1)}-${pad(fechaDesfasada.getDate())} ${pad(fechaDesfasada.getHours())}:${pad(fechaDesfasada.getMinutes())}:${pad(fechaDesfasada.getSeconds())}`;

      //Actualizamos los datos del monedero extraviado al nuevo monedero
      nuevoMonedero.saldo = monedero.saldo;
      nuevoMonedero.fechaActivacion = fechaDesfasada;
      nuevoMonedero.idPasajero = monedero.idPasajero;
      nuevoMonedero.idCliente = monedero.idCliente;
      nuevoMonedero.idTipoPasajero = monedero.idTipoPasajero;
      nuevoMonedero.estatus = EnumEstatusMonederos.ACTIVO;

      await this.monederoRepository.update(nuevoMonedero.id, nuevoMonedero);

      await this.monederoRepository.update(monedero.id,{estatus: EnumEstatusMonederos.EXTRAVIADO, idPasajero: null})

      // --- Registro en la bitácora --- SUCCESS
      const querylogger = { nuevoMonedero };
      await this.bitacoraLogger.logToBitacora(
        'Monederos',
        `Se realizo baja del monedero con numero de serie: ${monedero.numeroSerie} y se añadio el nuevo monedero con numero de serie: ${nuevoMonedero.numeroSerie}.`,
        'DELETE',
        querylogger,
        idUser,
        EnumModulos.MONEDEROS,
      );

      //API response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Monedero recuperado de manera correcta correctamente.',
        data: {
          id: Number(nuevoMonedero.id),
          nombre: `${nuevoMonedero.numeroSerie} ${nuevoMonedero.saldo} ` || '',
        },
      };
      return result;
    } catch (error) {
      // --- Registro en la bitácora --- SUCCESS
      const querylogger = { updateMonederoExtravioDto };
      await this.bitacoraLogger.logToBitacora(
        'Monederos',
        `Se realizo baja del monedero y se registro el nuevo con numero de serie: ${updateMonederoExtravioDto.numeroSerie}.`,
        'DELETE',
        querylogger,
        idUser,
        EnumModulos.MONEDEROS,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Hubo un error al intentar generar el reportar el extravio del monedero.',
      );
    }
  }
}
