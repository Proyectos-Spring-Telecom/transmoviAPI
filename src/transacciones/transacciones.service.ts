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
import { Validadores } from 'src/entities/Validadores';
import { MonederosService } from 'src/monederos/monederos.service';
import { PasajerosService } from 'src/pasajeros/pasajeros.service';
import { Clientes } from 'src/entities/Clientes';
import { CreateTransaccioneDebitoDto } from './dto/create-transaccione-debito.dto';
import {
  EnumControlTransacciones,
  EnumModulos,
  EnumTipoDescuento,
  EnumTipoTransaccion,
} from 'src/common/estatus.enum';
import {
  transicionarEstado,
  EstadoTransaccion,
  EventoTransaccion,
} from '../utils/transaccion.util';
import { Monederos } from 'src/entities/Monederos';
import { CatTiposPasajeros } from 'src/entities/CatTiposPasajeros';

import { TransbordosPermitidos } from 'src/entities/TransbordosPermitidos';
import { DetalleTransbordos } from 'src/entities/DetalleTransbordos';
import { HistoricoTransaccionesDebito } from 'src/entities/HistoricoTransaccionesDebito';

import { UpdateTransaccioneDebitoDto } from './dto/update-transaccione-debito.dto';

@Injectable()
export class TransaccionesService {
  constructor(
    @InjectRepository(TransaccionesRecarga)
    private readonly transaccionesrecargaRepository: Repository<TransaccionesRecarga>,
    @InjectRepository(TransaccionesDebito)
    private readonly transaccionesdebitoRepository: Repository<TransaccionesDebito>,

    @InjectRepository(Validadores)
    private readonly validadorRepository: Repository<Validadores>,

    @InjectRepository(HistoricoTransaccionesDebito)
    private readonly historicoTransaccionesDebitoRepository: Repository<HistoricoTransaccionesDebito>,
   
    @InjectRepository(Clientes)
    private readonly clienteRepository: Repository<Clientes>,
    @InjectRepository(CatTiposPasajeros)
    private readonly CatTiposPasajerosRepository: Repository<CatTiposPasajeros>,
    @InjectRepository(Monederos)
    private readonly monederoRepository: Repository<Monederos>,
    @InjectRepository(TransbordosPermitidos)
    private readonly transbordosPermitidosRepository: Repository<TransbordosPermitidos>,
    @InjectRepository(DetalleTransbordos)
    private readonly detalleTransbordosRepository: Repository<DetalleTransbordos>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly monederosService: MonederosService,
    private readonly pasajeroService: PasajerosService,
  ) { }

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
      newTransaccion.idTipoTransaccion = EnumTipoTransaccion.RECARGA
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
    cliente: number,
  ): Promise<ApiCrudResponse> {
    let estado: EstadoTransaccion = EstadoTransaccion.INICIADA;

    try {
      // 1️⃣ Cambiamos estado a VALIDANDO_SALDO
      estado = transicionarEstado(estado, EventoTransaccion.CREAR);

      // 2️⃣ Buscamos el monedero
      const monedero = await this.monederoRepository.findOne({
        where: {
          numeroSerie: createTransaccioneDebitoDto.numeroSerieMonedero,
          estatus: 1,
        },
      });

      if (!monedero) {
        estado = EstadoTransaccion.ERROR;
        throw new BadRequestException('Monedero no encontrado');
      }

      // 2.5️⃣ Calculamos el numeroTransbordo y reemplazamos el monto con el costo del transbordo (opcional)
      // Si no existe un transbordo para el cliente, continuamos con la lógica normal
      let numeroTransbordo: number | null = null;
      const transbordoPermitido = await this.transbordosPermitidosRepository.findOne({
        where: { idCliente: monedero.idCliente },
      });

      // Solo aplicamos la lógica de transbordos si existe configuración para el cliente
      if (transbordoPermitido && transbordoPermitido.tiempo && transbordoPermitido.numeroTransbordos) {
        // Calculamos la fecha límite hacia atrás (tiempo en minutos)
        const fechaHoraTransaccion = new Date(
          createTransaccioneDebitoDto.fechaHoraInicio || createTransaccioneDebitoDto.fechaHoraFinal
        );
        const tiempoEnMs = transbordoPermitido.tiempo * 60 * 1000; // Convertir minutos a milisegundos
        const fechaLimite = new Date(fechaHoraTransaccion.getTime() - tiempoEnMs);

        // Buscamos transacciones en el rango de tiempo con el mismo numeroSerieMonedero
        const transaccionesEnRango = await this.transaccionesdebitoRepository
          .createQueryBuilder('td')
          .where('td.numeroSerieMonedero = :numeroSerieMonedero', {
            numeroSerieMonedero: createTransaccioneDebitoDto.numeroSerieMonedero,
          })
          .andWhere('td.fechaHora >= :fechaLimite', { fechaLimite })
          .andWhere('td.fechaHora <= :fechaHoraTransaccion', { fechaHoraTransaccion })
          .orderBy('td.fechaHora', 'ASC')
          .getMany();

        if (transaccionesEnRango.length === 0) {
          // Es la primera transacción en ese rango de tiempo
          numeroTransbordo = 1;
        } else {
          // Buscamos la primera transacción con numeroTransbordo = 1 (el primer transbordo)
          const primerTransbordo = transaccionesEnRango.find((t) => t.numeroTransbordo === 1);
          
          if (primerTransbordo) {
            // Calculamos si el tiempo desde el primer transbordo ya pasó
            const fechaPrimerTransbordo = new Date(
              createTransaccioneDebitoDto.fechaHoraInicio || createTransaccioneDebitoDto.fechaHoraFinal
            );
            const fechaExpiracionPrimerTransbordo = new Date(
              fechaPrimerTransbordo.getTime() + tiempoEnMs,
            );

            // Si el tiempo desde el primer transbordo ya pasó, reiniciamos el contador a 1
            if (fechaHoraTransaccion > fechaExpiracionPrimerTransbordo) {
              numeroTransbordo = 1;
            } else {
              // El primer transbordo todavía está vigente, continuamos con el consecutivo
              const numerosTransbordo = transaccionesEnRango
                .map((t) => t.numeroTransbordo)
                .filter((n) => n !== null && n !== undefined) as number[];

              if (numerosTransbordo.length > 0) {
                const maxNumeroTransbordo = Math.max(...numerosTransbordo);
                numeroTransbordo = maxNumeroTransbordo + 1;
              } else {
                numeroTransbordo = 1;
              }
            }
          } else {
            // No hay primer transbordo (numeroTransbordo = 1) en el rango, empezamos en 1
            numeroTransbordo = 1;
          }
        }

        // Buscamos el costo del transbordo en DetalleTransbordos
        if (numeroTransbordo && transbordoPermitido.id) {
          const detalleTransbordo = await this.detalleTransbordosRepository.findOne({
            where: {
              idTransbordo: transbordoPermitido.id,
              nroTransbordo: numeroTransbordo,
            },
          });

          // Si encontramos el detalle, reemplazamos el monto con el costo del transbordo
          if (detalleTransbordo && detalleTransbordo.costo !== null) {
            createTransaccioneDebitoDto.monto = Number(detalleTransbordo.costo);
          }
        }
      }

      // 3️⃣ Calculamos monto final (aquí se pueden aplicar descuentos si existen)
      let montoConDescuento = Number(createTransaccioneDebitoDto.monto);

      if (monedero.idTipoPasajero) {
        const tipoPasajero = await this.CatTiposPasajerosRepository.findOne({
          where: { id: monedero.idTipoPasajero },
          relations: ['CatTipoDescuento'], // si tienes FK hacia CatTipoDescuento
        });

        if (tipoPasajero && tipoPasajero.idCatTipoDescuento) {
          const tipoDescuento = Number(tipoPasajero.idCatTipoDescuento);
          const cantidad = tipoPasajero.cantidad || 0;

          switch (tipoDescuento) {
            case Number(EnumTipoDescuento.PORCENTAJE):
              console.log('Entro a porcentaje');
              montoConDescuento =
                montoConDescuento - (montoConDescuento * cantidad) / 100;
              break;
            case EnumTipoDescuento.MONETARIO:
              console.log('Monetario');
              montoConDescuento = montoConDescuento - cantidad;
              break;
            case EnumTipoDescuento.NULO:
            default:
              break;
          }
        }
      }


      let montoFinal = Number(monedero.saldo) - montoConDescuento;

      // 4️⃣ Validación de saldo
      if (montoFinal < 0) {
        estado = transicionarEstado(
          estado,
          EventoTransaccion.SALDO_INSUFICIENTE,
        );
        createTransaccioneDebitoDto.idTipoTransaccion =
          EnumTipoTransaccion.RECHAZO;

        // Guardar transacción rechazada
        const newTransaccion = this.transaccionesdebitoRepository.create(
          createTransaccioneDebitoDto,
        );
        await this.transaccionesdebitoRepository.save(newTransaccion);
        //se guarda en el historico
        await this.historicoTransaccionesDebitoRepository.save(newTransaccion);

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
      switch (createTransaccioneDebitoDto.controlTransaccion) {
        case EnumControlTransacciones.ABIERTA:
          estado = transicionarEstado(estado, EventoTransaccion.SALDO_OK);
          createTransaccioneDebitoDto.monto = 0
          break;

        default:
          estado = transicionarEstado(estado, EventoTransaccion.SALDO_OK);
          await this.monederosService.updateMonederoSaldo(
            createTransaccioneDebitoDto.numeroSerieMonedero,
            idUser,
            montoFinal,
          );
          createTransaccioneDebitoDto.monto = montoConDescuento
          break;
      }

      // 6️⃣ Guardamos transacción aprobada
      const newTransaccion = this.transaccionesdebitoRepository.create({
        ...createTransaccioneDebitoDto,
        numeroTransbordo,
      });
      const transaccionSave =
        await this.transaccionesdebitoRepository.save(newTransaccion);
      let transaccionSaveHis;

      //Se guardara la transaccion en el historico de transacciones solamente cuando controltransaccion sea pagado
      if (createTransaccioneDebitoDto.controlTransaccion === EnumControlTransacciones.PAGADO) {
        transaccionSaveHis =
          await this.historicoTransaccionesDebitoRepository.save(newTransaccion);
        // 7️⃣ Bitácora de éxito //controltransaccion pagado----
        await this.bitacoraLogger.logToBitacora(
          'Transacciones',
          `Transacción de débito APROBADA`,
          'CREATE',
          { createTransaccioneDebitoDto },
          idUser,
          EnumModulos.TRANSACCIONES,
          EstatusEnumBitcora.SUCCESS,
        );

        // 8️⃣ Finalizamos la transacción //controltransaccion pagado----
        estado = transicionarEstado(estado, EventoTransaccion.FINALIZAR);

        return {
          status: 'success',
          message: 'Transacción creada correctamente',
          data: {
            id: Number(transaccionSaveHis.id) || Number(transaccionSave.id),
            nombre: `${monedero.numeroSerie}`,
          },
        };
      }

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
          nombre: `${monedero.numeroSerie}`,
        },
      };
    } catch (error) {
      estado = EstadoTransaccion.ERROR;
      if (error instanceof HttpException) {
        throw error;
      }

      // Bitácora de error
      const querylogger = { createTransaccioneDebitoDto };
      await this.bitacoraLogger.logToBitacora(
        'Transacciones',
        `Error en transacción de débito`,
        'CREATE',
        querylogger,
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
  async updateTransaccionDebito(
    updateTransaccioneDebitoDto: UpdateTransaccioneDebitoDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      //Buscamos el monedero
      const monedero = await this.monederoRepository.findOne({
        where: {
          numeroSerie: updateTransaccioneDebitoDto.numeroSerieMonedero,
          estatus: 1,
        },
      });
      if (!monedero) {
        throw new BadRequestException('Monedero no encontrado');
      }

      // 3️⃣ Calculamos monto final (aquí se pueden aplicar descuentos si existen)
      let montoConDescuento = Number(updateTransaccioneDebitoDto.monto);

      if (monedero.idTipoPasajero) {
        const tipoPasajero = await this.CatTiposPasajerosRepository.findOne({
          where: { id: monedero.idTipoPasajero },
          relations: ['CatTipoDescuento'], // si tienes FK hacia CatTipoDescuento
        });

        if (tipoPasajero && tipoPasajero.idCatTipoDescuento) {
          const tipoDescuento = Number(tipoPasajero.idCatTipoDescuento);
          const cantidad = tipoPasajero.cantidad || 0;

          switch (tipoDescuento) {
            case Number(EnumTipoDescuento.PORCENTAJE):
              console.log('Entro a porcentaje');
              montoConDescuento =
                montoConDescuento - (montoConDescuento * cantidad) / 100;
              break;
            case EnumTipoDescuento.MONETARIO:
              console.log('Monetario');
              montoConDescuento = montoConDescuento - cantidad;
              break;
            case EnumTipoDescuento.NULO:
            default:
              break;
          }
        }
      }

      let montoFinal = Number(monedero.saldo) - montoConDescuento;

      // 4️⃣ Validación de saldo
      if (montoFinal < 0) {
        updateTransaccioneDebitoDto.idTipoTransaccion =
          EnumTipoTransaccion.RECHAZO;

        // Guardar transacción rechazada
        const updateTransaccion = this.transaccionesdebitoRepository.create({
          idTipoTransaccion: EnumTipoTransaccion.RECHAZO,
          monto: montoFinal,
          controlTransaccion: EnumControlTransacciones.PAGADO,
          latitudFinal: updateTransaccioneDebitoDto.latitudFinal,
          longitudFinal: updateTransaccioneDebitoDto.longitudFinal,
          fechaHoraFinal: updateTransaccioneDebitoDto.fechaHoraFinal,
          numeroSerieMonedero: updateTransaccioneDebitoDto.numeroSerieMonedero,
          numeroSerieValidador: updateTransaccioneDebitoDto.numeroSerieValidador,
        }
        );
        await this.transaccionesdebitoRepository.save(updateTransaccion);
        //se guarda en el historico
        await this.historicoTransaccionesDebitoRepository.save(updateTransaccion);

        // Registrar en bitácora
        await this.bitacoraLogger.logToBitacora(
          'Transacciones',
          `Transacción de débito RECHAZADA por saldo insuficiente`,
          'CREATE',
          { updateTransaccioneDebitoDto },
          idUser,
          EnumModulos.TRANSACCIONES,
          EstatusEnumBitcora.ERROR,
          'Saldo insuficiente',
        );

        throw new BadRequestException('Saldo insuficiente');
      }

      // 5️⃣ Si saldo OK, actualizamos el monedero y estado
      await this.monederosService.updateMonederoSaldo(
        updateTransaccioneDebitoDto.numeroSerieMonedero,
        idUser,
        montoFinal,
      );

      // 6️⃣ Guardamos transacción aprobada
      await this.transaccionesdebitoRepository.update(
        updateTransaccioneDebitoDto.idTransaccionDebito,
        {
          idTipoTransaccion: EnumTipoTransaccion.DEBITO,
          monto: montoConDescuento,
          controlTransaccion: EnumControlTransacciones.PAGADO,
          latitudFinal: updateTransaccioneDebitoDto.latitudFinal,
          longitudFinal: updateTransaccioneDebitoDto.longitudFinal,
          fechaHoraFinal: updateTransaccioneDebitoDto.fechaHoraFinal,
          numeroSerieMonedero: updateTransaccioneDebitoDto.numeroSerieMonedero,
          numeroSerieValidador: updateTransaccioneDebitoDto.numeroSerieValidador,
        }
      );
      const transaccionSave =
        await this.transaccionesdebitoRepository.findOne({
          where: {
            id: updateTransaccioneDebitoDto.idTransaccionDebito
          }
        });

      if (!transaccionSave) {
        throw new NotFoundException('La transacción no existe');
      }

      const { id: _, ...transaccionBody } = transaccionSave

      const transaccionSaveHis =
        await this.historicoTransaccionesDebitoRepository.save(transaccionBody);


      return {
        status: 'success',
        message: 'Transacción creada correctamente',
        data: {
          id: Number(transaccionSaveHis.id),
          nombre: `${monedero.numeroSerie}`,
        },
      };
    } catch (error) {
      // --- Registro en la bitácora --- ERROR
      const querylogger = { updateTransaccioneDebitoDto };
      await this.bitacoraLogger.logToBitacora(
        'Transacciones',
        `Se realizo una transaccion de tipo ${updateTransaccioneDebitoDto.idTipoTransaccion}`,
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
        `Error generar la transaccion de tipo ${updateTransaccioneDebitoDto.idTipoTransaccion}`,
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
    td.NumeroSerieValidador AS numeroSerieValidador,
    td.ControlTransaccion AS controlTransaccion,

    -- Datos del validador
    d.Marca AS marcaValidador,
    d.Modelo AS modeloValidador,
    -- Datos del cliente
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,
    



    -- Pasajero (vía Monedero)
    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero

FROM TransaccionesDebito td
INNER JOIN CatTiposTransacciones ctt 
    ON td.IdTipoTransaccion = ctt.Id
LEFT JOIN Validadores d 
    ON td.NumeroSerieValidador = d.NumeroSerie
INNER JOIN Monederos m 
    ON td.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
INNER JOIN Clientes c
	ON m.IdCliente = c.Id

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
    tr.NumeroSerieValidador AS numeroSerieValidador,
    tr.ControlTransaccion AS controlTransaccion,

    d.Marca AS marcaValidador,
    d.Modelo AS modeloValidador,

    -- Datos del cliente
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,
    

  

    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero

FROM TransaccionesRecarga tr
INNER JOIN CatTiposTransacciones ctt 
    ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN Validadores d 
    ON tr.NumeroSerieValidador = d.NumeroSerie
INNER JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
INNER JOIN Clientes c
	ON m.IdCliente = c.Id

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
    LEFT JOIN Validadores d 
        ON td.NumeroSerieValidador = d.NumeroSerie
    INNER JOIN Monederos m 
        ON td.NumeroSerieMonedero = m.NumeroSerie
    LEFT JOIN Pasajeros p 
        ON m.IdPasajero = p.Id

    UNION ALL

    SELECT tr.Id
    FROM TransaccionesRecarga tr
    INNER JOIN CatTiposTransacciones ctt 
        ON tr.IdTipoTransaccion = ctt.Id
    LEFT JOIN Validadores d 
        ON tr.NumeroSerieValidador = d.NumeroSerie
    INNER JOIN Monederos m 
        ON tr.NumeroSerieMonedero = m.NumeroSerie
    LEFT JOIN Pasajeros p 
        ON m.IdPasajero = p.Id
) AS todas;
		
  `,
          );
          break;

        case 3:
        default:
          //Usuarios Operador
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
      td.NumeroSerieValidador AS numeroSerieValidador,
      td.ControlTransaccion AS controlTransaccion,

      -- Datos del cliente
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,
    

      d.Marca AS marcaDispositivo,
      d.Modelo AS modeloDispositivo,

      p.Id AS idPasajero,
      p.Nombre AS nombrePasajero,
      p.ApellidoPaterno AS apellidoPaternoPasajero,
      p.ApellidoMaterno AS apellidoMaternoPasajero

  FROM TransaccionesDebito td
  INNER JOIN CatTiposTransacciones ctt 
      ON td.IdTipoTransaccion = ctt.Id
  LEFT JOIN Validadores d 
      ON td.NumeroSerieValidador = d.NumeroSerie
  INNER JOIN Monederos m 
      ON td.NumeroSerieMonedero = m.NumeroSerie
  LEFT JOIN Pasajeros p 
      ON m.IdPasajero = p.Id
  INNER JOIN Clientes c
	ON m.IdCliente = c.Id

  WHERE m.IdCliente = ?   -- 🔹 aquí colocas el ID del cliente que quieres consultar

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
      tr.NumeroSerieValidador AS numeroSerieValidador,
      tr.ControlTransaccion AS controlTransaccion,

      -- Datos del cliente
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,
    

      d.Marca AS marcaDispositivo,
      d.Modelo AS modeloDispositivo,

      p.Id AS idPasajero,
      p.Nombre AS nombrePasajero,
      p.ApellidoPaterno AS apellidoPaternoPasajero,
      p.ApellidoMaterno AS apellidoMaternoPasajero

  FROM TransaccionesRecarga tr
  INNER JOIN CatTiposTransacciones ctt 
      ON tr.IdTipoTransaccion = ctt.Id
  LEFT JOIN Validadores d 
      ON tr.NumeroSerieValidador = d.NumeroSerie
  INNER JOIN Monederos m 
      ON tr.NumeroSerieMonedero = m.NumeroSerie
  LEFT JOIN Pasajeros p 
      ON m.IdPasajero = p.Id
  INNER JOIN Clientes c
	ON m.IdCliente = c.Id

  WHERE m.IdCliente = ?   -- 🔹 aquí colocas el ID del cliente que quieres consultar
)
ORDER BY FHRegistro DESC
LIMIT ? OFFSET ?;

        `,
            [cliente, cliente, limit, offset],
          );

          // Query para total (sin paginación)
          totalResult = await this.transaccionesrecargaRepository.query(
            `
SELECT COUNT(*) AS total
FROM (
  SELECT td.Id
  FROM TransaccionesDebito td
  INNER JOIN Monederos m ON td.NumeroSerieMonedero = m.NumeroSerie
  WHERE m.IdCliente = ?   -- 🔹 aquí colocas el ID del cliente que quieres consultar

  UNION ALL

  SELECT tr.Id
  FROM TransaccionesRecarga tr
  INNER JOIN Monederos m ON tr.NumeroSerieMonedero = m.NumeroSerie
  WHERE m.IdCliente = ?   -- 🔹 aquí colocas el ID del cliente que quieres consultar
) AS todas;

  `,
            [cliente, cliente],
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
      td.NumeroSerieValidador AS numeroSerieValidador,
      td.ControlTransaccion AS controlTransaccion,

      d.Marca AS marcaValidador,
      d.Modelo AS modeloValidador,

      p.Id AS idPasajero,
      p.Nombre AS nombrePasajero,
      p.ApellidoPaterno AS apellidoPaternoPasajero,
      p.ApellidoMaterno AS apellidoMaternoPasajero

  FROM TransaccionesDebito td
  INNER JOIN CatTiposTransacciones ctt ON td.IdTipoTransaccion = ctt.Id
  LEFT JOIN Validadores d ON td.NumeroSerieValidador = d.NumeroSerie
  INNER JOIN Monederos m ON td.NumeroSerieMonedero = m.NumeroSerie
  INNER JOIN Pasajeros p ON m.IdPasajero = p.Id
  WHERE p.Id = ?
  AND m.Estatus = 1

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
      tr.NumeroSerieValidador AS numeroSerieValidador,
      tr.ControlTransaccion AS controlTransaccion,

      d.Marca AS marcaValidador,
      d.Modelo AS modeloValidador,

      p.Id AS idPasajero,
      p.Nombre AS nombrePasajero,
      p.ApellidoPaterno AS apellidoPaternoPasajero,
      p.ApellidoMaterno AS apellidoMaternoPasajero

  FROM TransaccionesRecarga tr
  INNER JOIN CatTiposTransacciones ctt ON tr.IdTipoTransaccion = ctt.Id
  LEFT JOIN Validadores d ON tr.NumeroSerieValidador = d.NumeroSerie
  INNER JOIN Monederos m ON tr.NumeroSerieMonedero = m.NumeroSerie
  INNER JOIN Pasajeros p ON m.IdPasajero = p.Id
  WHERE p.Id = ?
  AND m.Estatus = 1
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
      AND m.Estatus = 1

    UNION ALL

    SELECT tr.Id
    FROM TransaccionesRecarga tr
    INNER JOIN CatTiposTransacciones ctt ON tr.IdTipoTransaccion = ctt.Id
    INNER JOIN Monederos m ON tr.NumeroSerieMonedero = m.NumeroSerie
    INNER JOIN Pasajeros p ON m.IdPasajero = p.Id
    WHERE p.Id = ?  -- 👈 mismo pasajero
      AND m.Estatus = 1
) AS transacciones_pasajero;

  `,
            [Number(pasajero.id), Number(pasajero.id)], // <-- Aquí debe ir como segundo argumento de query()
          );

          break;

        case 2:
        case 8:
        case 10:
          //resto usuarios
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
      td.NumeroSerieValidador AS numeroSerieValidador,
      td.ControlTransaccion AS controlTransaccion,

      d.Marca AS marcaValidador,
      d.Modelo AS modeloValidador,
      -- Datos del cliente
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,
    



      p.Id AS idPasajero,
      p.Nombre AS nombrePasajero,
      p.ApellidoPaterno AS apellidoPaternoPasajero,
      p.ApellidoMaterno AS apellidoMaternoPasajero

  FROM TransaccionesDebito td
  INNER JOIN CatTiposTransacciones ctt 
      ON td.IdTipoTransaccion = ctt.Id
  LEFT JOIN Validadores d 
      ON td.NumeroSerieValidador = d.NumeroSerie
  INNER JOIN Monederos m 
      ON td.NumeroSerieMonedero = m.NumeroSerie
  LEFT JOIN Pasajeros p 
      ON m.IdPasajero = p.Id
  INNER JOIN Clientes c
	ON m.IdCliente = c.Id

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
      tr.NumeroSerieValidador AS numeroSerieValidador,
      tr.ControlTransaccion AS controlTransaccion,

      d.Marca AS marcaValidador,
      d.Modelo AS modeloValidador,

      -- Datos del cliente
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,
    


      p.Id AS idPasajero,
      p.Nombre AS nombrePasajero,
      p.ApellidoPaterno AS apellidoPaternoPasajero,
      p.ApellidoMaterno AS apellidoMaternoPasajero

  FROM TransaccionesRecarga tr
  INNER JOIN CatTiposTransacciones ctt 
      ON tr.IdTipoTransaccion = ctt.Id
  LEFT JOIN Validadores d 
      ON tr.NumeroSerieValidador = d.NumeroSerie
  INNER JOIN Monederos m 
      ON tr.NumeroSerieMonedero = m.NumeroSerie
  LEFT JOIN Pasajeros p 
      ON m.IdPasajero = p.Id
  INNER JOIN Clientes c
	ON m.IdCliente = c.Id

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
    td.NumeroSerieValidador AS numeroSerieValidador,
    td.ControlTransaccion AS controlTransaccion,

    -- Datos del validador
    d.Marca AS marcaValidador,
    d.Modelo AS modeloValidador,

    -- Pasajero (vía Monedero)
    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero

FROM TransaccionesDebito td
INNER JOIN CatTiposTransacciones ctt 
    ON td.IdTipoTransaccion = ctt.Id
LEFT JOIN Validadores d 
    ON td.NumeroSerieValidador = d.NumeroSerie
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
    tr.NumeroSerieValidador AS numeroSerieValidador,
    tr.ControlTransaccion AS controlTransaccion,

    d.Marca AS marcaValidador,
    d.Modelo AS modeloValidador,

    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero

FROM TransaccionesRecarga tr
INNER JOIN CatTiposTransacciones ctt 
    ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN Validadores d 
    ON tr.NumeroSerieValidador = d.NumeroSerie
INNER JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id

ORDER BY FHRegistro DESC
        `,
          );
          break;

        case 2: // Administrador
        case 8: // Reportes
        case 10: // Capturista
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
      td.NumeroSerieValidador AS numeroSerieValidador,
      td.ControlTransaccion AS controlTransaccion,

      d.Marca AS marcaValidador,
      d.Modelo AS modeloValidador,

      p.Id AS idPasajero,
      p.Nombre AS nombrePasajero,
      p.ApellidoPaterno AS apellidoPaternoPasajero,
      p.ApellidoMaterno AS apellidoMaternoPasajero

  FROM TransaccionesDebito td
  INNER JOIN CatTiposTransacciones ctt 
      ON td.IdTipoTransaccion = ctt.Id
  LEFT JOIN Validadores d 
      ON td.NumeroSerieValidador = d.NumeroSerie
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
      tr.NumeroSerieValidador AS numeroSerieValidador,
      tr.ControlTransaccion AS controlTransaccion,

      d.Marca AS marcaValidador,
      d.Modelo AS modeloValidador,

      p.Id AS idPasajero,
      p.Nombre AS nombrePasajero,
      p.ApellidoPaterno AS apellidoPaternoPasajero,
      p.ApellidoMaterno AS apellidoMaternoPasajero

  FROM TransaccionesRecarga tr
  INNER JOIN CatTiposTransacciones ctt 
      ON tr.IdTipoTransaccion = ctt.Id
  LEFT JOIN Validadores d 
      ON tr.NumeroSerieValidador = d.NumeroSerie
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

        case 3:
        default:
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
      td.NumeroSerieValidador AS numeroSerieValidador,
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
  LEFT JOIN Validadores d 
      ON td.NumeroSerieValidador = d.NumeroSerie
  INNER JOIN Monederos m 
      ON td.NumeroSerieMonedero = m.NumeroSerie
  LEFT JOIN Pasajeros p 
      ON m.IdPasajero = p.Id
  WHERE m.IdCliente = ?   -- 🔹 aquí colocas el ID del cliente que quieres consultar

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
      tr.NumeroSerieValidador AS numeroSerieValidador,
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
  LEFT JOIN Validadores d 
      ON tr.NumeroSerieValidador = d.NumeroSerie
  INNER JOIN Monederos m 
      ON tr.NumeroSerieMonedero = m.NumeroSerie
  LEFT JOIN Pasajeros p 
      ON m.IdPasajero = p.Id
  WHERE m.IdCliente = ?   -- 🔹 aquí colocas el ID del cliente que quieres consultar
)
ORDER BY FHRegistro DESC

        `,
            [cliente, cliente],
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
    tr.NumeroSerieValidador AS numeroSerieValidador,
    tr.ControlTransaccion AS controlTransaccion,

    d.Marca AS marcaValidador,
    d.Modelo AS modeloValidador,

    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero

FROM TransaccionesRecarga tr
INNER JOIN CatTiposTransacciones ctt 
    ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN Validadores d 
    ON tr.NumeroSerieValidador = d.NumeroSerie
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
    td.NumeroSerieValidador AS numeroSerieValidador,
    td.ControlTransaccion AS controlTransaccion,

    -- Datos del validador
    d.Marca AS marcaValidador,
    d.Modelo AS modeloValidador,

    -- Pasajero (vía Monedero)
    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero

FROM TransaccionesDebito td
INNER JOIN CatTiposTransacciones ctt 
    ON td.IdTipoTransaccion = ctt.Id
LEFT JOIN Validadores d 
    ON td.NumeroSerieValidador = d.NumeroSerie
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
