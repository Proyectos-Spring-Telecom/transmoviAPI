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
import { Clientes } from 'src/entities/Clientes';
import { CreatePasajeroAfiliacionDto } from './dto/create-pasajero-afiliacion.dto';
import * as bcrypt from 'bcrypt';
import { Usuarios } from 'src/entities/Usuarios';
import { UsuariosPermisos } from 'src/entities/UsuariosPermisos';
import {
  EnumModulos,
  EnumSolicitudPasajero,
  EstatusEnum,
} from 'src/common/estatus.enum';
import { Monederos } from 'src/entities/Monederos';

@Injectable()
export class PasajerosService {
  constructor(
    @InjectRepository(Pasajeros)
    private readonly pasajeroRepository: Repository<Pasajeros>,
    @InjectRepository(Clientes)
    private readonly clienteRepository: Repository<Clientes>,
    @InjectRepository(Usuarios)
    private readonly usuariosRepository: Repository<Usuarios>,
    @InjectRepository(UsuariosPermisos)
    private permisosRepository: Repository<UsuariosPermisos>,
    @InjectRepository(Monederos)
    private monederosRepository: Repository<Monederos>,
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
      const existUsuario = await this.usuariosRepository.findOne({
        //Buscamos si existe usuario
        where: { userName: createPasajeroDto.correo },
      });
      if (existUsuario) {
        throw new BadRequestException(
          `El usuario con el correo electrónico ${createPasajeroDto.correo} ya se encuentra registrado.`,
        );
      }

      //Buscamos el monedero que este dado de alta
      const monederos = await this.monederosRepository.findOne({
        where: {
          numeroSerie: createPasajeroDto.numeroSerieMonedero,
          estatus: 1,
        },
      });

      if (!monederos) {
        throw new BadRequestException(
          `El monedero con numero de serie ${createPasajeroDto.numeroSerieMonedero} no fue encontrado.`,
        );
      }

      if (monederos.idPasajero) {
        throw new BadRequestException(
          `El monedero con numero de serie ${createPasajeroDto.numeroSerieMonedero} esta ligado a un pasajero`,
        );
      }

      const hashedPassword = await bcrypt.hash(
        createPasajeroDto.passwordHash,
        10,
      ); //encriptamos la contraseña
      createPasajeroDto.passwordHash = hashedPassword;

      //Creamos el usuario
      const newUser = await this.usuariosRepository.create({
        userName: createPasajeroDto.correo,
        passwordHash: createPasajeroDto.passwordHash,
        emailConfirmado: EstatusEnum.ACTIVO,
        nombre: createPasajeroDto.nombre,
        apellidoPaterno: createPasajeroDto.apellidoPaterno,
        apellidoMaterno: createPasajeroDto.apellidoMaterno,
        telefono: createPasajeroDto.telefono,
        fotoPerfil:
          'https://transmovi.s3.us-east-2.amazonaws.com/imagenes/user_default.png',
        estatus: EstatusEnum.ACTIVO,
        idRol: 9,
        idCliente: monederos.idCliente,
      });
      const userSave = await this.usuariosRepository.save(newUser); //creamos el usuario

      //Le añadimos los permisos correspondientes
      const permisosIds = [77, 80, 90];
      if (permisosIds.length > 0) {
        const usuariosPermisos = permisosIds.map((permisoId) =>
          this.permisosRepository.create({
            idUsuario: userSave.id,
            idPermiso: permisoId,
          }),
        );

        //guardamos los permisos
        await this.permisosRepository.save(usuariosPermisos);
      }

      //Creamos el body para crear el pasajero
      const newPasajero = await this.pasajeroRepository.create({
        nombre: createPasajeroDto.nombre,
        apellidoPaterno: createPasajeroDto.apellidoPaterno,
        apellidoMaterno: createPasajeroDto.apellidoMaterno,
        fechaNacimiento: createPasajeroDto.fechaNacimiento,
        telefono: createPasajeroDto.telefono,
        correo: createPasajeroDto.correo,
        estatus: EstatusEnum.ACTIVO,
        estadoSolicitud: createPasajeroDto.estadoSolicitud,
        documentacion: createPasajeroDto.documentacion,
        curp: createPasajeroDto.curp,
      });
      const pasajeroSave = await this.pasajeroRepository.save(newPasajero);

      //afiliamos el monedero al pasajero y cambiamos estatus activo
      function pad(n: number) {
        return n < 10 ? '0' + n : n;
      }

      const ahora = new Date();
      const desfaseMs = -6 * 60 * 60 * 1000; // -6 horas en milisegundos
      const fechaDesfasada = new Date(ahora.getTime() + desfaseMs);

      const fechaActual = `${fechaDesfasada.getFullYear()}-${pad(fechaDesfasada.getMonth() + 1)}-${pad(fechaDesfasada.getDate())} ${pad(fechaDesfasada.getHours())}:${pad(fechaDesfasada.getMinutes())}:${pad(fechaDesfasada.getSeconds())}`;

      await this.monederosRepository.update(monederos.id, {
        idPasajero: pasajeroSave.id,
        fechaActivacion: fechaDesfasada,
        estatus: EstatusEnum.ACTIVO,
      });

      // --- Registro en la bitácora --- SUCCESS
      const queryloggerUpdate = {
        idPasajero: pasajeroSave.id,
        fechaActivacion: fechaDesfasada,
        estatus: EstatusEnum.ACTIVO,
      };
      await this.bitacoraLogger.logToBitacora(
        'Monederos',
        `Se actualizó el monedero con ID: ${monederos.id}.`,
        'UPDATE',
        queryloggerUpdate,
        idUser,
        EnumModulos.MONEDEROS,
        EstatusEnumBitcora.SUCCESS,
      );

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { createPasajeroDto };
      await this.bitacoraLogger.logToBitacora(
        'Pasajeros',
        `Se ha creado un pasajero con el nombre: ${createPasajeroDto.nombre}.`,
        'CREATE',
        querylogger,
        idUser,
        EnumModulos.PASAJEROS,
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
        EnumModulos.PASAJEROS,
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

  //Crear pasajero
  async createPasajerosAfiliacion(
    createPasajeroAfiliacionDto: CreatePasajeroAfiliacionDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const pasajero = await this.pasajeroRepository.findOne({
        where: {
          correo: createPasajeroAfiliacionDto.correo,
        },
      });
      if (pasajero) {
        throw new BadRequestException(
          `El pasajero con el correo electrónico ${createPasajeroAfiliacionDto.correo} ya se encuentra registrado.`,
        );
      }
      const newPasajero = await this.pasajeroRepository.create(
        createPasajeroAfiliacionDto,
      );
      const pasajeroSave = await this.pasajeroRepository.save(newPasajero);

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { createPasajeroAfiliacionDto };
      await this.bitacoraLogger.logToBitacora(
        'Pasajeros',
        `Se ha creado un pasajero con el nombre: ${createPasajeroAfiliacionDto.nombre}.`,
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
      const querylogger = { createPasajeroAfiliacionDto };
      await this.bitacoraLogger.logToBitacora(
        'Pasajeros',
        `Se ha creado un pasajero con el nombre: ${createPasajeroAfiliacionDto.nombre}.`,
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

  //Obtener todos los pasajeros
  async findAllPasajeros(
    cliente: number,
    rol: number,
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    try {
      let pasajeros;
      let totalResult;
      const offset = (page - 1) * limit;
      switch (rol) {
        case 1:
          pasajeros = await this.pasajeroRepository.query(
            `
SELECT DISTINCT
    p.Id AS id,
    p.Nombre AS nombre,
    p.ApellidoPaterno AS apellidoPaterno,
    p.ApellidoMaterno AS apellidoMaterno,
    p.FechaNacimiento AS fechaNacimiento,
    p.Telefono AS telefono,
    p.Correo AS correo,
    p.FechaCreacion AS fechaCreacion,
    p.FechaActualizacion AS fechaActualizacion,
    p.Estatus AS estatus,
    p.EstadoSolicitud AS estadoSolicitud,
    p.Documentacion AS documentacion,
    p.Curp AS curp,
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    m.Id AS idMonedero,
    m.NumeroSerie AS numeroSerie,
    ct.IdTipoPasajero AS idTipoPasajero,
    ct.Nombre AS nombreCatPasajero

FROM Pasajeros p
INNER JOIN Monederos m 
    ON p.Id = m.IdPasajero
INNER JOIN Clientes c 
    ON m.IdCliente = c.Id
LEFT JOIN CatPasajeros ct
    ON m.IdTipoPasajero = ct.IdTipoPasajero

ORDER BY p.Id DESC
  LIMIT ? OFFSET ?;
        `,
            [limit, offset],
          );

          // Query para total (sin paginación)
          totalResult = await this.pasajeroRepository.query(
            `
   SELECT COUNT(*) AS total
FROM Pasajeros p
INNER JOIN Monederos m 
    ON p.Id = m.IdPasajero
INNER JOIN Clientes c 
    ON m.IdCliente = c.Id
LEFT JOIN CatPasajeros ct
    ON m.IdTipoPasajero = ct.IdTipoPasajero
		
  `,
          );
          break;

        default:
          //Resto de usuarios
          const { ids, placeholders } = await this.clienteHijos(cliente);
          pasajeros = await this.pasajeroRepository.query(
            `
SELECT DISTINCT
    p.Id AS id,
    p.Nombre AS nombre,
    p.ApellidoPaterno AS apellidoPaterno,
    p.ApellidoMaterno AS apellidoMaterno,
    p.FechaNacimiento AS fechaNacimiento,
    p.Telefono AS telefono,
    p.Correo AS correo,
    p.FechaCreacion AS fechaCreacion,
    p.FechaActualizacion AS fechaActualizacion,
    p.Estatus AS estatus,
    p.EstadoSolicitud AS estadoSolicitud,
    p.Documentacion AS documentacion,
    p.Curp AS curp,
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    m.Id AS idMonedero,
    m.NumeroSerie AS numeroSerie,
    ct.IdTipoPasajero AS idTipoPasajero,
    ct.Nombre AS nombreCatPasajero

FROM Pasajeros p
INNER JOIN Monederos m 
    ON p.Id = m.IdPasajero
INNER JOIN Clientes c 
    ON m.IdCliente = c.Id
LEFT JOIN CatPasajeros ct
    ON m.IdTipoPasajero = ct.IdTipoPasajero

    
WHERE c.Id IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar
ORDER BY p.Id DESC
  LIMIT ? OFFSET ?;
        `,
            [...ids, limit, offset],
          );

          // Query para total (sin paginación)
          totalResult = await this.pasajeroRepository.query(
            `
   SELECT COUNT(*) AS total
FROM Pasajeros p
INNER JOIN Monederos m 
    ON p.Id = m.IdPasajero
INNER JOIN Clientes c 
    ON m.IdCliente = c.Id
LEFT JOIN CatPasajeros ct
    ON m.IdTipoPasajero = ct.IdTipoPasajero
	WHERE c.Id IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar
  `,
            [...ids],
          );
          break;
      }

      const total = Number(totalResult[0]?.total || 0);

      const result: ApiResponseCommon = {
        data: pasajeros,
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
  async findAllListPasajeros(
    cliente: number,
    rol: number,
  ): Promise<ApiResponseCommon> {
    try {
      let pasajeros;
      switch (rol) {
        case 1:
          //Resto de usuarios
          pasajeros = await this.pasajeroRepository.query(
            `
SELECT 
    p.Id AS id,
    p.Nombre AS nombre,
    p.ApellidoPaterno AS apellidoPaterno,
    p.ApellidoMaterno AS apellidoMaterno,
    p.FechaNacimiento AS fechaNacimiento,
    p.Telefono AS telefono,
    p.Correo AS correo,
    p.FechaCreacion AS fechaCreacion,
    p.FechaActualizacion AS fechaActualizacion,
    p.Estatus AS estatus,
    p.EstadoSolicitud AS estadoSolicitud,
    p.Documentacion AS documentacion,
    p.Curp AS curp,
    m.Id AS idMonedero,
    m.NumeroSerie AS numeroSerie,
    ct.IdTipoPasajero AS idTipoPasajero,
    ct.Nombre AS nombreCatPasajero

FROM Pasajeros p
LEFT JOIN Monederos m ON p.Id = m.IdPasajero
LEFT JOIN CatPasajeros ct
    ON m.IdTipoPasajero = ct.IdTipoPasajero
WHERE m.Id IS NOT NULL
ORDER BY p.Id DESC;

        `,
          );
          break;

        default:
          //Resto de usuarios
          const { ids, placeholders } = await this.clienteHijos(cliente);
          pasajeros = await this.pasajeroRepository.query(
            `
SELECT 
    p.Id AS id,
    p.Nombre AS nombre,
    p.ApellidoPaterno AS apellidoPaterno,
    p.ApellidoMaterno AS apellidoMaterno,
    p.FechaNacimiento AS fechaNacimiento,
    p.Telefono AS telefono,
    p.Correo AS correo,
    p.FechaCreacion AS fechaCreacion,
    p.FechaActualizacion AS fechaActualizacion,
    p.Estatus AS estatus,
    p.EstadoSolicitud AS estadoSolicitud,
    p.Documentacion AS documentacion,
    p.Curp AS curp,
    m.Id AS idMonedero,
    m.NumeroSerie AS numeroSerie,
    ct.IdTipoPasajero AS idTipoPasajero,
    ct.Nombre AS nombreCatPasajero
    
FROM Pasajeros p
LEFT JOIN Monederos m ON p.Id = m.IdPasajero
LEFT JOIN CatPasajeros ct
    ON m.IdTipoPasajero = ct.IdTipoPasajero
WHERE m.Id IS NOT NULL
AND c.Id IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar
ORDER BY p.Id DESC;
        `,
            [...ids],
          );
          break;
      }
      const result: ApiResponseCommon = {
        data: pasajeros,
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

  //ARREGLAR
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
          AND m2.Estatus = 1
        ORDER BY t.FechaHora DESC
        LIMIT 1
    ) AS UltimaRecarga,
    (
        SELECT t.FechaHora
        FROM Transacciones t
        INNER JOIN Monederos m2 ON t.NumeroSerieMonedero = m2.NumeroSerie
        WHERE m2.IdPasajero = p.Id
          AND t.TipoTransaccion = 'RECARGA'
          AND m2.Estatus = 1
        ORDER BY t.FechaHora DESC
        LIMIT 1
    ) AS FechaUltimaRecarga,
    (
        SELECT SUM(t2.Monto)
        FROM Transacciones t2
        INNER JOIN Monederos m3 ON t2.NumeroSerieMonedero = m3.NumeroSerie
        WHERE m3.IdPasajero = p.Id
          AND t2.TipoTransaccion = 'DEBITO'
          AND m3.Estatus = 1
          AND t2.FechaHora >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
    ) AS TotalDebitosUltimoMes,
    (
        SELECT t3.Monto
        FROM Transacciones t3
        INNER JOIN Monederos m4 ON t3.NumeroSerieMonedero = m4.NumeroSerie
        WHERE m4.IdPasajero = p.Id
          AND t3.TipoTransaccion = 'DEBITO'
          AND m4.Estatus = 1
        ORDER BY t3.FechaHora DESC
        LIMIT 1
    ) AS UltimoDebito,
    (
        SELECT t3.FechaHora
        FROM Transacciones t3
        INNER JOIN Monederos m4 ON t3.NumeroSerieMonedero = m4.NumeroSerie
        WHERE m4.IdPasajero = p.Id
          AND t3.TipoTransaccion = 'DEBITO'
          AND m4.Estatus = 1
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
        EnumModulos.PASAJEROS,
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
        EnumModulos.PASAJEROS,
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

  //Cambiar estadoSolicitud del pasajero
  async updatePasajeroEstadoSolicitud(
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
        EnumModulos.PASAJEROS,
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
        EnumModulos.PASAJEROS,
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
        EnumModulos.PASAJEROS,
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
        EnumModulos.PASAJEROS,
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
        EnumModulos.PASAJEROS,
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
        EnumModulos.PASAJEROS,
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
