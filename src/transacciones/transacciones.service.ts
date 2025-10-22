import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateTransaccioneDto } from './dto/create-transaccione.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transacciones } from 'src/entities/Transacciones';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { Dispositivos } from 'src/entities/Dispositivos';
import { MonederosService } from 'src/monederos/monederos.service';
import { PasajerosService } from 'src/pasajeros/pasajeros.service';

@Injectable()
export class TransaccionesService {
  constructor(
    @InjectRepository(Transacciones)
    private readonly transaccionesRepository: Repository<Transacciones>,
    @InjectRepository(Dispositivos)
    private readonly dispositivoRepository: Repository<Dispositivos>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly monederosService: MonederosService,
    private readonly pasajeroService: PasajerosService,
  ) {}
  async createTransaccion(
    createTransaccioneDto: CreateTransaccioneDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      //Buscamos el monedero
      const monedero = await this.monederosService.findOneMonederoBySerie(
        createTransaccioneDto.numeroSerieMonedero,
      );

      //Declaramos transaccion y creamos la variable montoFinal
      let transaccion = createTransaccioneDto.tipoTransaccion;
      let montoFinal: number = 0;

      //Checamos el tipo transaccion
      if (transaccion === 'RECARGA') {
        montoFinal =
          Number(monedero.data.saldo) + Number(createTransaccioneDto.monto);
      } else if (transaccion === 'DEBITO') {
        montoFinal =
          Number(monedero.data.saldo) - Number(createTransaccioneDto.monto);
      }
      console.log(
        'Saldo Inicial: ',
        monedero.data.saldo,
        ' Tipo Transaccion: ',
        transaccion,
        ' Monto: ',
        createTransaccioneDto.monto,
        ' Monto Final: ',
        montoFinal,
      );
      //Pasamos un filtro que no haya valores negativos
      if (montoFinal < 0) {
        throw new BadRequestException('Saldo insuficiente');
      }

      //actualizamos el saldo del monedero
      await this.monederosService.updateMonederoSaldo(
        createTransaccioneDto.numeroSerieMonedero,
        idUser,
        montoFinal,
      );

      //Creamos la transaccion en la BD
      const newTransaccion = await this.transaccionesRepository.create(
        createTransaccioneDto,
      );
      const transaccionSave =
        await this.transaccionesRepository.save(newTransaccion);

      // --- Registro en la bitácora --- SUCCESS
      const querylogger = { createTransaccioneDto };
      await this.bitacoraLogger.logToBitacora(
        'Transacciones',
        `Se realizo una transaccion de tipo ${transaccion}`,
        'CREATE',
        querylogger,
        idUser,
        25,
        EstatusEnumBitcora.SUCCESS,
      );

      //API response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Transaccion creado correctamente',
        data: {
          id: Number(transaccionSave.id),
          nombre:
            `${createTransaccioneDto.numeroSerieMonedero} ${montoFinal} ` || '',
        },
      };
      return result;
    } catch (error) {
      // --- Registro en la bitácora --- ERROR
      const querylogger = { createTransaccioneDto };
      await this.bitacoraLogger.logToBitacora(
        'Transacciones',
        `Se realizo una transaccion de tipo ${createTransaccioneDto.tipoTransaccion}`,
        'CREATE',
        querylogger,
        idUser,
        25,
        EstatusEnumBitcora.ERROR,
        error.message,
      );

      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error generar la transaccion de tipo ${createTransaccioneDto.tipoTransaccion}`,
      );
    }
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
          transacciones = await this.transaccionesRepository.query(
            `
SELECT 
    -- Transacción
    t.Id AS id,
    t.TipoTransaccion AS tipoTransaccion,
    t.Monto AS monto,
    t.Latitud AS latitud,
    t.Longitud AS longitud,
    t.FechaHora AS fechaHora,
    t.FHRegistro AS fhRegistro,
    t.NumeroSerieMonedero AS numeroSerieMonedero,
    t.NumeroSerieDispositivo AS numeroSerieDispositivo,

    -- Dispositivo (puede ser NULL)
    d.Marca AS marcaDispositivo,
    d.Modelo AS modeloDispositivo,
    

    -- Pasajero (a través del monedero)
    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero



FROM Transacciones t
LEFT JOIN Dispositivos d 
    ON t.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Monederos m 
    ON t.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
    
    ORDER BY t.Id DESC
  LIMIT ? OFFSET ?;
        `,
            [limit, offset],
          );

          // Query para total (sin paginación)
          totalResult = await this.transaccionesRepository.query(
            `
   SELECT COUNT(*) AS total
FROM Transacciones t
LEFT JOIN Dispositivos d 
    ON t.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Monederos m 
    ON t.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
		
  `,
          );
          break;

        case 9:
          const pasajero =
            await this.pasajeroService.findOnePasajeroCorreo(email);
          console.log(idUser, email, cliente, rol, pasajero);
          transacciones = await this.transaccionesRepository.query(
            `
SELECT 
    -- Transacción
    t.Id AS id,
    t.TipoTransaccion AS tipoTransaccion,
    t.Monto AS monto,
    t.Latitud AS latitud,
    t.Longitud AS longitud,
    t.FechaHora AS fechaHora,
    t.FHRegistro AS fhRegistro,
    t.NumeroSerieMonedero AS numeroSerieMonedero,
    t.NumeroSerieDispositivo AS numeroSerieDispositivo,

    -- Dispositivo (puede ser NULL)
    d.Marca AS marcaDispositivo,
    d.Modelo AS modeloDispositivo,
    

    -- Pasajero (a través del monedero)
    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero



FROM Transacciones t
LEFT JOIN Dispositivos d 
    ON t.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Monederos m 
    ON t.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
    
    WHERE p.Id = ?
    ORDER BY t.Id DESC
 
  LIMIT ? OFFSET ?;
        `,
            [Number(pasajero.id), limit, offset],
          );

          // Query para total (sin paginación)
          totalResult = await this.transaccionesRepository.query(
            `
  SELECT COUNT(*) AS total
  FROM Transacciones t
  LEFT JOIN Dispositivos d 
      ON t.NumeroSerieDispositivo = d.NumeroSerie
  INNER JOIN Monederos m 
      ON t.NumeroSerieMonedero = m.NumeroSerie
  LEFT JOIN Pasajeros p 
      ON m.IdPasajero = p.Id
  WHERE p.Id = ?
  `,
            [Number(pasajero.id)], // <-- Aquí debe ir como segundo argumento de query()
          );

          break;

        default:
          transacciones = await this.transaccionesRepository.query(
            `
SELECT 
    -- Transacción
    t.Id AS id,
    t.TipoTransaccion AS tipoTransaccion,
    t.Monto AS monto,
    t.Latitud AS latitud,
    t.Longitud AS longitud,
    t.FechaHora AS fechaHora,
    t.FHRegistro AS fhRegistro,
    t.NumeroSerieMonedero AS numeroSerieMonedero,
    t.NumeroSerieDispositivo AS numeroSerieDispositivo,

    -- Dispositivo (puede ser NULL)
    d.Marca AS marcaDispositivo,
    d.Modelo AS modeloDispositivo,
    

    -- Pasajero (a través del monedero)
    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero



FROM Transacciones t
LEFT JOIN Dispositivos d 
    ON t.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Monederos m 
    ON t.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
    
    ORDER BY t.Id DESC
  LIMIT ? OFFSET ?;
        `,
            [limit, offset],
          );

          // Query para total (sin paginación)
          totalResult = await this.transaccionesRepository.query(
            `
   SELECT COUNT(*) AS total
FROM Transacciones t
LEFT JOIN Dispositivos d 
    ON t.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Monederos m 
    ON t.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
		
  `,
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

  async findAllListTransacciones(): Promise<ApiResponseCommon> {
    try {
      const transacciones = await this.transaccionesRepository.query(
        `
SELECT 
    -- Transacción
    t.Id AS id,
    t.TipoTransaccion AS tipoTransaccion,
    t.Monto AS monto,
    t.Latitud AS latitud,
    t.Longitud AS longitud,
    t.FechaHora AS fechaHora,
    t.FHRegistro AS fhRegistro,
    t.NumeroSerieMonedero AS numeroSerieMonedero,
    t.NumeroSerieDispositivo AS numeroSerieDispositivo,

    -- Dispositivo (puede ser NULL)
    d.Marca AS marcaDispositivo,
    d.Modelo AS modeloDispositivo,
    

    -- Pasajero (a través del monedero)
    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero



FROM Transacciones t
LEFT JOIN Dispositivos d 
    ON t.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Monederos m 
    ON t.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
    
    ORDER BY t.Id DESC
        `,
      );

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

  async findOneTransaccion(Id: number) {
    try {
      const transaccion = await this.transaccionesRepository.findOne({
        where: { id: Id },
      });
      if (!transaccion)
        throw new NotFoundException('Transaccion no encontradas');
      return { data: transaccion };
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
