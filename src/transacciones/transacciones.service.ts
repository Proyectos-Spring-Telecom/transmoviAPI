import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateTransaccioneRecargaDto } from './dto/create-transaccione-recarga.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransaccionesRecarga } from 'src/entities/TransaccionesRecarga';
import { TransaccionesDebito } from 'src/entities/TransaccionesDebito';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { Dispositivos } from 'src/entities/Dispositivos';
import { MonederosService } from 'src/monederos/monederos.service';
import { PasajerosService } from 'src/pasajeros/pasajeros.service';
import { Clientes } from 'src/entities/Clientes';
import { CreateTransaccioneDebitoDto } from './dto/create-transaccione-debito.dto';
import {
  EnumModulos,
  EnumTipoTransaccion,
} from 'src/common/estatus.enum';
import { 
  transicionarEstado, 
  EstadoTransaccion, 
  EventoTransaccion 
} from '../utils/transaccion.util';

@Injectable()
export class TransaccionesService {
  constructor(
    @InjectRepository(TransaccionesRecarga)
    private readonly transaccionesrecargaRepository: Repository<TransaccionesRecarga>,
    @InjectRepository(TransaccionesDebito)
    private readonly transaccionesdebitoRepository: Repository<TransaccionesDebito>,
    @InjectRepository(Dispositivos)
    private readonly dispositivoRepository: Repository<Dispositivos>,
    @InjectRepository(Clientes)
    private readonly clienteRepository: Repository<Clientes>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly monederosService: MonederosService,
    private readonly pasajeroService: PasajerosService,
  ) {}

  //Funcion para transaccion Recarga
  async createTransaccionRecarga(
    createTransaccioneRecargaDto: CreateTransaccioneRecargaDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      //Buscamos el monedero
      const monedero = await this.monederosService.findOneMonederoBySerie(
        createTransaccioneRecargaDto.numeroSerieMonedero,
      );

      //Declaramos transaccion y creamos la variable montoFinal
      let transaccion = createTransaccioneRecargaDto.idTipoTransaccion;
      let montoFinal: number = 0;

      //Checamos el tipo transaccion
      montoFinal =
        Number(monedero.data.saldo) +
        Number(createTransaccioneRecargaDto.monto);

      console.log(
        'Saldo Inicial: ',
        monedero.data.saldo,
        ' Tipo Transaccion: ',
        transaccion,
        ' Monto: ',
        createTransaccioneRecargaDto.monto,
        ' Monto Final: ',
        montoFinal,
      );

      //actualizamos el saldo del monedero
      await this.monederosService.updateMonederoSaldo(
        createTransaccioneRecargaDto.numeroSerieMonedero,
        idUser,
        montoFinal,
      );

      //Creamos la transaccion en la BD
      const newTransaccion = await this.transaccionesrecargaRepository.create(
        createTransaccioneRecargaDto,
      );
      const transaccionSave =
        await this.transaccionesrecargaRepository.save(newTransaccion);

      // --- Registro en la bitácora --- SUCCESS
      const querylogger = { createTransaccioneRecargaDto };
      await this.bitacoraLogger.logToBitacora(
        'Transacciones',
        `Se realizo una transaccion de tipo ${transaccion}`,
        'CREATE',
        querylogger,
        idUser,
        EnumModulos.TRANSACCIONES,
        EstatusEnumBitcora.SUCCESS,
      );

      //API response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Transaccion creado correctamente',
        data: {
          id: Number(transaccionSave.id),
          nombre:
            `${createTransaccioneRecargaDto.numeroSerieMonedero} ${montoFinal} ` ||
            '',
        },
      };
      return result;
    } catch (error) {
      console.log(error);
      // --- Registro en la bitácora --- ERROR
      const querylogger = { createTransaccioneRecargaDto };
      await this.bitacoraLogger.logToBitacora(
        'Transacciones',
        `Se realizo una transaccion de tipo ${createTransaccioneRecargaDto.idTipoTransaccion}`,
        'CREATE',
        querylogger,
        idUser,
        EnumModulos.TRANSACCIONES,
        EstatusEnumBitcora.ERROR,
        error.message,
      );

      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error generar la transaccion de tipo ${createTransaccioneRecargaDto.idTipoTransaccion}`,
      );
    }
  }


  async createTransaccionDebitoPrueba(
  createTransaccioneDebitoDto: CreateTransaccioneDebitoDto,
  idUser: number,
): Promise<ApiCrudResponse> {
  let estado: EstadoTransaccion = EstadoTransaccion.INICIADA;

  try {
    // 1️⃣ Cambiamos estado a VALIDANDO_SALDO
    estado = transicionarEstado(estado, EventoTransaccion.CREAR);

    // 2️⃣ Buscamos el monedero
    const monedero = await this.monederosService.findOneMonederoBySerie(
      createTransaccioneDebitoDto.numeroSerieMonedero,
    );

    if (!monedero?.data) {
      estado = EstadoTransaccion.ERROR;
      throw new BadRequestException('Monedero no encontrado');
    }

    // 3️⃣ Calculamos monto final (aquí se pueden aplicar descuentos si existen)
    let montoFinal = Number(monedero.data.saldo) - Number(createTransaccioneDebitoDto.monto);

    // 4️⃣ Validación de saldo
    if (montoFinal < 0) {
      estado = transicionarEstado(estado, EventoTransaccion.SALDO_INSUFICIENTE);
      createTransaccioneDebitoDto.idTipoTransaccion = EnumTipoTransaccion.RECHAZO;

      // Guardar transacción rechazada
      const newTransaccion = this.transaccionesdebitoRepository.create(createTransaccioneDebitoDto);
      await this.transaccionesdebitoRepository.save(newTransaccion);

      // Registrar en bitácora
      await this.bitacoraLogger.logToBitacora(
        'Transacciones',
        `Transacción de débito RECHAZADA por saldo insuficiente`,
        'CREATE',
        { createTransaccioneDebitoDto },
        idUser,
        EnumModulos.TRANSACCIONES,
        EstatusEnumBitcora.ERROR,
        'Saldo insuficiente',
      );

      throw new BadRequestException('Saldo insuficiente');
    }

    // 5️⃣ Si saldo OK, actualizamos el monedero y estado
    estado = transicionarEstado(estado, EventoTransaccion.SALDO_OK);
    await this.monederosService.updateMonederoSaldo(
      createTransaccioneDebitoDto.numeroSerieMonedero,
      idUser,
      montoFinal,
    );

    // 6️⃣ Guardamos transacción aprobada
    const newTransaccion = this.transaccionesdebitoRepository.create(createTransaccioneDebitoDto);
    const transaccionSave = await this.transaccionesdebitoRepository.save(newTransaccion);

    // 7️⃣ Bitácora de éxito
    await this.bitacoraLogger.logToBitacora(
      'Transacciones',
      `Transacción de débito APROBADA`,
      'CREATE',
      { createTransaccioneDebitoDto },
      idUser,
      EnumModulos.TRANSACCIONES,
      EstatusEnumBitcora.SUCCESS,
    );

    // 8️⃣ Finalizamos la transacción
    estado = transicionarEstado(estado, EventoTransaccion.FINALIZAR);

    return {
      status: 'success',
      message: 'Transacción creada correctamente',
      data: {
        id: Number(transaccionSave.id),
        nombre: '',
      },
    };
  } catch (error) {
    estado = EstadoTransaccion.ERROR;

    // Bitácora de error
    await this.bitacoraLogger.logToBitacora(
      'Transacciones',
      `Error en transacción de débito`,
      'CREATE',
      { createTransaccioneDebitoDto },
      idUser,
      EnumModulos.TRANSACCIONES,
      EstatusEnumBitcora.ERROR,
      error.message,
    );

    if (error instanceof HttpException) throw error;

    throw new InternalServerErrorException(
      `Error al generar la transacción de débito`,
    );
  }
}

  //Funcion para transaccion Debito
  async createTransaccionDebito(
    createTransaccioneDebitoDto: CreateTransaccioneDebitoDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      //Buscamos el monedero
      const monedero = await this.monederosService.findOneMonederoBySerie(
        createTransaccioneDebitoDto.numeroSerieMonedero,
      );

      //Declaramos transaccion y creamos la variable montoFinal
      let transaccion = createTransaccioneDebitoDto.idTipoTransaccion;
      let montoFinal: number = 0;

      //Checamos el tipo transaccion
      montoFinal =
        Number(monedero.data.saldo) - Number(createTransaccioneDebitoDto.monto);
      console.log(
        'Saldo Inicial: ',
        monedero.data.saldo,
        ' Tipo Transaccion: ',
        transaccion,
        ' Monto: ',
        createTransaccioneDebitoDto.monto,
        ' Monto Final: ',
        montoFinal,
      );

      //Pasamos un filtro que no haya valores negativos
      if (montoFinal < 0) {
        //Creamos la transaccion en la BD
        const newTransaccion = await this.transaccionesdebitoRepository.create(
          createTransaccioneDebitoDto,
        );
        createTransaccioneDebitoDto.idTipoTransaccion =
          EnumTipoTransaccion.RECHAZO;
        await this.transaccionesdebitoRepository.save(newTransaccion);
        throw new BadRequestException('Saldo insuficiente');
      }

      //actualizamos el saldo del monedero
      await this.monederosService.updateMonederoSaldo(
        createTransaccioneDebitoDto.numeroSerieMonedero,
        idUser,
        montoFinal,
      );

      //Creamos la transaccion en la BD
      const newTransaccion = await this.transaccionesdebitoRepository.create(
        createTransaccioneDebitoDto,
      );
      const transaccionSave =
        await this.transaccionesdebitoRepository.save(newTransaccion);

      // --- Registro en la bitácora --- SUCCESS
      const querylogger = { createTransaccioneDebitoDto };
      await this.bitacoraLogger.logToBitacora(
        'Transacciones',
        `Se realizo una transaccion de tipo ${transaccion}`,
        'CREATE',
        querylogger,
        idUser,
        EnumModulos.TRANSACCIONES,
        EstatusEnumBitcora.SUCCESS,
      );

      //API response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Transaccion creado correctamente',
        data: {
          id: Number(transaccionSave.id),
          nombre:
            `${createTransaccioneDebitoDto.numeroSerieMonedero} ${montoFinal} ` ||
            '',
        },
      };
      return result;
    } catch (error) {
      // --- Registro en la bitácora --- ERROR
      const querylogger = { createTransaccioneDebitoDto };
      await this.bitacoraLogger.logToBitacora(
        'Transacciones',
        `Se realizo una transaccion de tipo ${createTransaccioneDebitoDto.idTipoTransaccion}`,
        'CREATE',
        querylogger,
        idUser,
        EnumModulos.TRANSACCIONES,
        EstatusEnumBitcora.ERROR,
        error.message,
      );

      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error generar la transaccion de tipo ${createTransaccioneDebitoDto.idTipoTransaccion}`,
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

  async findAllTransacciones(
    idUser: number,
    email: string,
    cliente: number,
    rol: number,
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    try {
      let totalResult;
      let transacciones;
      const offset = (page - 1) * limit;
      switch (rol) {
        case 1:
          transacciones = await this.transaccionesrecargaRepository.query(
            `
SELECT 
    'DEBITO' AS origenTabla,        -- 👈 de qué tabla viene
    td.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- 👈 tipo según el catálogo (RECARGA, DEBITO o RECHAZADO)
    td.Monto AS monto,
    td.Latitud AS latitud,
    td.Longitud AS longitud,
    td.FechaHora AS fechaHora,
    td.FHRegistro AS fhRegistro,
    td.NumeroSerieMonedero AS numeroSerieMonedero,
    td.NumeroSerieDispositivo AS numeroSerieDispositivo,
    td.ControlTransaccion AS controlTransaccion,

    -- Datos del dispositivo
    d.Marca AS marcaDispositivo,
    d.Modelo AS modeloDispositivo,

    -- Pasajero (vía Monedero)
    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero

FROM TransaccionesDebito td
INNER JOIN CatTiposTransacciones ctt 
    ON td.IdTipoTransaccion = ctt.Id
LEFT JOIN Dispositivos d 
    ON td.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Monederos m 
    ON td.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id

UNION ALL

SELECT 
    'RECARGA' AS origenTabla,       -- 👈 solo indica de qué tabla proviene
    tr.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- 👈 valor real del tipo
    tr.Monto AS monto,
    tr.Latitud AS latitud,
    tr.Longitud AS longitud,
    tr.FechaHora AS fechaHora,
    tr.FHRegistro AS fhRegistro,
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieDispositivo AS numeroSerieDispositivo,
    tr.ControlTransaccion AS controlTransaccion,

    d.Marca AS marcaDispositivo,
    d.Modelo AS modeloDispositivo,

    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero

FROM TransaccionesRecarga tr
INNER JOIN CatTiposTransacciones ctt 
    ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN Dispositivos d 
    ON tr.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id

ORDER BY FHRegistro DESC
  LIMIT ? OFFSET ?;
        `,
            [limit, offset],
          );

          // Query para total (sin paginación)
          totalResult = await this.transaccionesrecargaRepository.query(
            `
SELECT COUNT(*) AS total
FROM (
    SELECT td.Id
    FROM TransaccionesDebito td
    INNER JOIN CatTiposTransacciones ctt 
        ON td.IdTipoTransaccion = ctt.Id
    LEFT JOIN Dispositivos d 
        ON td.NumeroSerieDispositivo = d.NumeroSerie
    INNER JOIN Monederos m 
        ON td.NumeroSerieMonedero = m.NumeroSerie
    LEFT JOIN Pasajeros p 
        ON m.IdPasajero = p.Id

    UNION ALL

    SELECT tr.Id
    FROM TransaccionesRecarga tr
    INNER JOIN CatTiposTransacciones ctt 
        ON tr.IdTipoTransaccion = ctt.Id
    LEFT JOIN Dispositivos d 
        ON tr.NumeroSerieDispositivo = d.NumeroSerie
    INNER JOIN Monederos m 
        ON tr.NumeroSerieMonedero = m.NumeroSerie
    LEFT JOIN Pasajeros p 
        ON m.IdPasajero = p.Id
) AS todas;
		
  `,
          );
          break;

        case 9:
          //Datos por usuario
          const pasajero =
            await this.pasajeroService.findOnePasajeroCorreo(email);
          transacciones = await this.transaccionesrecargaRepository.query(
            `
(
  SELECT 
      'DEBITO' AS origenTabla,        
      td.Id AS id,
      ctt.Nombre AS tipoTransaccion,
      td.Monto AS monto,
      td.Latitud AS latitud,
      td.Longitud AS longitud,
      td.FechaHora AS fechaHora,
      td.FHRegistro AS fhRegistro,
      td.NumeroSerieMonedero AS numeroSerieMonedero,
      td.NumeroSerieDispositivo AS numeroSerieDispositivo,
      td.ControlTransaccion AS controlTransaccion,

      d.Marca AS marcaDispositivo,
      d.Modelo AS modeloDispositivo,

      p.Id AS idPasajero,
      p.Nombre AS nombrePasajero,
      p.ApellidoPaterno AS apellidoPaternoPasajero,
      p.ApellidoMaterno AS apellidoMaternoPasajero

  FROM TransaccionesDebito td
  INNER JOIN CatTiposTransacciones ctt ON td.IdTipoTransaccion = ctt.Id
  LEFT JOIN Dispositivos d ON td.NumeroSerieDispositivo = d.NumeroSerie
  INNER JOIN Monederos m ON td.NumeroSerieMonedero = m.NumeroSerie
  INNER JOIN Pasajeros p ON m.IdPasajero = p.Id
  WHERE p.Id = ?

  UNION ALL

  SELECT 
      'RECARGA' AS origenTabla,
      tr.Id AS id,
      ctt.Nombre AS tipoTransaccion,
      tr.Monto AS monto,
      tr.Latitud AS latitud,
      tr.Longitud AS longitud,
      tr.FechaHora AS fechaHora,
      tr.FHRegistro AS fhRegistro,
      tr.NumeroSerieMonedero AS numeroSerieMonedero,
      tr.NumeroSerieDispositivo AS numeroSerieDispositivo,
      tr.ControlTransaccion AS controlTransaccion,

      d.Marca AS marcaDispositivo,
      d.Modelo AS modeloDispositivo,

      p.Id AS idPasajero,
      p.Nombre AS nombrePasajero,
      p.ApellidoPaterno AS apellidoPaternoPasajero,
      p.ApellidoMaterno AS apellidoMaternoPasajero

  FROM TransaccionesRecarga tr
  INNER JOIN CatTiposTransacciones ctt ON tr.IdTipoTransaccion = ctt.Id
  LEFT JOIN Dispositivos d ON tr.NumeroSerieDispositivo = d.NumeroSerie
  INNER JOIN Monederos m ON tr.NumeroSerieMonedero = m.NumeroSerie
  INNER JOIN Pasajeros p ON m.IdPasajero = p.Id
  WHERE p.Id = ?
)
ORDER BY FHRegistro DESC
LIMIT ? OFFSET ?;

        `,
            [Number(pasajero.id), Number(pasajero.id), limit, offset],
          );

          // Query para total (sin paginación)
          totalResult = await this.transaccionesrecargaRepository.query(
            `
SELECT COUNT(*) AS total
FROM (
    SELECT td.Id
    FROM TransaccionesDebito td
    INNER JOIN CatTiposTransacciones ctt ON td.IdTipoTransaccion = ctt.Id
    INNER JOIN Monederos m ON td.NumeroSerieMonedero = m.NumeroSerie
    INNER JOIN Pasajeros p ON m.IdPasajero = p.Id
    WHERE p.Id = ?  -- 👈 pasajero específico

    UNION ALL

    SELECT tr.Id
    FROM TransaccionesRecarga tr
    INNER JOIN CatTiposTransacciones ctt ON tr.IdTipoTransaccion = ctt.Id
    INNER JOIN Monederos m ON tr.NumeroSerieMonedero = m.NumeroSerie
    INNER JOIN Pasajeros p ON m.IdPasajero = p.Id
    WHERE p.Id = ?  -- 👈 mismo pasajero
) AS transacciones_pasajero;

  `,
            [Number(pasajero.id), Number(pasajero.id)], // <-- Aquí debe ir como segundo argumento de query()
          );

          break;

        default:
          const { ids, placeholders } = await this.clienteHijos(cliente);
          transacciones = await this.transaccionesrecargaRepository.query(
            `
(
  SELECT 
      'DEBITO' AS origenTabla,
      td.Id AS id,
      ctt.Nombre AS tipoTransaccion,
      td.Monto AS monto,
      td.Latitud AS latitud,
      td.Longitud AS longitud,
      td.FechaHora AS fechaHora,
      td.FHRegistro AS fhRegistro,
      td.NumeroSerieMonedero AS numeroSerieMonedero,
      td.NumeroSerieDispositivo AS numeroSerieDispositivo,
      td.ControlTransaccion AS controlTransaccion,

      d.Marca AS marcaDispositivo,
      d.Modelo AS modeloDispositivo,

      p.Id AS idPasajero,
      p.Nombre AS nombrePasajero,
      p.ApellidoPaterno AS apellidoPaternoPasajero,
      p.ApellidoMaterno AS apellidoMaternoPasajero

  FROM TransaccionesDebito td
  INNER JOIN CatTiposTransacciones ctt 
      ON td.IdTipoTransaccion = ctt.Id
  LEFT JOIN Dispositivos d 
      ON td.NumeroSerieDispositivo = d.NumeroSerie
  INNER JOIN Monederos m 
      ON td.NumeroSerieMonedero = m.NumeroSerie
  LEFT JOIN Pasajeros p 
      ON m.IdPasajero = p.Id
  WHERE m.IdCliente IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar

  UNION ALL

  SELECT 
      'RECARGA' AS origenTabla,
      tr.Id AS id,
      ctt.Nombre AS tipoTransaccion,
      tr.Monto AS monto,
      tr.Latitud AS latitud,
      tr.Longitud AS longitud,
      tr.FechaHora AS fechaHora,
      tr.FHRegistro AS fhRegistro,
      tr.NumeroSerieMonedero AS numeroSerieMonedero,
      tr.NumeroSerieDispositivo AS numeroSerieDispositivo,
      tr.ControlTransaccion AS controlTransaccion,

      d.Marca AS marcaDispositivo,
      d.Modelo AS modeloDispositivo,

      p.Id AS idPasajero,
      p.Nombre AS nombrePasajero,
      p.ApellidoPaterno AS apellidoPaternoPasajero,
      p.ApellidoMaterno AS apellidoMaternoPasajero

  FROM TransaccionesRecarga tr
  INNER JOIN CatTiposTransacciones ctt 
      ON tr.IdTipoTransaccion = ctt.Id
  LEFT JOIN Dispositivos d 
      ON tr.NumeroSerieDispositivo = d.NumeroSerie
  INNER JOIN Monederos m 
      ON tr.NumeroSerieMonedero = m.NumeroSerie
  LEFT JOIN Pasajeros p 
      ON m.IdPasajero = p.Id
  WHERE m.IdCliente IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar
)
ORDER BY FHRegistro DESC
LIMIT ? OFFSET ?;

        `,
            [...ids, ...ids, limit, offset],
          );

          // Query para total (sin paginación)
          totalResult = await this.transaccionesrecargaRepository.query(
            `
SELECT COUNT(*) AS total
FROM (
  SELECT td.Id
  FROM TransaccionesDebito td
  INNER JOIN Monederos m ON td.NumeroSerieMonedero = m.NumeroSerie
  WHERE m.IdCliente IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar

  UNION ALL

  SELECT tr.Id
  FROM TransaccionesRecarga tr
  INNER JOIN Monederos m ON tr.NumeroSerieMonedero = m.NumeroSerie
  WHERE m.IdCliente IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar
) AS todas;

  `,
            [...ids, ...ids],
          );
          break;
      }

      const total = Number(totalResult[0]?.total || 0);

      // 🔥 Transformación de datos (ids → number, nombreCompleto)
      const data = transacciones.map((item) => ({
        ...item,
        id: Number(item.id),
        monto: Number(item.monto),
        latitud: Number(item.latitud),
        longitud: Number(item.longitud),
        idPasajero: Number(item.idPasajero),
      }));

      //API Response
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
      throw new BadRequestException({
        message: 'Error al obtener transacciones',
      });
    }
  }

  async findAllListTransacciones(
    cliente: number,
    rol: number,
  ): Promise<ApiResponseCommon> {
    try {
      let transacciones;
      switch (rol) {
        case 1:
          transacciones = await this.transaccionesrecargaRepository.query(
            `
SELECT 
    'DEBITO' AS origenTabla,        -- 👈 de qué tabla viene
    td.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- 👈 tipo según el catálogo (RECARGA, DEBITO o RECHAZADO)
    td.Monto AS monto,
    td.Latitud AS latitud,
    td.Longitud AS longitud,
    td.FechaHora AS fechaHora,
    td.FHRegistro AS fhRegistro,
    td.NumeroSerieMonedero AS numeroSerieMonedero,
    td.NumeroSerieDispositivo AS numeroSerieDispositivo,
    td.ControlTransaccion AS controlTransaccion,

    -- Datos del dispositivo
    d.Marca AS marcaDispositivo,
    d.Modelo AS modeloDispositivo,

    -- Pasajero (vía Monedero)
    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero

FROM TransaccionesDebito td
INNER JOIN CatTiposTransacciones ctt 
    ON td.IdTipoTransaccion = ctt.Id
LEFT JOIN Dispositivos d 
    ON td.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Monederos m 
    ON td.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id

UNION ALL

SELECT 
    'RECARGA' AS origenTabla,       -- 👈 solo indica de qué tabla proviene
    tr.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- 👈 valor real del tipo
    tr.Monto AS monto,
    tr.Latitud AS latitud,
    tr.Longitud AS longitud,
    tr.FechaHora AS fechaHora,
    tr.FHRegistro AS fhRegistro,
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieDispositivo AS numeroSerieDispositivo,
    tr.ControlTransaccion AS controlTransaccion,

    d.Marca AS marcaDispositivo,
    d.Modelo AS modeloDispositivo,

    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero

FROM TransaccionesRecarga tr
INNER JOIN CatTiposTransacciones ctt 
    ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN Dispositivos d 
    ON tr.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id

ORDER BY FHRegistro DESC
        `,
          );
          break;

        default:
          const { ids, placeholders } = await this.clienteHijos(cliente);
          transacciones = await this.transaccionesrecargaRepository.query(
            `
(
  SELECT 
      'DEBITO' AS origenTabla,
      td.Id AS id,
      ctt.Nombre AS tipoTransaccion,
      td.Monto AS monto,
      td.Latitud AS latitud,
      td.Longitud AS longitud,
      td.FechaHora AS fechaHora,
      td.FHRegistro AS fhRegistro,
      td.NumeroSerieMonedero AS numeroSerieMonedero,
      td.NumeroSerieDispositivo AS numeroSerieDispositivo,
      td.ControlTransaccion AS controlTransaccion,

      d.Marca AS marcaDispositivo,
      d.Modelo AS modeloDispositivo,

      p.Id AS idPasajero,
      p.Nombre AS nombrePasajero,
      p.ApellidoPaterno AS apellidoPaternoPasajero,
      p.ApellidoMaterno AS apellidoMaternoPasajero

  FROM TransaccionesDebito td
  INNER JOIN CatTiposTransacciones ctt 
      ON td.IdTipoTransaccion = ctt.Id
  LEFT JOIN Dispositivos d 
      ON td.NumeroSerieDispositivo = d.NumeroSerie
  INNER JOIN Monederos m 
      ON td.NumeroSerieMonedero = m.NumeroSerie
  LEFT JOIN Pasajeros p 
      ON m.IdPasajero = p.Id
  WHERE m.IdCliente IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar

  UNION ALL

  SELECT 
      'RECARGA' AS origenTabla,
      tr.Id AS id,
      ctt.Nombre AS tipoTransaccion,
      tr.Monto AS monto,
      tr.Latitud AS latitud,
      tr.Longitud AS longitud,
      tr.FechaHora AS fechaHora,
      tr.FHRegistro AS fhRegistro,
      tr.NumeroSerieMonedero AS numeroSerieMonedero,
      tr.NumeroSerieDispositivo AS numeroSerieDispositivo,
      tr.ControlTransaccion AS controlTransaccion,

      d.Marca AS marcaDispositivo,
      d.Modelo AS modeloDispositivo,

      p.Id AS idPasajero,
      p.Nombre AS nombrePasajero,
      p.ApellidoPaterno AS apellidoPaternoPasajero,
      p.ApellidoMaterno AS apellidoMaternoPasajero

  FROM TransaccionesRecarga tr
  INNER JOIN CatTiposTransacciones ctt 
      ON tr.IdTipoTransaccion = ctt.Id
  LEFT JOIN Dispositivos d 
      ON tr.NumeroSerieDispositivo = d.NumeroSerie
  INNER JOIN Monederos m 
      ON tr.NumeroSerieMonedero = m.NumeroSerie
  LEFT JOIN Pasajeros p 
      ON m.IdPasajero = p.Id
  WHERE m.IdCliente IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar
)
ORDER BY FHRegistro DESC

        `,
            [...ids, ...ids],
          );
          break;
      }

      // 🔥 Transformación de datos (ids → number, nombreCompleto)
      const data = transacciones.map((item) => ({
        ...item,
        id: Number(item.id),
        monto: Number(item.monto),
        latitud: Number(item.latitud),
        longitud: Number(item.longitud),
        idPasajero: Number(item.idPasajero),
        idMonedero: Number(item.idMonedero),
        idCliente: Number(item.idCliente),
      }));

      //API Response
      const result: ApiResponseCommon = {
        data: data,
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({
        message: 'Error al obtener transacciones',
      });
    }
  }

  async findOneTransaccionRecarga(id: number) {
    try {
      let transacciones;

      transacciones = await this.transaccionesrecargaRepository.query(
        `
SELECT 
    'RECARGA' AS origenTabla,       -- 👈 solo indica de qué tabla proviene
    tr.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- 👈 valor real del tipo
    tr.Monto AS monto,
    tr.Latitud AS latitud,
    tr.Longitud AS longitud,
    tr.FechaHora AS fechaHora,
    tr.FHRegistro AS fhRegistro,
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieDispositivo AS numeroSerieDispositivo,
    tr.ControlTransaccion AS controlTransaccion,

    d.Marca AS marcaDispositivo,
    d.Modelo AS modeloDispositivo,

    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero

FROM TransaccionesRecarga tr
INNER JOIN CatTiposTransacciones ctt 
    ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN Dispositivos d 
    ON tr.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
    WHERE tr.Id = ?

        `,
        [id],
      );

      if (!transacciones)
        throw new NotFoundException('Transaccion no encontradas');

      // 🔥 Transformación de datos (ids → number, nombreCompleto)
      const data = transacciones.map((item) => ({
        ...item,
        id: Number(item.id),
        monto: Number(item.monto),
        latitud: Number(item.latitud),
        longitud: Number(item.longitud),
        idPasajero: Number(item.idPasajero),
      }));
      return { data: data };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({
        message: 'Error al obtener transacciones',
      });
    }
  }

  async findOneTransaccionDebito(id: number) {
    try {
      let transacciones;

      transacciones = await this.transaccionesrecargaRepository.query(
        `
SELECT 
    'DEBITO' AS origenTabla,        -- 👈 de qué tabla viene
    td.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- 👈 tipo según el catálogo (RECARGA, DEBITO o RECHAZADO)
    td.Monto AS monto,
    td.Latitud AS latitud,
    td.Longitud AS longitud,
    td.FechaHora AS fechaHora,
    td.FHRegistro AS fhRegistro,
    td.NumeroSerieMonedero AS numeroSerieMonedero,
    td.NumeroSerieDispositivo AS numeroSerieDispositivo,
    td.ControlTransaccion AS controlTransaccion,

    -- Datos del dispositivo
    d.Marca AS marcaDispositivo,
    d.Modelo AS modeloDispositivo,

    -- Pasajero (vía Monedero)
    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero

FROM TransaccionesDebito td
INNER JOIN CatTiposTransacciones ctt 
    ON td.IdTipoTransaccion = ctt.Id
LEFT JOIN Dispositivos d 
    ON td.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Monederos m 
    ON td.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
    WHERE td.Id = ?

        `,
        [id],
      );

      if (!transacciones)
        throw new NotFoundException('Transaccion no encontradas');
      // 🔥 Transformación de datos (ids → number, nombreCompleto)
      const data = transacciones.map((item) => ({
        ...item,
        id: Number(item.id),
        monto: Number(item.monto),
        latitud: Number(item.latitud),
        longitud: Number(item.longitud),
        idPasajero: Number(item.idPasajero),
      }));
      return { data: data };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({
        message: 'Error al obtener transacciones',
      });
    }
  }
}
