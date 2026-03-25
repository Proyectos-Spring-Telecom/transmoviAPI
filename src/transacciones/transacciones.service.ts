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
  ApiCrudTransaccionRecarga,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { MonederosService } from 'src/monederos/monederos.service';
import { PasajerosService } from 'src/pasajeros/pasajeros.service';
import { Clientes } from 'src/entities/Clientes';
import { CreateTransaccioneDebitoDto } from './dto/create-transaccione-debito.dto';
import {
  EnumControlTarifaIncremental,
  EnumControlTransacciones,
  EnumModulos,
  EnumTipoDescuento,
  EnumTipoTarifa,
  EnumTipoTransaccion,
  EstatusEnum,
} from 'src/common/estatus.enum';
import {
  transicionarEstado,
  EstadoTransaccion,
  EventoTransaccion,
} from '../utils/transaccion.util';
import { horaDesfasada } from 'src/utils/correccion-hora';
import { Monederos } from 'src/entities/Monederos';
import { CatTiposPasajeros } from 'src/entities/CatTiposPasajeros';
import { HistoricoTransaccionesDebito } from 'src/entities/HistoricoTransaccionesDebito';
import { HistoricoTransaccionesRecarga } from 'src/entities/HistoricoTransaccionesRecarga';
import { UpdateTransaccioneDebitoDto } from './dto/update-transaccione-debito.dto';
import { GetTransaccioneDto } from './dto/get-transacciones.dto';
import { Viajes } from 'src/entities/Viajes';
import { calcularDistanciaHastaIndex, calcularDistanciaReal, snapToRoute } from 'src/utils/recorrido.utils';
import { CatMetodoPago } from 'src/entities/CatMetodoPago';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, QueryRunner } from 'typeorm';

@Injectable()
export class TransaccionesService {
  constructor(
    @InjectRepository(TransaccionesRecarga)
    private readonly transaccionesrecargaRepository: Repository<TransaccionesRecarga>,
    @InjectRepository(TransaccionesDebito)
    private readonly transaccionesdebitoRepository: Repository<TransaccionesDebito>,
    @InjectRepository(HistoricoTransaccionesDebito)
    private readonly historicoTransaccionesDebitoRepository: Repository<HistoricoTransaccionesDebito>,
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Clientes)
    private readonly clienteRepository: Repository<Clientes>,
    @InjectRepository(Monederos)
    private readonly monederosRepository: Repository<Monederos>,
    @InjectRepository(CatTiposPasajeros)
    private readonly CatTiposPasajerosRepository: Repository<CatTiposPasajeros>,
    @InjectRepository(Monederos)
    private readonly monederoRepository: Repository<Monederos>,
    @InjectRepository(Viajes)
    private readonly viajesRepository: Repository<Viajes>,
    @InjectRepository(CatMetodoPago)
    private readonly catMetodoPagoRepository: Repository<CatMetodoPago>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly monederosService: MonederosService,
    private readonly pasajeroService: PasajerosService,
  ) { }

  /** Ventana en ms para permitir varias transacciones abiertas: 1 min 20 s desde la primera. */
  private static readonly VENTANA_ABIERTAS_MS = 80 * 1000;

  /**
   * Actualiza el saldo del monedero sin conflicto de locks.
   * Si se proporciona `manager` (misma transacción/QueryRunner), usa ese manager.
   * Si no, delega en MonederosService (transacción independiente).
   * Nunca mezclar: dentro de una transacción con lock en Monederos solo actualizar vía manager.
   */
  private async updateMonederoSaldoSafe(
    manager: EntityManager | null | undefined,
    monederoId: number,
    numeroSerie: string,
    saldo: number,
    idUser: number,
  ): Promise<void> {
    if (manager) {
      await manager.getRepository(Monederos).update({ id: monederoId }, { saldo });
      return;
    }
    await this.monederosService.updateMonederoSaldo(numeroSerie, idUser, saldo);
  }

  // ========================================
  // 🔹 CREAR TRANSACCIÓN DE RECARGA (CON TRANSACCIÓN ATÓMICA)
  // ========================================
  /**
   * Crea una transacción de recarga usando QueryRunner para garantizar atomicidad.
   * Flujo:
   * 1. Obtiene el saldo actual del monedero
   * 2. Calcula el saldo final (saldo actual + monto de recarga)
   * 3. Actualiza el saldo del monedero
   * 4. Inserta la transacción en TransaccionesRecarga
   * 5. Inserta los mismos datos en HistoricoTransaccionesRecarga
   * 6. Registra el evento exitoso en la bitácora
   * 
   * Si ocurre un error en cualquier paso, se hace rollback de toda la transacción.
   */
  async createTransaccionRecarga(
    createTransaccioneRecargaDto: CreateTransaccioneRecargaDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    // CRÍTICO: Transacción atómica para evitar estados inconsistentes (monedero vs. transacción/histórico).
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let monedero;
      // Repositorios dentro de la misma transacción para commit/rollback unificado.
      const transaccionesRecargaRepo = queryRunner.manager.getRepository(TransaccionesRecarga);
      const historicoTransaccionesRecargaRepo = queryRunner.manager.getRepository(HistoricoTransaccionesRecarga);
      const monederoRepo = queryRunner.manager.getRepository(Monederos);
      const catMetodoPagoRepo = queryRunner.manager.getRepository(CatMetodoPago);

      if (!createTransaccioneRecargaDto.idCardMonedero && !createTransaccioneRecargaDto.numeroSerieMonedero) {
        throw new BadRequestException('Debe proporcionarse al menos uno de los campos requeridos: número de serie del monedero o ID Card.');
      }

      // CRÍTICO: Validar que el monedero existe y está activo (estatus = 1).
      if (createTransaccioneRecargaDto.idCardMonedero) {
        monedero = await this.monederoRepository.findOne({
          where:
            { idCard: createTransaccioneRecargaDto.idCardMonedero, estatus: 1 }
        });
      } else if (createTransaccioneRecargaDto.numeroSerieMonedero) {
        monedero = await this.monederoRepository.findOne({
          where:
            { numeroSerie: createTransaccioneRecargaDto.numeroSerieMonedero, estatus: 1, }
        });
      } else {
        throw new BadRequestException('Debe proporcionarse al menos uno de los campos requeridos: número de serie del monedero o ID Card.');
      }

      if (!monedero) {
        throw new NotFoundException(
          `Monedero con número de serie ${createTransaccioneRecargaDto.numeroSerieMonedero} no encontrado o inactivo.`,
        );
      }

      const { fechaActual } = await horaDesfasada();
      createTransaccioneRecargaDto.numeroSerieMonedero = monedero.numeroSerie;
      createTransaccioneRecargaDto.fechaHoraFinal = fechaActual;

      // CRÍTICO: Validar que el método de pago existe antes de crear la transacción.
      const metodoPago = await catMetodoPagoRepo.findOne({
        where: { id: createTransaccioneRecargaDto.idMetodoPago },
      });

      if (!metodoPago) {
        throw new NotFoundException(
          `Método de pago con ID ${createTransaccioneRecargaDto.idMetodoPago} no encontrado.`,
        );
      }

      // CRÍTICO: Cálculo del saldo final. Recarga = suma; debe coincidir con el update al monedero.
      const saldoActual = Number(monedero.saldo);
      const montoRecarga = Number(createTransaccioneRecargaDto.monto);
      const montoFinal = saldoActual + montoRecarga;

      // CRÍTICO: Orden de escritura. 1) Insertar TransaccionesRecarga; 2) Actualizar Monederos; 3) Insertar Historico.
      const newTransaccion = transaccionesRecargaRepo.create({
        ...createTransaccioneRecargaDto,
        idTipoTransaccion: EnumTipoTransaccion.RECARGA,
        idUsuario: idUser,
        contexto: 'Transaccion realizada de manera correcta',
      });
      const transaccionSave = await transaccionesRecargaRepo.save(newTransaccion);

      await monederoRepo.update(
        { id: monedero.id },
        { saldo: montoFinal },
      );

      const historicoRecarga = historicoTransaccionesRecargaRepo.create({
        idTipoTransaccion: transaccionSave.idTipoTransaccion,
        controlTransaccion: transaccionSave.controlTransaccion ?? null,
        monto: transaccionSave.monto,
        idMetodoPago: transaccionSave.idMetodoPago ?? null,
        latitudFinal: transaccionSave.latitudFinal ?? null,
        longitudFinal: transaccionSave.longitudFinal ?? null,
        fechaHoraFinal: transaccionSave.fechaHoraFinal,
        fhRegistro: transaccionSave.fhRegistro,
        numeroSerieMonedero: transaccionSave.numeroSerieMonedero,
        numeroSerieDispositivo: transaccionSave.numeroSerieDispositivo ?? null,
        idUsuario: transaccionSave.idUsuario ?? null,
        contexto: 'Transaccion realizada de manera correcta',
      });
      await historicoTransaccionesRecargaRepo.save(historicoRecarga);

      await queryRunner.commitTransaction();

      // Bitácora fuera de la transacción; ya se hizo commit.
      const querylogger = { createTransaccioneRecargaDto };
      await this.bitacoraLogger.logToBitacora(
        'Transacciones',
        `Se realizó una transacción de tipo RECARGA. Monto: ${montoRecarga}, Saldo final: ${montoFinal}`,
        'CREATE',
        querylogger,
        idUser,
        EnumModulos.TRANSACCIONES,
        EstatusEnumBitcora.SUCCESS,
      );

      const result: ApiCrudTransaccionRecarga = {
        status: 'success',
        message: 'Transacción creada correctamente',
        montoFinal: montoFinal,
        fechaFinal: transaccionSave.fhRegistro,
        metodoPago: metodoPago.nombre,
        contexto: 'Transaccion realizada de manera correcta',
      };
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();

      // Log estructurado solo en fallo; evita duplicar con bitácora. Útil para depuración en servidor.
      console.error('[createTransaccionRecarga]', error?.message ?? error);

      const querylogger = { createTransaccioneRecargaDto };
      await this.bitacoraLogger.logToBitacora(
        'Transacciones',
        `Error al crear transacción de recarga`,
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
      throw new InternalServerErrorException({
        message: 'Error al generar la transacción de recarga',
        error: error.message,
      });
    } finally {
      // CRÍTICO: Siempre liberar el QueryRunner para no dejar conexiones colgadas.
      await queryRunner.release();
    }
  }

  // ========================================
  // 🔹 CREAR TRANSACCIÓN DE DÉBITO (CON TRANSACCIÓN ATÓMICA)
  // ========================================
  /**
   * Facade para creación/cierre de transacciones de débito.
   * Delega en createOrCloseTransaccionDebito (servicio unificado create+close).
   * La lógica crítica (ventana 1m20s, transacciones abiertas, cierre, creación) está allí.
   */
  async createTransaccionDebitoPrueba(
    createTransaccioneDebitoDto: CreateTransaccioneDebitoDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    // CRÍTICO: Toda la lógica atómica y de negocio vive en createOrCloseTransaccionDebito (QueryRunner, locks, bitácora).
    return this.createOrCloseTransaccionDebito(createTransaccioneDebitoDto, idUser);
  }

  // ========================================
  // 🔹 HELPER: Transacciones abiertas
  // ========================================
  /**
   * Obtiene transacciones abiertas del monedero ordenadas por FHRegistro ASC (la primera = más antigua).
   * Usa manager del QueryRunner cuando se ejecuta dentro de una transacción.
   */
  private async findOpenTransaccionesDebito(
    manager: { getRepository: (entity: any) => Repository<TransaccionesDebito> },
    numeroSerieMonedero: string,
  ): Promise<TransaccionesDebito[]> {
    const repo = manager.getRepository(TransaccionesDebito);
    return repo.find({
      where: {
        numeroSerieMonedero,
        idControlTransaccion: EnumControlTransacciones.ABIERTA,
      },
      order: { fhRegistro: 'ASC' },
    });
  }

  async findTarifaByOtherViaje(idViaje: number) {

    const query = `
SELECT
	-- Datos de entidad Viajes
	v.Id AS idViajes,
    v.Estatus AS estatusViaje,
    us.Id AS idUsuario,
    us.Nombre AS nombreOperador,
	-- Datos del Turnos
    tu.Id AS idTurno,
    tu.Estatus AS estatusTurno,
    -- Datos del Dispositivos
    dp.NumeroSerie AS numeroSerieDispositivo,
    -- Datos de entidad Derrotero
    d.Id As idDerrotero,
    d.RecorridoInterpolar AS  recorridoInterpolar,
    d.DistanciaKm AS distanciaKm,
    -- Datos de entidad Tarifas
    t.Id AS idTarifa,
    t.TarifaBase AS tarifaBase,
    t.DistanciaBaseKm AS DistanciaBaseKm,
    t.IncrementoCadaMetros AS incrementoCadaMetros,
    t.CostoAdicional AS costoAdicional,
    t.TipoTarifa AS tipoTarifa
    
FROM Viajes v
INNER JOIN Operadores op ON op.Id = v.IdOperador
INNER JOIN Usuarios us ON us.Id = op.IdUsuario
INNER JOIN Turnos tu ON tu.Id = v.IdTurno
INNER JOIN Instalaciones i ON i.Id = tu.IdInstalacion
INNER JOIN Dispositivos dp ON dp.Id = i.IdDispositivo
INNER JOIN Derroteros d ON d.Id  = v.IdDerrotero
INNER JOIN Tarifas t ON t.IdDerrotero = d.Id

WHERE v.Id = ${idViaje}
    `
    return await this.viajesRepository.query(query);
  }

  // ========================================
  // 🔹 Cerrar transacciones abiertas de un viaje
  // ========================================

  /**
   * Cierra transacciones abiertas de un viaje.
   * Si se invoca desde createOrCloseTransaccionDebito, debe recibir queryRunner
   * para que todas las actualizaciones (incl. Monederos) usen la misma transacción y se eviten conflictos de locks.
   */
  async viajeCierre(idViaje: number, queryRunner?: QueryRunner) {
    try {
      let montoCalculado;
      let controlTransaccion;
      let distancia;
      let distanciaInicial;
      let metrosBase;

      // 🔹 BÚSQUEDA DEL VIAJE: Se valida que el viaje exista
      const viaje = await this.viajesRepository.findOne({ where: { id: idViaje } });
      if (!viaje) {
        throw new NotFoundException(`Viaje con ID ${idViaje} no encontrado`);
      }

      const transacciones = await this.transaccionesdebitoRepository.find({ where: { idViajes: idViaje, idControlTransaccion: EnumControlTransacciones.ABIERTA } });

      // CRÍTICO: Si hay transacciones abiertas, calcular monto por cada una según tarifa (estacionaria vs incremental).
      if (transacciones.length > 0) {
        const viajeData = await this.findTarifaByOtherViaje(idViaje);
        const {
          idUsuario,
          estatusTurno,
          estatusViaje,
          recorridoInterpolar,
          distanciaKm,
          tarifaBase,
          DistanciaBaseKm,
          incrementoCadaMetros,
          costoAdicional,
          tipoTarifa
        } = viajeData[0];

        for (const i of transacciones) {
          const { latitudInicial, longitudInicial } = i;
          if (latitudInicial && longitudInicial) {
            const posicionActual = { lat: latitudInicial, lng: longitudInicial };

            switch (tipoTarifa) {
              case EnumTipoTarifa.ESTACIONARIA:
                montoCalculado = tarifaBase;
                controlTransaccion = EnumControlTransacciones.PAGADO;

                // CRÍTICO: Coordenadas finales = último punto del derrotero (decimal 10,7).
                const ultimoPunto1 = recorridoInterpolar.length - 1;
                const { lat: latitudFinal1Raw, lng: longitudFinal1Raw } = recorridoInterpolar[ultimoPunto1];
                // Formatear a decimal(10,7) - 7 decimales
                const latitudFinal1 = parseFloat(Number(latitudFinal1Raw).toFixed(7));
                const longitudFinal1 = parseFloat(Number(longitudFinal1Raw).toFixed(7));

                await this.createTransaccionDebitoByViajes(
                  montoCalculado,
                  latitudInicial,
                  longitudInicial,
                  i.fechaHoraInicio || new Date(),
                  distancia,
                  latitudFinal1,
                  longitudFinal1,
                  i.numeroSerieDispositivo,
                  idViaje,
                  i.numeroSerieMonedero,
                  idUsuario,
                  i.id,
                  undefined,
                  queryRunner,
                )
                break;
              case EnumTipoTarifa.INCREMENTAL:
                // CRÍTICO: snapToRoute → índice más cercano en recorrido; luego distancia hasta penúltimo + último tramo (máx 150 m).
                const { index, distanciaMetros } = await snapToRoute(
                  posicionActual,
                  recorridoInterpolar
                );

                const indexSeguro = Math.max(index - 1, 0);
                const metrosRecorridos = await calcularDistanciaHastaIndex(
                  recorridoInterpolar,
                  indexSeguro
                );

                const punto = [indexSeguro === 0 ? recorridoInterpolar[index] : recorridoInterpolar[index - 1], posicionActual];
                let ultimoIndex = await calcularDistanciaReal(punto);
                ultimoIndex = ultimoIndex > 150 ? 150 : ultimoIndex;
                distanciaInicial = Math.round(metrosRecorridos + ultimoIndex);
                distancia = Math.round((distanciaKm * 1000) - distanciaInicial);
                metrosBase = (DistanciaBaseKm * 1000);
                montoCalculado = distancia <= metrosBase ? tarifaBase : (tarifaBase + (Math.trunc((distancia - metrosBase) / (incrementoCadaMetros))) * costoAdicional);
                controlTransaccion = EnumControlTransacciones.ABIERTA;

                const ultimoPunto = recorridoInterpolar.length - 1;
                const { lat: latitudFinal, lng: longitudFinal } = recorridoInterpolar[ultimoPunto];
                const latitudFinalRaw = parseFloat(Number(latitudFinal).toFixed(7));
                const longitudFinalRaw = parseFloat(Number(longitudFinal).toFixed(7));

                await this.createTransaccionDebitoByViajes(
                  montoCalculado,
                  latitudInicial,
                  longitudInicial,
                  i.fechaHoraInicio || new Date(),
                  distancia,
                  latitudFinalRaw,
                  longitudFinalRaw,
                  i.numeroSerieDispositivo,
                  idViaje,
                  i.numeroSerieMonedero,
                  idUsuario,
                  i.id,
                  undefined,
                  queryRunner,
                );

                break;

              default:
                break;
            }
          }
        }

      }

    } catch (error) {
      console.error('[viajeCierre]', error?.message ?? error);
      // Registro en la bitácora FAIL
      /* const querylogger = { updateViajeDto };
      await this.bitacoraLogger.logToBitacora(
        'Viajes',
        `Error al actualizar el viaje con ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.VIAJES,
        EstatusEnumBitcora.ERROR,
        error.message,
      ); */

      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al cerrar las transacciones abiertas de un viaje',
        error: error.message,
      });
    }
  }

  /**
   * Ejecuta el cierre de una transacción abierta.
   * Encapsula la lógica de updateTransaccionDebito: montoTarifa (FINAL), descuentos, validación de saldo;
   * si insuficiente → RECHAZO + histórico; si OK → actualiza monedero, transacción a PAGADO, histórico.
   * Reutilizada por updateTransaccionDebito y createOrCloseTransaccionDebito. Sin duplicar lógica.
   * Todo dentro del QueryRunner. Bloqueo pesimista para evitar race conditions.
   */
  private async ejecutarCierreTransaccionAbierta(
    queryRunner: QueryRunner,
    idTransaccion: number,
    dto: { latitud: number; longitud: number; numeroSerieDispositivo: string; idViaje: number },
    monedero: Monederos,
    _idUser: number,
  ): Promise<{ closedAsPagado: boolean; historicoId?: number; historicoTransaccion?: object; }> {
    const transaccionesDebitoRepo = queryRunner.manager.getRepository(TransaccionesDebito);
    const historicoTransaccionesDebitoRepo = queryRunner.manager.getRepository(HistoricoTransaccionesDebito);
    const monederoRepo = queryRunner.manager.getRepository(Monederos);
    const catTiposPasajerosRepo = queryRunner.manager.getRepository(CatTiposPasajeros);

    const idUsuario = await this.obtenerIdUsuarioPasajero(monedero.numeroSerie);
    const viajeData = await this.findTarifa(dto.idViaje);
    if (!viajeData || viajeData.length === 0) {
      throw new NotFoundException(`No se encontraron datos de tarifa para el viaje ${dto.idViaje}`);
    }
    const {
      estatusTurno,
      estatusViaje,
      recorridoInterpolar,
      distanciaKm,
      tarifaBase,
      DistanciaBaseKm,
      incrementoCadaMetros,
      costoAdicional,
      tipoTarifa,
    } = viajeData[0];
    if (!estatusTurno || !estatusViaje) {
      throw new BadRequestException(`Transacción realizada fuera del viaje o del turno.`);
    }

    // CRÍTICO: Bloqueo pesimista para evitar race conditions al cerrar y actualizar monedero.
    const transaccionFind = await transaccionesDebitoRepo.findOne({
      where: { id: idTransaccion },
      lock: { mode: 'pessimistic_write' },
    });
    if (!transaccionFind) {
      throw new NotFoundException('La transacción a cerrar no existe');
    }

    const controlTarifaIncremental = EnumControlTarifaIncremental.FINAL;
    const { montoCalculado, controlTransaccion, distanciaInicial } = await this.montoTarifa(
      recorridoInterpolar,
      distanciaKm,
      tarifaBase,
      DistanciaBaseKm,
      incrementoCadaMetros,
      costoAdicional,
      tipoTarifa,
      Number(dto.latitud),
      Number(dto.longitud),
      controlTarifaIncremental,
      transaccionFind.distanciaInicialKm ?? 0,
    );

    let montoConDescuento = montoCalculado;
    if (monedero.idTipoPasajero) {
      const tipoPasajero = await catTiposPasajerosRepo.findOne({
        where: { id: monedero.idTipoPasajero },
        relations: ['CatTipoDescuento'],
      });
      if (tipoPasajero && tipoPasajero.idCatTipoDescuento) {
        const tipoDescuento = Number(tipoPasajero.idCatTipoDescuento);
        const cantidad = tipoPasajero.cantidad || 0;
        switch (tipoDescuento) {
          case Number(EnumTipoDescuento.PORCENTAJE):
            montoConDescuento = montoConDescuento - (montoConDescuento * cantidad) / 100;
            break;
          case EnumTipoDescuento.MONETARIO:
            montoConDescuento = montoConDescuento - cantidad;
            break;
          default:
            break;
        }
      }
    }

    const montoFinal = Number(monedero.saldo) - montoConDescuento;
    const { fechaDesfasada } = await horaDesfasada();

    if (montoFinal < 0) {
      await transaccionesDebitoRepo.update(idTransaccion, {
        idTipoTransaccion: EnumTipoTransaccion.RECHAZO,
        monto: montoConDescuento,
        idControlTransaccion: EnumControlTransacciones.PAGADO,
        latitudFinal: dto.latitud,
        longitudFinal: dto.longitud,
        fechaHoraFinal: fechaDesfasada,
        contexto: 'Transaccion rechazada: saldo insuficiente',
      });
      const transaccionRechazo = await transaccionesDebitoRepo.findOne({
        where: { id: idTransaccion },
      });
      if (!transaccionRechazo) throw new NotFoundException('No se pudo recuperar la transacción actualizada');
      const historicoRechazo = historicoTransaccionesDebitoRepo.create({
        idTipoTransaccion: transaccionRechazo.idTipoTransaccion,
        monto: transaccionRechazo.monto,
        idControlTransaccion: transaccionRechazo.idControlTransaccion,
        latitudInicial: transaccionRechazo.latitudInicial,
        longitudInicial: transaccionRechazo.longitudInicial,
        fechaHoraInicio: transaccionRechazo.fechaHoraInicio,
        distanciaInicialKm: transaccionRechazo.distanciaInicialKm,
        latitudFinal: dto.latitud,
        longitudFinal: dto.longitud,
        fechaHoraFinal: fechaDesfasada,
        numeroSerieMonedero: transaccionRechazo.numeroSerieMonedero,
        numeroSerieDispositivo: transaccionRechazo.numeroSerieDispositivo,
        idViajes: transaccionRechazo.idViajes,
        idUsuario: transaccionRechazo.idUsuario,
        contexto: 'Transaccion rechazada: saldo insuficiente',
      });
      const histRechazo = await historicoTransaccionesDebitoRepo.save(historicoRechazo);
      return { closedAsPagado: false, historicoId: Number(histRechazo.id) };
    }

    await monederoRepo.update({ id: monedero.id }, { saldo: montoFinal });
    await transaccionesDebitoRepo.update(idTransaccion, {
      idTipoTransaccion: EnumTipoTransaccion.DEBITO,
      monto: montoConDescuento,
      idControlTransaccion: EnumControlTransacciones.PAGADO,
      latitudFinal: dto.latitud,
      longitudFinal: dto.longitud,
      fechaHoraFinal: fechaDesfasada,
      contexto: 'Transaccion realizada de manera correcta',
    });
    const transaccionSave = await transaccionesDebitoRepo.findOne({
      where: { id: idTransaccion },
    });
    if (!transaccionSave) throw new NotFoundException('No se pudo recuperar la transacción actualizada');
    const historicoTransaccion = historicoTransaccionesDebitoRepo.create({
      idTipoTransaccion: transaccionSave.idTipoTransaccion,
      monto: transaccionSave.monto,
      idControlTransaccion: transaccionSave.idControlTransaccion,
      latitudInicial: transaccionSave.latitudInicial,
      longitudInicial: transaccionSave.longitudInicial,
      fechaHoraInicio: transaccionSave.fechaHoraInicio,
      distanciaInicialKm: transaccionSave.distanciaInicialKm,
      latitudFinal: transaccionSave.latitudFinal,
      longitudFinal: transaccionSave.longitudFinal,
      fechaHoraFinal: transaccionSave.fechaHoraFinal,
      numeroSerieMonedero: transaccionSave.numeroSerieMonedero,
      numeroSerieDispositivo: transaccionSave.numeroSerieDispositivo,
      idViajes: transaccionSave.idViajes,
      idUsuario: transaccionSave.idUsuario,
      contexto: 'Transaccion realizada de manera correcta',
    });
    const histSaved = await historicoTransaccionesDebitoRepo.save(historicoTransaccion);
    return { closedAsPagado: true, historicoId: Number(histSaved.id), historicoTransaccion: histSaved || null };
  }

  // ========================================
  // 🔹 CREAR O CERRAR TRANSACCIÓN DÉBITO (UNIFICADO)
  // ========================================
  /**
   * Servicio unificado: crear y/o cerrar transacción de débito.
   *
   * Reglas (solo por tiempo, FHRegistro de la primera abierta):
   * - Verifica transacciones abiertas antes de crear.
   * - Obtiene la hora de creación de la primera (más antigua) desde FHRegistro.
   * - Si NO pasa de 1 min 20 s: crea otra transacción (no cierra las existentes).
   * - Si pasa de 1 min 20 s: cierra la primera, registra en bitácora y retorna (no crea nueva).
   * - Reutiliza montoTarifa, descuentos y creación. QueryRunner + bloqueo pesimista.
   */
  async createOrCloseTransaccionDebito(
    createTransaccioneDebitoDto: CreateTransaccioneDebitoDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    console.log('[createOrCloseTransaccionDebito] 1. Iniciando QueryRunner y transacción BD', {
      idUser,
      idViaje: createTransaccioneDebitoDto.idViaje,
    });
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const transaccionesDebitoRepo = queryRunner.manager.getRepository(TransaccionesDebito);
    const historicoTransaccionesDebitoRepo = queryRunner.manager.getRepository(HistoricoTransaccionesDebito);
    const monederoRepo = queryRunner.manager.getRepository(Monederos);
    const catTiposPasajerosRepo = queryRunner.manager.getRepository(CatTiposPasajeros);

    try {
      const viajeFlag = await this.findTarifa(createTransaccioneDebitoDto.idViaje);
      console.log('[createOrCloseTransaccionDebito] 2. Validación viaje/dispositivo', {
        estatusViaje: viajeFlag[0]?.estatusViaje,
        numeroSerieViaje: viajeFlag[0]?.numeroSerieDispositivo,
        numeroSerieRequest: createTransaccioneDebitoDto.numeroSerieDispositivo,
      });
      if (viajeFlag[0].estatusViaje === EstatusEnum.INACTIVO || viajeFlag[0].numeroSerieDispositivo !== createTransaccioneDebitoDto.numeroSerieDispositivo) {
        throw new BadRequestException(`El viaje ${createTransaccioneDebitoDto.idViaje} no esta activo o el dispositivo ${createTransaccioneDebitoDto.numeroSerieDispositivo} no es el mismo que el dispositivo del viaje`);
      }
      if (!createTransaccioneDebitoDto.idCardMonedero && !createTransaccioneDebitoDto.numeroSerieMonedero) {
        throw new BadRequestException('Debe proporcionarse al menos uno de los campos requeridos: número de serie del monedero o ID Card.');
      }
      let monedero: Monederos | null = null;
      if (createTransaccioneDebitoDto.idCardMonedero) {
        monedero = await monederoRepo.findOne({
          where: { idCard: createTransaccioneDebitoDto.idCardMonedero, estatus: 1 },
          lock: { mode: 'pessimistic_write' },
        });
      } else if (createTransaccioneDebitoDto.numeroSerieMonedero) {
        monedero = await monederoRepo.findOne({
          where: { numeroSerie: createTransaccioneDebitoDto.numeroSerieMonedero, estatus: 1 },
          lock: { mode: 'pessimistic_write' },
        });
      }
      if (!monedero) {
        throw new BadRequestException('Monedero no encontrado');
      }
      console.log('[createOrCloseTransaccionDebito] 3. Monedero bloqueado (pessimistic_write)', {
        idMonedero: monedero.id,
        numeroSerie: monedero.numeroSerie,
        saldo: monedero.saldo,
      });
      createTransaccioneDebitoDto.numeroSerieMonedero = monedero.numeroSerie;

      const openList = await this.findOpenTransaccionesDebito(queryRunner.manager, monedero.numeroSerie);
      console.log('[createOrCloseTransaccionDebito] 4. Transacciones débito ABIERTAS del monedero', {
        cantidad: openList.length,
        ids: openList.map((o) => o.id),
        idViajes: openList.map((o) => o.idViajes),
      });

      // CRÍTICO: Cerrar transacciones abiertas de otro viaje en la misma transacción. Pasar queryRunner para evitar lock conflict.
      for (const open of openList) {
        if (Number(open.idViajes) !== createTransaccioneDebitoDto.idViaje) {
          console.log('[createOrCloseTransaccionDebito] 5. Cerrando viaje distinto al actual (viajeCierre)', {
            idViajeAbierto: open.idViajes,
            idViajeActual: createTransaccioneDebitoDto.idViaje,
          });
          await this.viajeCierre(Number(open.idViajes), queryRunner);
        }
      }

      //En caso de que la transacciones encontradas sean diferentes al viaje actual, se manda un error
      for (const open of openList) {
        if (Number(open.idViajes) !== createTransaccioneDebitoDto.idViaje) {
          console.log('[createOrCloseTransaccionDebito] 6. Error: aún hay abiertas de otro viaje tras cierre', {
            idViajeConflicto: open.idViajes,
          });
          throw new BadRequestException(`Usted tenia transacciónes del viaje ${open.idViajes} abiertas, estas han sido cerradas correctamente, Pase de nuevo su monedero para poder viajar`);
        }
        continue;
      }

      if (openList.length > 0) {
        const { fechaDesfasada, fechaActual } = await horaDesfasada();
        const first = openList[0];
        const now = fechaDesfasada.getTime();

        // Convertir fhRegistro a timestamp de forma segura
        let firstTime: number;
        if (first.fhRegistro instanceof Date) {
          firstTime = first.fhRegistro.getTime();
        } else if (typeof first.fhRegistro === 'string') {
          firstTime = new Date(first.fhRegistro).getTime();
        } else {
          // Fallback: intentar convertir cualquier otro tipo
          firstTime = new Date(first.fhRegistro as any).getTime();
        }

        // Validar que la conversión fue exitosa
        if (isNaN(firstTime)) {
          throw new InternalServerErrorException(`Error al convertir FHRegistro a fecha: ${first.fhRegistro}`);
        }

        const elapsedMs = now - firstTime;
        // CRÍTICO: Ventana 1m20s desde FHRegistro de la primera abierta. Si se supera, cerrar primera y retornar (no crear nueva).
        const mustCloseFirst = elapsedMs > TransaccionesService.VENTANA_ABIERTAS_MS;
        console.log('[createOrCloseTransaccionDebito] 7. Ventana tiempo primera transacción abierta (mismo viaje)', {
          idPrimeraAbierta: first.id,
          elapsedMs,
          ventanaMaxMs: TransaccionesService.VENTANA_ABIERTAS_MS,
          mustCloseFirst,
        });

        if (mustCloseFirst) {
          const closeDto = {
            latitud: createTransaccioneDebitoDto.latitud,
            longitud: createTransaccioneDebitoDto.longitud,
            numeroSerieDispositivo: first.numeroSerieDispositivo,
            idViaje: Number(first.idViajes),
          };
          const { closedAsPagado, historicoId, historicoTransaccion } = await this.ejecutarCierreTransaccionAbierta(
            queryRunner,
            first.id,
            closeDto,
            monedero,
            idUser,
          );
          if (closedAsPagado) {
            const refreshed = await monederoRepo.findOne({ where: { id: monedero.id } });
            if (refreshed) monedero = refreshed;
          }

          // Si pasa de 1 min 20 s, cerrar la primera y retornar (no crear nueva)
          console.log('[createOrCloseTransaccionDebito] 8. Cierre por tiempo excedido — COMMIT y retorno (no crea nueva)', {
            historicoId,
            closedAsPagado,
          });
          await queryRunner.commitTransaction();
          await queryRunner.release();
          await this.bitacoraLogger.logToBitacora(
            'Transacciones',
            `Transacción de débito cerrada (tiempo excedido)`,
            'UPDATE',
            { historicoTransaccion },
            idUser,
            EnumModulos.TRANSACCIONES,
            EstatusEnumBitcora.SUCCESS,
          );
          return {
            status: 'success',
            message: 'Transacción cerrada correctamente',
            data: {
              id: historicoId ?? first.id,
              nombre: `${monedero.numeroSerie}`,
              contexto: 'Transaccion cerrada: tiempo excedido (ventana 1m20s superada)',
            },
          };
        }
      }

      console.log('[createOrCloseTransaccionDebito] 9. Calculando tarifa (montoTarifa) y descuentos');
      const idUsuario = await this.obtenerIdUsuarioPasajero(monedero.numeroSerie);
      const viajeData = await this.findTarifa(createTransaccioneDebitoDto.idViaje);
      if (!viajeData || viajeData.length === 0) {
        throw new NotFoundException(`No se encontraron datos de tarifa para el viaje ${createTransaccioneDebitoDto.idViaje}`);
      }
      const {
        estatusTurno,
        estatusViaje,
        recorridoInterpolar,
        distanciaKm,
        tarifaBase,
        DistanciaBaseKm,
        incrementoCadaMetros,
        costoAdicional,
        tipoTarifa,
      } = viajeData[0];
      if (!estatusTurno || !estatusViaje) {
        throw new BadRequestException(`Transacción realizada fuera del viaje o del turno.`);
      }

      const controlTarifaIncremental = EnumControlTarifaIncremental.INICIAL;
      const { montoCalculado, controlTransaccion, distanciaInicial } = await this.montoTarifa(
        recorridoInterpolar,
        distanciaKm,
        tarifaBase,
        DistanciaBaseKm,
        incrementoCadaMetros,
        costoAdicional,
        tipoTarifa,
        Number(createTransaccioneDebitoDto.latitud),
        Number(createTransaccioneDebitoDto.longitud),
        controlTarifaIncremental,
      );

      let montoConDescuento = montoCalculado;
      if (monedero.idTipoPasajero) {
        const tipoPasajero = await catTiposPasajerosRepo.findOne({
          where: { id: monedero.idTipoPasajero },
          relations: ['CatTipoDescuento'],
        });
        if (tipoPasajero && tipoPasajero.idCatTipoDescuento) {
          const tipoDescuento = Number(tipoPasajero.idCatTipoDescuento);
          const cantidad = tipoPasajero.cantidad || 0;
          switch (tipoDescuento) {
            case Number(EnumTipoDescuento.PORCENTAJE):
              montoConDescuento = montoConDescuento - (montoConDescuento * cantidad) / 100;
              break;
            case EnumTipoDescuento.MONETARIO:
              montoConDescuento = montoConDescuento - cantidad;
              break;
            default:
              break;
          }
        }
      }

      const montoFinal = Number(monedero.saldo) - montoConDescuento;
      console.log('[createOrCloseTransaccionDebito] 10. Montos', {
        montoCalculado: montoCalculado,
        montoConDescuento,
        saldoMonedero: monedero.saldo,
        montoFinal,
        controlTransaccion,
      });

      // Obtenemos la fecha con desfase de 6 horas
      const { fechaDesfasada } = await horaDesfasada();

      if (montoFinal < 0) {
        console.log('[createOrCloseTransaccionDebito] 11. Saldo insuficiente — rechazo + histórico');
        const transaccionRechazo = transaccionesDebitoRepo.create({
          idTipoTransaccion: EnumTipoTransaccion.RECHAZO,
          monto: montoConDescuento,
          idControlTransaccion: EnumControlTransacciones.ABIERTA,
          latitudInicial: createTransaccioneDebitoDto.latitud,
          longitudInicial: createTransaccioneDebitoDto.longitud,
          fechaHoraInicio: fechaDesfasada,
          distanciaInicialKm: distanciaInicial,
          numeroSerieMonedero: createTransaccioneDebitoDto.numeroSerieMonedero,
          numeroSerieDispositivo: createTransaccioneDebitoDto.numeroSerieDispositivo,
          idViajes: createTransaccioneDebitoDto.idViaje,
          idUsuario: idUsuario,
          contexto: 'Transaccion rechazada: saldo insuficiente',
        });
        const transaccionRechazoSave = await transaccionesDebitoRepo.save(transaccionRechazo);
        const historicoRechazo = historicoTransaccionesDebitoRepo.create({
          idTipoTransaccion: transaccionRechazoSave.idTipoTransaccion,
          monto: transaccionRechazoSave.monto,
          idControlTransaccion: transaccionRechazoSave.idControlTransaccion,
          latitudInicial: transaccionRechazoSave.latitudInicial,
          longitudInicial: transaccionRechazoSave.longitudInicial,
          fechaHoraInicio: transaccionRechazoSave.fechaHoraInicio,
          distanciaInicialKm: transaccionRechazoSave.distanciaInicialKm,
          numeroSerieMonedero: transaccionRechazoSave.numeroSerieMonedero,
          numeroSerieDispositivo: transaccionRechazoSave.numeroSerieDispositivo,
          idViajes: transaccionRechazoSave.idViajes,
          idUsuario: transaccionRechazoSave.idUsuario,
          contexto: 'Transaccion rechazada: saldo insuficiente',
        });
        await historicoTransaccionesDebitoRepo.save(historicoRechazo);
        await queryRunner.commitTransaction();
        await queryRunner.release();
        await this.bitacoraLogger.logToBitacora(
          'Transacciones',
          `Transacción de débito RECHAZADA por saldo insuficiente`,
          'CREATE',
          { transaccionRechazo: transaccionRechazoSave },
          idUser,
          EnumModulos.TRANSACCIONES,
          EstatusEnumBitcora.ERROR,
          'Saldo insuficiente',
        );
        throw new BadRequestException('Saldo insuficiente');
      }

      const bodyTransaccionDebito: Record<string, unknown> = {
        idTipoTransaccion: EnumTipoTransaccion.DEBITO,
        monto: montoConDescuento,
        idControlTransaccion: EnumControlTransacciones.ABIERTA,
        latitudInicial: createTransaccioneDebitoDto.latitud,
        longitudInicial: createTransaccioneDebitoDto.longitud,
        fechaHoraInicio: fechaDesfasada,
        distanciaInicialKm: distanciaInicial,
        numeroSerieMonedero: createTransaccioneDebitoDto.numeroSerieMonedero,
        numeroSerieDispositivo: createTransaccioneDebitoDto.numeroSerieDispositivo,
        idViajes: createTransaccioneDebitoDto.idViaje,
        idUsuario: idUsuario,
        contexto: controlTransaccion === EnumControlTransacciones.PAGADO
          ? 'Transaccion realizada de manera correcta'
          : 'Transaccion abierta correctamente',
      };

      if (controlTransaccion === EnumControlTransacciones.ABIERTA) {
        (bodyTransaccionDebito as any).monto = 0;
        (bodyTransaccionDebito as any).idControlTransaccion = EnumControlTransacciones.ABIERTA;
      } else {
        await monederoRepo.update({ id: monedero.id }, { saldo: montoFinal });
        (bodyTransaccionDebito as any).monto = montoConDescuento;
        (bodyTransaccionDebito as any).idControlTransaccion = EnumControlTransacciones.PAGADO;
      }

      const newTransaccion = transaccionesDebitoRepo.create(bodyTransaccionDebito as Partial<TransaccionesDebito>);
      (newTransaccion as any).idTipoTransaccion = EnumTipoTransaccion.DEBITO;
      const transaccionSave = await transaccionesDebitoRepo.save(newTransaccion);
      console.log('[createOrCloseTransaccionDebito] 12. Transacción débito guardada', {
        id: transaccionSave.id,
        idControlTransaccion: transaccionSave.idControlTransaccion,
        monto: transaccionSave.monto,
      });

      let transaccionSaveHis;

      // Se guardará la transacción en el histórico solamente cuando controlTransaccion sea PAGADO
      if (controlTransaccion === EnumControlTransacciones.PAGADO) {
        const historicoTransaccion = historicoTransaccionesDebitoRepo.create({
          idTipoTransaccion: transaccionSave.idTipoTransaccion,
          monto: transaccionSave.monto,
          idControlTransaccion: transaccionSave.idControlTransaccion,
          latitudInicial: transaccionSave.latitudInicial,
          longitudInicial: transaccionSave.longitudInicial,
          fechaHoraInicio: transaccionSave.fechaHoraInicio,
          distanciaInicialKm: transaccionSave.distanciaInicialKm,
          latitudFinal: createTransaccioneDebitoDto.latitud,
          longitudFinal: createTransaccioneDebitoDto.longitud,
          fechaHoraFinal: fechaDesfasada,
          numeroSerieMonedero: transaccionSave.numeroSerieMonedero,
          numeroSerieDispositivo: transaccionSave.numeroSerieDispositivo,
          idViajes: transaccionSave.idViajes,
          idUsuario: transaccionSave.idUsuario,
          contexto: 'Transaccion realizada de manera correcta',
        });
        transaccionSaveHis = await historicoTransaccionesDebitoRepo.save(historicoTransaccion);

        await transaccionesDebitoRepo.update(transaccionSave.id, {
          latitudFinal: createTransaccioneDebitoDto.latitud,
          longitudFinal: createTransaccioneDebitoDto.longitud,
          fechaHoraFinal: fechaDesfasada,
        });

        console.log('[createOrCloseTransaccionDebito] 13. Éxito PAGADO — histórico + update + COMMIT', {
          idHistorico: transaccionSaveHis?.id,
        });
        await queryRunner.commitTransaction();
        await queryRunner.release();
        await this.bitacoraLogger.logToBitacora(
          'Transacciones',
          `Transacción de débito APROBADA`,
          'CREATE',
          { bodyTransaccionDebito },
          idUser,
          EnumModulos.TRANSACCIONES,
          EstatusEnumBitcora.SUCCESS,
        );

        return {
          status: 'success',
          message: 'Transacción creada correctamente',
          data: {
            id: Number(transaccionSaveHis.id) || Number(transaccionSave.id),
            nombre: `${monedero.numeroSerie}`,
            contexto: 'Transaccion realizada de manera correcta',
          },
        };
      }

      // Bitácora de éxito (controlTransaccion ABIERTA)
      console.log('[createOrCloseTransaccionDebito] 14. Éxito ABIERTA — COMMIT (sin histórico completo de cierre)');
      await queryRunner.commitTransaction();
      await queryRunner.release();
      await this.bitacoraLogger.logToBitacora(
        'Transacciones',
        `Transacción de débito APROBADA`,
        'CREATE',
        { bodyTransaccionDebito },
        idUser,
        EnumModulos.TRANSACCIONES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Transacción creada correctamente',
        data: {
          id: Number(transaccionSave.id),
          nombre: `${monedero.numeroSerie}`,
          contexto: 'Transaccion abierta correctamente',
        },
      };
    } catch (err) {
      if (queryRunner.isTransactionActive) {
        try {
          await queryRunner.rollbackTransaction();
        } catch (e) {
          console.error('[createOrCloseTransaccionDebito] Error al hacer rollback:', (e as Error)?.message ?? e);
        }
      }
      try {
        await queryRunner.release();
      } catch (e) {
        console.error('[createOrCloseTransaccionDebito] Error al liberar QueryRunner:', (e as Error)?.message ?? e);
      }
      console.error('[createOrCloseTransaccionDebito]', (err as Error)?.message ?? err);
      if (err instanceof HttpException) throw err;
      await this.bitacoraLogger.logToBitacora(
        'Transacciones',
        `Error en transacción de débito`,
        'CREATE',
        { createTransaccioneDebitoDto },
        idUser,
        EnumModulos.TRANSACCIONES,
        EstatusEnumBitcora.ERROR,
        (err as Error).message,
      );
      throw new InternalServerErrorException({
        message: 'Error al generar la transacción de débito',
        error: (err as Error).message,
      });
    }
  }

  /**
   * Obtiene el ID del usuario pasajero asociado a un monedero.
   * Usa query parametrizada para prevenir SQL injection.
   */
  private async obtenerIdUsuarioPasajero(numeroSerieMonedero: string): Promise<number | null> {
    const query = `
SELECT 
    m.Id AS idMonedero,
    p.Id AS idPasajero,
    u.Id AS idUsuarioPasajero,
    u.Nombre AS nombrePasajero,
    u.ApellidoMaterno AS apellidoMaterno
FROM
    Monederos m
        INNER JOIN
    Pasajeros p ON m.IdPasajero = p.Id
        INNER JOIN
    Usuarios u ON p.Correo = u.UserName
WHERE
    m.NumeroSerie = ?
    `;
    const resultado = await this.viajesRepository.query(query, [numeroSerieMonedero]);

    if (resultado.length > 0) {
      return resultado[0].idUsuarioPasajero || null;
    }
    return null;
  }

  // ========================================
  // 🔹 OBTENER DATOS DE TARIFA POR VIAJE
  // ========================================
  /**
   * Obtiene los datos del viaje, turno, derrotero y tarifa para un viaje específico.
   * Usa query parametrizada para prevenir SQL injection.
   */
  async findTarifa(idViaje: number) {
    const query = `
SELECT
	-- Datos de entidad Viajes
	v.Id AS idViajes,
    v.Estatus AS estatusViaje,
	-- Datos del Turnos
    tu.Id AS idTurno,
    tu.Estatus AS estatusTurno,
    -- Datos del Dispositivos
    dp.NumeroSerie AS numeroSerieDispositivo,
    -- Datos de entidad Derrotero
    d.Id As idDerrotero,
    d.RecorridoInterpolar AS  recorridoInterpolar,
    d.DistanciaKm AS distanciaKm,
    -- Datos de entidad Tarifas
    t.Id AS idTarifa,
    t.TarifaBase AS tarifaBase,
    t.DistanciaBaseKm AS DistanciaBaseKm,
    t.IncrementoCadaMetros AS incrementoCadaMetros,
    t.CostoAdicional AS costoAdicional,
    t.TipoTarifa AS tipoTarifa
    
FROM Viajes v
INNER JOIN Turnos tu ON tu.Id = v.IdTurno
INNER JOIN Instalaciones i ON i.Id = tu.IdInstalacion
INNER JOIN Dispositivos dp ON dp.Id = i.IdDispositivo
INNER JOIN Derroteros d ON d.Id  = v.IdDerrotero
INNER JOIN Tarifas t ON t.IdDerrotero = d.Id

WHERE v.Id = ?
    `;
    return await this.viajesRepository.query(query, [idViaje]);
  }

  /**
   * CRÍTICO: Calcula monto y control (PAGADO/ABIERTA) según tarifa estacionaria o incremental.
   * Incremental FINAL: distancia restante = distanciaInicial - DistanciaInicialKm; monto por tramos.
   * Incremental INICIAL: distancia restante = total ruta - distancia hasta posición; ABIERTA.
   */
  async montoTarifa(
    recorridoInterpolar: [],
    distanciaKm: number,
    tarifaBase: number,
    distanciaBaseKm: number,
    incrementoCadaMetros: number,
    costoAdicional: number,
    tipoTarifa: number,
    latitud: number,
    longitud: number,
    controlTarifaIncremental: number,
    DistanciaInicialKm?: number
  ) {
    try {
      let montoCalculado;
      let controlTransaccion;
      let distancia;
      let distanciaInicial;
      let metrosBase;
      switch (tipoTarifa) {
        case EnumTipoTarifa.ESTACIONARIA:
          montoCalculado = tarifaBase;
          controlTransaccion = EnumControlTransacciones.PAGADO;
          distanciaInicial = 0;
          break;

        case EnumTipoTarifa.INCREMENTAL:
          if (controlTarifaIncremental === EnumControlTarifaIncremental.FINAL) {
            const posicionActual = { lat: latitud, lng: longitud };
            const { index, distanciaMetros } = await snapToRoute(
              posicionActual,
              recorridoInterpolar
            );
            const indexSeguro = Math.max(index - 1, 0);
            const metrosRecorridos = await calcularDistanciaHastaIndex(
              recorridoInterpolar,
              indexSeguro
            );
            const punto = [indexSeguro === 0 ? recorridoInterpolar[index] : recorridoInterpolar[index - 1], posicionActual];
            let ultimoIndex = await calcularDistanciaReal(punto);
            ultimoIndex = ultimoIndex > 150 ? 150 : ultimoIndex;
            distanciaInicial = Math.round(metrosRecorridos + ultimoIndex);
            if (!DistanciaInicialKm) DistanciaInicialKm = 0;
            distancia = Math.round(distanciaInicial - DistanciaInicialKm);
            metrosBase = (distanciaBaseKm * 1000);
            montoCalculado = distancia <= metrosBase ? tarifaBase : (tarifaBase + (Math.trunc((distancia - metrosBase) / (incrementoCadaMetros))) * costoAdicional);
            controlTransaccion = EnumControlTransacciones.PAGADO;
          } else {
            const posicionActual = { lat: latitud, lng: longitud };
            const { index, distanciaMetros } = await snapToRoute(
              posicionActual,
              recorridoInterpolar
            );
            const indexSeguro = Math.max(index - 1, 0);
            const metrosRecorridos = await calcularDistanciaHastaIndex(
              recorridoInterpolar,
              indexSeguro
            );
            const punto = [indexSeguro === 0 ? recorridoInterpolar[index] : recorridoInterpolar[index - 1], posicionActual];
            let ultimoIndex = await calcularDistanciaReal(punto);
            ultimoIndex = ultimoIndex > 150 ? 150 : ultimoIndex;
            distanciaInicial = Math.round(metrosRecorridos + ultimoIndex);
            distancia = Math.round((distanciaKm * 1000) - distanciaInicial);
            metrosBase = (distanciaBaseKm * 1000);
            montoCalculado = distancia <= metrosBase ? tarifaBase : (tarifaBase + (Math.trunc((distancia - metrosBase) / (incrementoCadaMetros))) * costoAdicional);
            controlTransaccion = EnumControlTransacciones.ABIERTA;
          }
          break;
        default:
          break;
      }
      return { montoCalculado, controlTransaccion, distanciaInicial };
    } catch (error) {
      console.error('[montoTarifa]', (error as Error)?.message ?? error);
      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException({
        message: 'Error al obtener el monto de la tarifa para transacciones débito',
        error: (error as Error).message,
      });
    }
  }

  // ========================================
  // 🔹 ACTUALIZAR SALDO DEL MONEDERO
  // ========================================
  /**
   * Actualiza el saldo de un monedero por número de serie.
   * CRÍTICO: Validar que el monedero exista antes de actualizar. Registrar en bitácora.
   */
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
      console.error('[updateMonederoSaldo]', (error as Error)?.message ?? error);
      const querylogger = { numeroSerie: numeroSerie, saldo: saldo };
      await this.bitacoraLogger.logToBitacora(
        'Monederos',
        `Se actualizó el saldo del monedero con número de serie: ${numeroSerie}`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.MONEDEROS,
        EstatusEnumBitcora.ERROR,
        (error as Error).message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al actualizar saldo del monedero',
        error: (error as Error).message,
      });
    }
  }

  /** CRÍTICO: Obtiene IDs de clientes hijos para filtrado por jerarquía. Usado en paginado y listados. */
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

  async paginado(
    idUser: number,
    email: string,
    cliente: number,
    rol: number,
    getTransaccioneDto: GetTransaccioneDto
  ) {
    try {
      //Declaramos las variables para el consumo del api
      let { fechaInicio, fechaFin } = getTransaccioneDto
      const { page, limit } = getTransaccioneDto
      let entidadRecarga;
      let entidadDebito;
      let transacciones;

      //Generamos la fecha actual
      function pad(n: number) {
        return n < 10 ? '0' + n : n;
      }
      const ahora = new Date();
      const desfaseMs = -6 * 60 * 60 * 1000; // -6 horas
      const fechaDesfasada = new Date(ahora.getTime() + desfaseMs);
      // Solo la fecha del momento
      const fechaActual = `${fechaDesfasada.getFullYear()}-${pad(fechaDesfasada.getMonth() + 1)}-${pad(fechaDesfasada.getDate())}`;

      //Si fechaInicio y fechaFin son null arroja las transacciones del dia de la tabla TransaccionesRecarga y TransaccionesDebito
      if (!fechaInicio && !fechaFin) {
        fechaInicio = fechaActual
        fechaFin = fechaActual
        entidadRecarga = 'TransaccionesRecarga';
        entidadDebito = 'TransaccionesDebito';
        transacciones = await this.resolverPorRolDefault(fechaInicio, fechaFin, email, cliente, rol, page, limit, entidadDebito, entidadRecarga);
      } else {
        //Si fechaInicio y fechaFin no son null arroja las transacciones del dia de la tabla HistoricoTransaccionesRecarga y HistoricoTransaccionesDebito
        //asigna fechaActual solo si el valor de la izquierda es null o undefined
        fechaInicio = fechaInicio?.split("T")[0] ?? fechaActual;
        fechaFin = fechaFin?.split("T")[0] ?? fechaActual;
        entidadRecarga = 'HistoricoTransaccionesRecarga';
        entidadDebito = 'HistoricoTransaccionesDebito';
        transacciones = await this.resolverPorRolDefault(fechaInicio, fechaFin, email, cliente, rol, page, limit, entidadDebito, entidadRecarga);
      }

      const { data, total } = transacciones

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
      console.error('[paginado]', (error as Error)?.message ?? error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({
        message: 'Error al obtener transacciones paginado.',
      });
    }
  }

  async resolverPorRolDefault(
    fechaInicio: string,
    fechaFin: string,
    email: string,
    cliente: number,
    rol: number,
    page: number,
    limit: number,
    entidadDebito: string,
    entidadRecarga: string
  ) {
    try {
      let totalResult;
      let transacciones;
      const offset = (page - 1) * limit;

      // Preparar fechas para parámetros SQL
      const fechaInicioParam = `${fechaInicio} 00:00:00`;
      const fechaFinParam = `${fechaFin} 23:59:59`;

      // Validar nombres de tablas (whitelist)
      const allowedTables = [
        'TransaccionesDebito',
        'TransaccionesRecarga',
        'HistoricoTransaccionesDebito',
        'HistoricoTransaccionesRecarga'
      ];

      if (!allowedTables.includes(entidadDebito) || !allowedTables.includes(entidadRecarga)) {
        throw new BadRequestException('Nombre de tabla inválido');
      }

      switch (rol) {
        case 1:
          transacciones = await this.transaccionesrecargaRepository.query(
            `
SELECT * FROM (
  SELECT 
      td.Id AS id,
      'DEBITO' AS origenTabla,
      td.IdTipoTransaccion AS idTipoTransaccion,
      ctt.Nombre AS tipoTransaccion,
      td.Monto AS monto,
      td.LatitudInicial AS latitudInicial,
      td.LongitudInicial AS longitudInicial,
      td.FechaHoraInicio AS fechaHoraInicio,
      td.DistanciaInicialKm AS distanciaInicialKm,
      td.LatitudFinal AS latitudFinal,
      td.LongitudFinal AS longitudFinal,
      td.FechaHoraFinal AS fechaHoraFinal,
      td.FHRegistro AS fhRegistro,
      td.IdControlTransaccion AS idControlTransaccion,
      NULL AS controlTransaccion,
      NULL AS idMetodoPago,
      td.NumeroSerieMonedero AS numeroSerieMonedero,
      td.NumeroSerieDispositivo AS numeroSerieDispositivo,
      td.Contexto AS contexto,
      c.Id AS idCliente,
      c.Nombre AS nombreCliente,
      c.ApellidoPaterno AS apellidoPaternoCliente,
      c.ApellidoMaterno AS apellidoMaternoCliente,
      d.Marca AS marcaDispositivo,
      d.Modelo AS modeloDispositivo,
      p.Id AS idPasajero,
      p.Nombre AS nombrePasajero,
      p.ApellidoPaterno AS apellidoPaternoPasajero,
      p.ApellidoMaterno AS apellidoMaternoPasajero,
      u.Id AS idUsuario,
      u.Nombre AS nombreUsuario,
      td.IdViajes AS idViaje
  FROM ${entidadDebito} td
  LEFT JOIN CatTiposTransacciones ctt 
      ON td.IdTipoTransaccion = ctt.Id
  LEFT JOIN Dispositivos d 
      ON td.NumeroSerieDispositivo = d.NumeroSerie
  LEFT JOIN Monederos m 
      ON td.NumeroSerieMonedero = m.NumeroSerie
  LEFT JOIN Pasajeros p 
      ON m.IdPasajero = p.Id
  LEFT JOIN Clientes c
      ON m.IdCliente = c.Id
  LEFT JOIN Usuarios u
      ON td.IdUsuario = u.Id
  WHERE td.FHRegistro BETWEEN ? AND ?
  
  UNION ALL
  
  SELECT 
      tr.Id AS id,
      'RECARGA' AS origenTabla,
      tr.IdTipoTransaccion AS idTipoTransaccion,
      ctt.Nombre AS tipoTransaccion,
      tr.Monto AS monto,
      NULL AS latitudInicial,
      NULL AS longitudInicial,
      NULL AS fechaHoraInicio,
      NULL AS distanciaInicialKm,
      tr.LatitudFinal AS latitudFinal,
      tr.LongitudFinal AS longitudFinal,
      tr.FechaHoraFinal AS fechaHoraFinal,
      tr.FHRegistro AS fhRegistro,
      NULL AS idControlTransaccion,
      tr.ControlTransaccion AS controlTransaccion,
      tr.IdMetodoPago AS idMetodoPago,
      tr.NumeroSerieMonedero AS numeroSerieMonedero,
      tr.NumeroSerieDispositivo AS numeroSerieDispositivo,
      tr.Contexto AS contexto,
      c.Id AS idCliente,
      c.Nombre AS nombreCliente,
      c.ApellidoPaterno AS apellidoPaternoCliente,
      c.ApellidoMaterno AS apellidoMaternoCliente,
      d.Marca AS marcaDispositivo,
      d.Modelo AS modeloDispositivo,
      p.Id AS idPasajero,
      p.Nombre AS nombrePasajero,
      p.ApellidoPaterno AS apellidoPaternoPasajero,
      p.ApellidoMaterno AS apellidoMaternoPasajero,
      u.Id AS idUsuario,
      u.Nombre AS nombreUsuario,
      NULL AS idViaje
  FROM ${entidadRecarga} tr
  LEFT JOIN CatTiposTransacciones ctt 
      ON tr.IdTipoTransaccion = ctt.Id
  LEFT JOIN Dispositivos d 
      ON tr.NumeroSerieDispositivo = d.NumeroSerie
  LEFT JOIN Monederos m 
      ON tr.NumeroSerieMonedero = m.NumeroSerie
  LEFT JOIN Pasajeros p 
      ON m.IdPasajero = p.Id
  LEFT JOIN Clientes c
      ON m.IdCliente = c.Id
  LEFT JOIN Usuarios u
      ON tr.IdUsuario = u.Id
  WHERE tr.FHRegistro BETWEEN ? AND ?
) AS t
ORDER BY t.fhRegistro DESC
LIMIT ? OFFSET ?;
        `,
            [fechaInicioParam, fechaFinParam, fechaInicioParam, fechaFinParam, limit, offset],
          );

          // Query para total (sin paginación)
          totalResult = await this.transaccionesrecargaRepository.query(
            `
SELECT COUNT(*) AS total
FROM (
    SELECT td.Id
    FROM ${entidadDebito} td
    WHERE td.FHRegistro BETWEEN ? AND ?
    
    UNION ALL
    
    SELECT tr.Id
    FROM ${entidadRecarga} tr
    WHERE tr.FHRegistro BETWEEN ? AND ?
) AS todas;
        `,
            [fechaInicioParam, fechaFinParam, fechaInicioParam, fechaFinParam],
          );
          break;

        case 3:
        default:
          //Usuarios Operador
          transacciones = await this.transaccionesrecargaRepository.query(
            `
SELECT * FROM (
  SELECT 
      td.Id AS id,
      'DEBITO' AS origenTabla,
      td.IdTipoTransaccion AS idTipoTransaccion,
      ctt.Nombre AS tipoTransaccion,
      td.Monto AS monto,
      td.LatitudInicial AS latitudInicial,
      td.LongitudInicial AS longitudInicial,
      td.FechaHoraInicio AS fechaHoraInicio,
      td.DistanciaInicialKm AS distanciaInicialKm,
      td.LatitudFinal AS latitudFinal,
      td.LongitudFinal AS longitudFinal,
      td.FechaHoraFinal AS fechaHoraFinal,
      td.FHRegistro AS fhRegistro,
      td.IdControlTransaccion AS idControlTransaccion,
      NULL AS controlTransaccion,
      NULL AS idMetodoPago,
      td.NumeroSerieMonedero AS numeroSerieMonedero,
      td.NumeroSerieDispositivo AS numeroSerieDispositivo,
      td.Contexto AS contexto,
      c.Id AS idCliente,
      c.Nombre AS nombreCliente,
      c.ApellidoPaterno AS apellidoPaternoCliente,
      c.ApellidoMaterno AS apellidoMaternoCliente,
      d.Marca AS marcaDispositivo,
      d.Modelo AS modeloDispositivo,
      p.Id AS idPasajero,
      p.Nombre AS nombrePasajero,
      p.ApellidoPaterno AS apellidoPaternoPasajero,
      p.ApellidoMaterno AS apellidoMaternoPasajero,
      u.Id AS idUsuario,
      u.Nombre AS nombreUsuario,
      td.IdViajes AS idViaje
  FROM ${entidadDebito} td
  LEFT JOIN CatTiposTransacciones ctt 
      ON td.IdTipoTransaccion = ctt.Id
  LEFT JOIN Dispositivos d 
      ON td.NumeroSerieDispositivo = d.NumeroSerie
  LEFT JOIN Monederos m 
      ON td.NumeroSerieMonedero = m.NumeroSerie
  LEFT JOIN Pasajeros p 
      ON m.IdPasajero = p.Id
  LEFT JOIN Clientes c
      ON m.IdCliente = c.Id
  LEFT JOIN Usuarios u
      ON td.IdUsuario = u.Id
  WHERE td.FHRegistro BETWEEN ? AND ?
  AND m.IdCliente = ?
  
  UNION ALL
  
  SELECT 
      tr.Id AS id,
      'RECARGA' AS origenTabla,
      tr.IdTipoTransaccion AS idTipoTransaccion,
      ctt.Nombre AS tipoTransaccion,
      tr.Monto AS monto,
      NULL AS latitudInicial,
      NULL AS longitudInicial,
      NULL AS fechaHoraInicio,
      NULL AS distanciaInicialKm,
      tr.LatitudFinal AS latitudFinal,
      tr.LongitudFinal AS longitudFinal,
      tr.FechaHoraFinal AS fechaHoraFinal,
      tr.FHRegistro AS fhRegistro,
      NULL AS idControlTransaccion,
      tr.ControlTransaccion AS controlTransaccion,
      tr.IdMetodoPago AS idMetodoPago,
      tr.NumeroSerieMonedero AS numeroSerieMonedero,
      tr.NumeroSerieDispositivo AS numeroSerieDispositivo,
      tr.Contexto AS contexto,
      c.Id AS idCliente,
      c.Nombre AS nombreCliente,
      c.ApellidoPaterno AS apellidoPaternoCliente,
      c.ApellidoMaterno AS apellidoMaternoCliente,
      d.Marca AS marcaDispositivo,
      d.Modelo AS modeloDispositivo,
      p.Id AS idPasajero,
      p.Nombre AS nombrePasajero,
      p.ApellidoPaterno AS apellidoPaternoPasajero,
      p.ApellidoMaterno AS apellidoMaternoPasajero,
      u.Id AS idUsuario,
      u.Nombre AS nombreUsuario,
      NULL AS idViaje
  FROM ${entidadRecarga} tr
  LEFT JOIN CatTiposTransacciones ctt 
      ON tr.IdTipoTransaccion = ctt.Id
  LEFT JOIN Dispositivos d 
      ON tr.NumeroSerieDispositivo = d.NumeroSerie
  LEFT JOIN Monederos m 
      ON tr.NumeroSerieMonedero = m.NumeroSerie
  LEFT JOIN Pasajeros p 
      ON m.IdPasajero = p.Id
  LEFT JOIN Clientes c
      ON m.IdCliente = c.Id
  LEFT JOIN Usuarios u
      ON tr.IdUsuario = u.Id
  WHERE tr.FHRegistro BETWEEN ? AND ?
  AND m.IdCliente = ?
) AS t
ORDER BY t.fhRegistro DESC
LIMIT ? OFFSET ?;
        `,
            [fechaInicioParam, fechaFinParam, cliente, fechaInicioParam, fechaFinParam, cliente, limit, offset],
          );

          // Query para total (sin paginación)
          totalResult = await this.transaccionesrecargaRepository.query(
            `
SELECT COUNT(*) AS total
FROM (
    SELECT td.Id
    FROM ${entidadDebito} td
    INNER JOIN Monederos m 
        ON td.NumeroSerieMonedero = m.NumeroSerie
    WHERE td.FHRegistro BETWEEN ? AND ?
    AND m.IdCliente = ?
    
    UNION ALL
    
    SELECT tr.Id
    FROM ${entidadRecarga} tr
    INNER JOIN Monederos m 
        ON tr.NumeroSerieMonedero = m.NumeroSerie
    WHERE tr.FHRegistro BETWEEN ? AND ?
    AND m.IdCliente = ?
) AS todas;
        `,
            [fechaInicioParam, fechaFinParam, cliente, fechaInicioParam, fechaFinParam, cliente],
          );
          break;

        case 9:
          //Datos por usuario
          const pasajero =
            await this.pasajeroService.findOnePasajeroCorreo(email);
          transacciones = await this.transaccionesrecargaRepository.query(
            `
SELECT * FROM (
  SELECT 
      td.Id AS id,
      'DEBITO' AS origenTabla,
      td.IdTipoTransaccion AS idTipoTransaccion,
      ctt.Nombre AS tipoTransaccion,
      td.Monto AS monto,
      td.LatitudInicial AS latitudInicial,
      td.LongitudInicial AS longitudInicial,
      td.FechaHoraInicio AS fechaHoraInicio,
      td.DistanciaInicialKm AS distanciaInicialKm,
      td.LatitudFinal AS latitudFinal,
      td.LongitudFinal AS longitudFinal,
      td.FechaHoraFinal AS fechaHoraFinal,
      td.FHRegistro AS fhRegistro,
      td.IdControlTransaccion AS idControlTransaccion,
      NULL AS controlTransaccion,
      NULL AS idMetodoPago,
      td.NumeroSerieMonedero AS numeroSerieMonedero,
      td.NumeroSerieDispositivo AS numeroSerieDispositivo,
      td.Contexto AS contexto,
      c.Id AS idCliente,
      c.Nombre AS nombreCliente,
      c.ApellidoPaterno AS apellidoPaternoCliente,
      c.ApellidoMaterno AS apellidoMaternoCliente,
      d.Marca AS marcaDispositivo,
      d.Modelo AS modeloDispositivo,
      p.Id AS idPasajero,
      p.Nombre AS nombrePasajero,
      p.ApellidoPaterno AS apellidoPaternoPasajero,
      p.ApellidoMaterno AS apellidoMaternoPasajero,
      u.Id AS idUsuario,
      u.Nombre AS nombreUsuario,
      td.IdViajes AS idViaje
  FROM ${entidadDebito} td
  LEFT JOIN CatTiposTransacciones ctt 
      ON td.IdTipoTransaccion = ctt.Id
  LEFT JOIN Dispositivos d 
      ON td.NumeroSerieDispositivo = d.NumeroSerie
  INNER JOIN Monederos m 
      ON td.NumeroSerieMonedero = m.NumeroSerie
  LEFT JOIN Pasajeros p 
      ON m.IdPasajero = p.Id
  LEFT JOIN Clientes c
      ON m.IdCliente = c.Id
  LEFT JOIN Usuarios u
      ON td.IdUsuario = u.Id
  WHERE td.FHRegistro BETWEEN ? AND ?
  AND m.Estatus = 1
  AND p.Id = ?
  
  UNION ALL
  
  SELECT 
      tr.Id AS id,
      'RECARGA' AS origenTabla,
      tr.IdTipoTransaccion AS idTipoTransaccion,
      ctt.Nombre AS tipoTransaccion,
      tr.Monto AS monto,
      NULL AS latitudInicial,
      NULL AS longitudInicial,
      NULL AS fechaHoraInicio,
      NULL AS distanciaInicialKm,
      tr.LatitudFinal AS latitudFinal,
      tr.LongitudFinal AS longitudFinal,
      tr.FechaHoraFinal AS fechaHoraFinal,
      tr.FHRegistro AS fhRegistro,
      NULL AS idControlTransaccion,
      tr.ControlTransaccion AS controlTransaccion,
      tr.IdMetodoPago AS idMetodoPago,
      tr.NumeroSerieMonedero AS numeroSerieMonedero,
      tr.NumeroSerieDispositivo AS numeroSerieDispositivo,
      tr.Contexto AS contexto,
      c.Id AS idCliente,
      c.Nombre AS nombreCliente,
      c.ApellidoPaterno AS apellidoPaternoCliente,
      c.ApellidoMaterno AS apellidoMaternoCliente,
      d.Marca AS marcaDispositivo,
      d.Modelo AS modeloDispositivo,
      p.Id AS idPasajero,
      p.Nombre AS nombrePasajero,
      p.ApellidoPaterno AS apellidoPaternoPasajero,
      p.ApellidoMaterno AS apellidoMaternoPasajero,
      u.Id AS idUsuario,
      u.Nombre AS nombreUsuario,
      NULL AS idViaje
  FROM ${entidadRecarga} tr
  LEFT JOIN CatTiposTransacciones ctt 
      ON tr.IdTipoTransaccion = ctt.Id
  LEFT JOIN Dispositivos d 
      ON tr.NumeroSerieDispositivo = d.NumeroSerie
  INNER JOIN Monederos m 
      ON tr.NumeroSerieMonedero = m.NumeroSerie
  LEFT JOIN Pasajeros p 
      ON m.IdPasajero = p.Id
  LEFT JOIN Clientes c
      ON m.IdCliente = c.Id
  LEFT JOIN Usuarios u
      ON tr.IdUsuario = u.Id
  WHERE tr.FHRegistro BETWEEN ? AND ?
  AND m.Estatus = 1
  AND p.Id = ?
) AS t
ORDER BY t.fhRegistro DESC
LIMIT ? OFFSET ?;
        `,
            [fechaInicioParam, fechaFinParam, Number(pasajero.id), fechaInicioParam, fechaFinParam, Number(pasajero.id), limit, offset],
          );

          // Query para total (sin paginación)
          totalResult = await this.transaccionesrecargaRepository.query(
            `
SELECT COUNT(*) AS total
FROM (
    SELECT td.Id
    FROM ${entidadDebito} td
    INNER JOIN Monederos m 
        ON td.NumeroSerieMonedero = m.NumeroSerie
    LEFT JOIN Pasajeros p 
        ON m.IdPasajero = p.Id
    WHERE td.FHRegistro BETWEEN ? AND ?
    AND m.Estatus = 1
    AND p.Id = ?
    
    UNION ALL
    
    SELECT tr.Id
    FROM ${entidadRecarga} tr
    INNER JOIN Monederos m 
        ON tr.NumeroSerieMonedero = m.NumeroSerie
    LEFT JOIN Pasajeros p 
        ON m.IdPasajero = p.Id
    WHERE tr.FHRegistro BETWEEN ? AND ?
    AND m.Estatus = 1
    AND p.Id = ?
) AS todas;
        `,
            [fechaInicioParam, fechaFinParam, Number(pasajero.id), fechaInicioParam, fechaFinParam, Number(pasajero.id)],
          );

          break;

        case 2:
        case 8:
        case 10:
          //resto usuarios
          const { ids, placeholders } = await this.clienteHijos(cliente);
          transacciones = await this.transaccionesrecargaRepository.query(
            `
SELECT * FROM (
  SELECT 
      td.Id AS id,
      'DEBITO' AS origenTabla,
      td.IdTipoTransaccion AS idTipoTransaccion,
      ctt.Nombre AS tipoTransaccion,
      td.Monto AS monto,
      td.LatitudInicial AS latitudInicial,
      td.LongitudInicial AS longitudInicial,
      td.FechaHoraInicio AS fechaHoraInicio,
      td.DistanciaInicialKm AS distanciaInicialKm,
      td.LatitudFinal AS latitudFinal,
      td.LongitudFinal AS longitudFinal,
      td.FechaHoraFinal AS fechaHoraFinal,
      td.FHRegistro AS fhRegistro,
      td.IdControlTransaccion AS idControlTransaccion,
      NULL AS controlTransaccion,
      NULL AS idMetodoPago,
      td.NumeroSerieMonedero AS numeroSerieMonedero,
      td.NumeroSerieDispositivo AS numeroSerieDispositivo,
      td.Contexto AS contexto,
      c.Id AS idCliente,
      c.Nombre AS nombreCliente,
      c.ApellidoPaterno AS apellidoPaternoCliente,
      c.ApellidoMaterno AS apellidoMaternoCliente,
      d.Marca AS marcaDispositivo,
      d.Modelo AS modeloDispositivo,
      p.Id AS idPasajero,
      p.Nombre AS nombrePasajero,
      p.ApellidoPaterno AS apellidoPaternoPasajero,
      p.ApellidoMaterno AS apellidoMaternoPasajero,
      u.Id AS idUsuario,
      u.Nombre AS nombreUsuario,
      td.IdViajes AS idViaje
  FROM ${entidadDebito} td
  LEFT JOIN CatTiposTransacciones ctt 
      ON td.IdTipoTransaccion = ctt.Id
  LEFT JOIN Dispositivos d 
      ON td.NumeroSerieDispositivo = d.NumeroSerie
  INNER JOIN Monederos m 
      ON td.NumeroSerieMonedero = m.NumeroSerie
  LEFT JOIN Pasajeros p 
      ON m.IdPasajero = p.Id
  LEFT JOIN Clientes c
      ON m.IdCliente = c.Id
  LEFT JOIN Usuarios u
      ON td.IdUsuario = u.Id
  WHERE td.FHRegistro BETWEEN ? AND ?
  AND m.IdCliente IN (${placeholders})
  
  UNION ALL
  
  SELECT 
      tr.Id AS id,
      'RECARGA' AS origenTabla,
      tr.IdTipoTransaccion AS idTipoTransaccion,
      ctt.Nombre AS tipoTransaccion,
      tr.Monto AS monto,
      NULL AS latitudInicial,
      NULL AS longitudInicial,
      NULL AS fechaHoraInicio,
      NULL AS distanciaInicialKm,
      tr.LatitudFinal AS latitudFinal,
      tr.LongitudFinal AS longitudFinal,
      tr.FechaHoraFinal AS fechaHoraFinal,
      tr.FHRegistro AS fhRegistro,
      NULL AS idControlTransaccion,
      tr.ControlTransaccion AS controlTransaccion,
      tr.IdMetodoPago AS idMetodoPago,
      tr.NumeroSerieMonedero AS numeroSerieMonedero,
      tr.NumeroSerieDispositivo AS numeroSerieDispositivo,
      tr.Contexto AS contexto,
      c.Id AS idCliente,
      c.Nombre AS nombreCliente,
      c.ApellidoPaterno AS apellidoPaternoCliente,
      c.ApellidoMaterno AS apellidoMaternoCliente,
      d.Marca AS marcaDispositivo,
      d.Modelo AS modeloDispositivo,
      p.Id AS idPasajero,
      p.Nombre AS nombrePasajero,
      p.ApellidoPaterno AS apellidoPaternoPasajero,
      p.ApellidoMaterno AS apellidoMaternoPasajero,
      u.Id AS idUsuario,
      u.Nombre AS nombreUsuario,
      NULL AS idViaje
  FROM ${entidadRecarga} tr
  LEFT JOIN CatTiposTransacciones ctt 
      ON tr.IdTipoTransaccion = ctt.Id
  LEFT JOIN Dispositivos d 
      ON tr.NumeroSerieDispositivo = d.NumeroSerie
  INNER JOIN Monederos m 
      ON tr.NumeroSerieMonedero = m.NumeroSerie
  LEFT JOIN Pasajeros p 
      ON m.IdPasajero = p.Id
  LEFT JOIN Clientes c
      ON m.IdCliente = c.Id
  LEFT JOIN Usuarios u
      ON tr.IdUsuario = u.Id
  WHERE tr.FHRegistro BETWEEN ? AND ?
  AND m.IdCliente IN (${placeholders})
) AS t
ORDER BY t.fhRegistro DESC
LIMIT ? OFFSET ?;
        `,
            [fechaInicioParam, fechaFinParam, ...ids, fechaInicioParam, fechaFinParam, ...ids, limit, offset],
          );
          // Query para total (sin paginación)
          totalResult = await this.transaccionesrecargaRepository.query(
            `
SELECT COUNT(*) AS total
FROM (
    SELECT td.Id
    FROM ${entidadDebito} td
    INNER JOIN Monederos m 
        ON td.NumeroSerieMonedero = m.NumeroSerie
    WHERE td.FHRegistro BETWEEN ? AND ?
    AND m.IdCliente IN (${placeholders})
    
    UNION ALL
    
    SELECT tr.Id
    FROM ${entidadRecarga} tr
    INNER JOIN Monederos m 
        ON tr.NumeroSerieMonedero = m.NumeroSerie
    WHERE tr.FHRegistro BETWEEN ? AND ?
    AND m.IdCliente IN (${placeholders})
) AS todas;
        `,
            [fechaInicioParam, fechaFinParam, ...ids, fechaInicioParam, fechaFinParam, ...ids],
          );
          break;
      }

      const total = Number(totalResult[0]?.total || 0);

      // Transformación de datos (ids → number)
      const data = transacciones.map((item) => ({
        ...item,
        id: Number(item.id),
        idTipoTransaccion: Number(item.idTipoTransaccion),
        monto: Number(item.monto),
        latitudInicial: item.latitudInicial ? Number(item.latitudInicial) : null,
        longitudInicial: item.longitudInicial ? Number(item.longitudInicial) : null,
        distanciaInicialKm: item.distanciaInicialKm ? Number(item.distanciaInicialKm) : null,
        latitudFinal: item.latitudFinal ? Number(item.latitudFinal) : null,
        longitudFinal: item.longitudFinal ? Number(item.longitudFinal) : null,
        idCliente: item.idCliente ? Number(item.idCliente) : null,
        idPasajero: item.idPasajero ? Number(item.idPasajero) : null,
        idUsuario: item.idUsuario ? Number(item.idUsuario) : null,
        idViaje: item.idViaje ? Number(item.idViaje) : null,
      }));

      const lastPage = Math.ceil(total / limit);
      return { data, total, page, lastPage };
    } catch (error) {
      console.error('[resolverPorRolDefault]', (error as Error)?.message ?? error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({
        message: 'Error al obtener transacciones paginadas por rol',
      });
    }

  }

  /*   async findAllTransacciones(
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
  
      -- Datos del cliente
      c.Id AS idCliente,
      c.Nombre AS nombreCliente,
      c.ApellidoPaterno AS apellidoPaternoCliente,
      c.ApellidoMaterno AS apellidoMaternoCliente,
      
  
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
    tr.NumeroSerieDispositivo AS numeroSerieDispositivo,
    tr.Contexto AS contexto,
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
  LEFT JOIN Dispositivos d 
      ON tr.NumeroSerieDispositivo = d.NumeroSerie
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
        td.NumeroSerieDispositivo AS numeroSerieDispositivo,
        td.Contexto AS contexto,
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
    LEFT JOIN Dispositivos d 
        ON td.NumeroSerieDispositivo = d.NumeroSerie
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
    tr.NumeroSerieDispositivo AS numeroSerieDispositivo,
    tr.Contexto AS contexto,
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
    LEFT JOIN Dispositivos d 
        ON tr.NumeroSerieDispositivo = d.NumeroSerie
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
        td.NumeroSerieDispositivo AS numeroSerieDispositivo,
        td.Contexto AS contexto,
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
    tr.NumeroSerieDispositivo AS numeroSerieDispositivo,
    tr.Contexto AS contexto,
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
        td.NumeroSerieDispositivo AS numeroSerieDispositivo,
        td.Contexto AS contexto,
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
    LEFT JOIN Dispositivos d 
        ON td.NumeroSerieDispositivo = d.NumeroSerie
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
    tr.NumeroSerieDispositivo AS numeroSerieDispositivo,
    tr.Contexto AS contexto,
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
    LEFT JOIN Dispositivos d 
        ON tr.NumeroSerieDispositivo = d.NumeroSerie
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
        console.error('[findAllTransacciones]', (error as Error)?.message ?? error);
        if (error instanceof HttpException) {
          throw error;
        }
        throw new BadRequestException({
          message: 'Error al obtener transacciones',
        });
      }
    }
   */

  async findAllListTransacciones(
    cliente: number,
    rol: number,
  ): Promise<ApiResponseCommon> {
    try {
      let fechaInicio, fechaFin;
      let transacciones;
      let entidadRecarga;
      let entidadDebito;
      //Generamos la fecha actual
      function pad(n: number) {
        return n < 10 ? '0' + n : n;
      }
      const ahora = new Date();
      const desfaseMs = -6 * 60 * 60 * 1000; // -6 horas
      const fechaDesfasada = new Date(ahora.getTime() + desfaseMs);
      // Solo la fecha del momento
      const fechaActual = `${fechaDesfasada.getFullYear()}-${pad(fechaDesfasada.getMonth() + 1)}-${pad(fechaDesfasada.getDate())}`;

      fechaInicio = fechaActual
      fechaFin = fechaActual
      entidadRecarga = 'TransaccionesRecarga';
      entidadDebito = 'TransaccionesDebito';
      switch (rol) {
        case 1:
          transacciones = await this.transaccionesrecargaRepository.query(
            `
SELECT 
    'DEBITO' AS origenTabla,        -- 👈 de qué tabla viene
    td.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- 👈 tipo según el catálogo (RECARGA, DEBITO o RECHAZADO)
    td.Monto AS monto,
    td.LatitudFinal AS latitudFinal,
    td.LongitudFinal AS longitudFinal,
    td.FechaHoraFinal AS fechaHoraFinal,
    td.FHRegistro AS fhRegistro,
    td.IdControlTransaccion AS idControlTransaccion,
    td.NumeroSerieMonedero AS numeroSerieMonedero,
    td.NumeroSerieDispositivo AS numeroSerieDispositivo,
    td.Contexto AS contexto,

    -- Datos del cliente
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,
    

    -- Datos del dispositivo
    d.Marca AS marcaDispositivo,
    d.Modelo AS modeloDispositivo,

    -- Pasajero (vía Monedero)
    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero

FROM ${entidadDebito} td
INNER JOIN CatTiposTransacciones ctt 
    ON td.IdTipoTransaccion = ctt.Id
LEFT JOIN Dispositivos d 
    ON td.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Monederos m 
    ON td.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
INNER JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE td.FechaHoraFinal BETWEEN ? AND ?


UNION ALL

SELECT 
    'RECARGA' AS origenTabla,       -- 👈 solo indica de qué tabla proviene
    tr.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- 👈 valor real del tipo
    tr.Monto AS monto,
    tr.LatitudFinal AS latitudFinal,
    tr.LongitudFinal AS longitudFinal,
    tr.FechaHoraFinal AS fechaHoraFinal,
    tr.FHRegistro AS fhRegistro,
    tr.ControlTransaccion AS controlTransaccion,
    tr.IdMetodoPago AS idMetodoPago,
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieDispositivo AS numeroSerieDispositivo,
    tr.Contexto AS contexto,

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

FROM ${entidadRecarga} tr
INNER JOIN CatTiposTransacciones ctt 
    ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN Dispositivos d 
    ON tr.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
INNER JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE tr.FechaHoraFinal BETWEEN ? AND ?

ORDER BY FechaHoraFinal DESC
        `,
            [`${fechaInicio}T00:00:00Z`, `${fechaFin}T23:59:59Z`, `${fechaInicio}T00:00:00Z`, `${fechaFin}T23:59:59Z`],
          );
          break;

        case 2: // Administrador
        case 8: // Reportes
        case 10: // Capturista
          const { ids, placeholders } = await this.clienteHijos(cliente);
          transacciones = await this.transaccionesrecargaRepository.query(
            `
SELECT 
    'DEBITO' AS origenTabla,        -- 👈 de qué tabla viene
    td.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- 👈 tipo según el catálogo (RECARGA, DEBITO o RECHAZADO)
    td.Monto AS monto,
    td.LatitudFinal AS latitudFinal,
    td.LongitudFinal AS longitudFinal,
    td.FechaHoraFinal AS fechaHoraFinal,
    td.FHRegistro AS fhRegistro,
    td.IdControlTransaccion AS idControlTransaccion,
    td.NumeroSerieMonedero AS numeroSerieMonedero,
    td.NumeroSerieDispositivo AS numeroSerieDispositivo,
    td.Contexto AS contexto,

    -- Datos del cliente
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,
    

    -- Datos del dispositivo
    d.Marca AS marcaDispositivo,
    d.Modelo AS modeloDispositivo,

    -- Pasajero (vía Monedero)
    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero

FROM ${entidadDebito} td
INNER JOIN CatTiposTransacciones ctt 
    ON td.IdTipoTransaccion = ctt.Id
LEFT JOIN Dispositivos d 
    ON td.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Monederos m 
    ON td.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
INNER JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE td.FechaHoraFinal BETWEEN ? AND ?
AND m.IdCliente IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar


UNION ALL

SELECT 
    'RECARGA' AS origenTabla,       -- 👈 solo indica de qué tabla proviene
    tr.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- 👈 valor real del tipo
    tr.Monto AS monto,
    tr.LatitudFinal AS latitudFinal,
    tr.LongitudFinal AS longitudFinal,
    tr.FechaHoraFinal AS fechaHoraFinal,
    tr.FHRegistro AS fhRegistro,
    tr.ControlTransaccion AS controlTransaccion,
    tr.IdMetodoPago AS idMetodoPago,
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieDispositivo AS numeroSerieDispositivo,
    tr.Contexto AS contexto,

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

FROM ${entidadRecarga} tr
INNER JOIN CatTiposTransacciones ctt 
    ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN Dispositivos d 
    ON tr.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
INNER JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE tr.FechaHoraFinal BETWEEN ? AND ?
AND m.IdCliente IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar

ORDER BY FechaHoraFinal DESC

        `,
            [`${fechaInicio}T00:00:00Z`, `${fechaFin}T23:59:59Z`, ...ids, `${fechaInicio}T00:00:00Z`, `${fechaFin}T23:59:59Z`, ...ids],
          );
          break;

        case 3:
        default:
          transacciones = await this.transaccionesrecargaRepository.query(
            `
SELECT 
    'DEBITO' AS origenTabla,        -- 👈 de qué tabla viene
    td.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- 👈 tipo según el catálogo (RECARGA, DEBITO o RECHAZADO)
    td.Monto AS monto,
    td.LatitudFinal AS latitudFinal,
    td.LongitudFinal AS longitudFinal,
    td.FechaHoraFinal AS fechaHoraFinal,
    td.FHRegistro AS fhRegistro,
    td.IdControlTransaccion AS idControlTransaccion,
    td.NumeroSerieMonedero AS numeroSerieMonedero,
    td.NumeroSerieDispositivo AS numeroSerieDispositivo,
    td.Contexto AS contexto,

    -- Datos del cliente
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,
    

    -- Datos del dispositivo
    d.Marca AS marcaDispositivo,
    d.Modelo AS modeloDispositivo,

    -- Pasajero (vía Monedero)
    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero

FROM ${entidadDebito} td
INNER JOIN CatTiposTransacciones ctt 
    ON td.IdTipoTransaccion = ctt.Id
LEFT JOIN Dispositivos d 
    ON td.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Monederos m 
    ON td.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
INNER JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE td.FechaHoraFinal BETWEEN ? AND ?
AND m.IdCliente = ?


UNION ALL

SELECT 
    'RECARGA' AS origenTabla,       -- 👈 solo indica de qué tabla proviene
    tr.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- 👈 valor real del tipo
    tr.Monto AS monto,
    tr.LatitudFinal AS latitudFinal,
    tr.LongitudFinal AS longitudFinal,
    tr.FechaHoraFinal AS fechaHoraFinal,
    tr.FHRegistro AS fhRegistro,
    tr.ControlTransaccion AS controlTransaccion,
    tr.IdMetodoPago AS idMetodoPago,
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieDispositivo AS numeroSerieDispositivo,
    tr.Contexto AS contexto,

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

FROM ${entidadRecarga} tr
INNER JOIN CatTiposTransacciones ctt 
    ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN Dispositivos d 
    ON tr.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
INNER JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE tr.FechaHoraFinal BETWEEN ? AND ?
AND m.IdCliente = ?

ORDER BY FechaHoraFinal DESC
        `,
            [`${fechaInicio}T00:00:00Z`, `${fechaFin}T23:59:59Z`, cliente, `${fechaInicio}T00:00:00Z`, `${fechaFin}T23:59:59Z`, cliente],
          );
          break;
      }

      // 🔥 Transformación de datos (ids → number, nombreCompleto)
      const data = transacciones.map((item) => ({
        ...item,
        id: Number(item.id),
        monto: Number(item.monto),
        latitudFinal: Number(item.latitudFinal),
        longitudFinal: Number(item.longitudFinal),
        idCliente: Number(item.idCliente),
        idPasajero: Number(item.idPasajero),
      }));

      //API Response
      const result: ApiResponseCommon = {
        data: data,
      };
      return result;
    } catch (error) {
      console.error('[findAllListTransacciones]', (error as Error)?.message ?? error);
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
    tr.LatitudFinal AS latitudFinal,
    tr.LongitudFinal AS longitudFinal,
    tr.FechaHoraFinal AS fechaHoraFinal,
    tr.FHRegistro AS fhRegistro,
    tr.ControlTransaccion AS controlTransaccion,
    tr.IdMetodoPago AS idMetodoPago,
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieDispositivo AS numeroSerieDispositivo,
    tr.Contexto AS contexto,

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
LEFT JOIN Dispositivos d 
    ON tr.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
INNER JOIN Clientes c
	ON m.IdCliente = c.Id
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
        latitudFinal: Number(item.latitudFinal),
        longitudFinal: Number(item.longitudFinal),
        idCliente: Number(item.idCliente),
        idPasajero: Number(item.idPasajero),
      }));
      return { data: data };
    } catch (error) {
      console.error('[findOneTransaccionRecarga]', (error as Error)?.message ?? error);
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
    td.LatitudFinal AS latitudFinal,
    td.LongitudFinal AS longitudFinal,
    td.FechaHoraFinal AS fechaHoraFinal,
    td.FHRegistro AS fhRegistro,
    td.IdControlTransaccion AS idControlTransaccion,
    td.NumeroSerieMonedero AS numeroSerieMonedero,
    td.NumeroSerieDispositivo AS numeroSerieDispositivo,
    td.Contexto AS contexto,

    -- Datos del cliente
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,
    

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
INNER JOIN Clientes c
	ON m.IdCliente = c.Id
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
        latitudFinal: Number(item.latitudFinal),
        longitudFinal: Number(item.longitudFinal),
        idCliente: Number(item.idCliente),
        idPasajero: Number(item.idPasajero),
      }));
      return { data: data };
    } catch (error) {
      console.error('[findOneTransaccionDebito]', (error as Error)?.message ?? error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({
        message: 'Error al obtener transacciones',
      });
    }
  }

  async paginadoRecarga(
    idUser: number,
    email: string,
    cliente: number,
    rol: number,
    getTransaccioneDto: GetTransaccioneDto
  ) {
    try {
      //Declaramos las variables para el consumo del api
      let { fechaInicio, fechaFin } = getTransaccioneDto
      const { page, limit } = getTransaccioneDto
      let entidadRecarga;
      let transacciones;

      //Generamos la fecha actual
      function pad(n: number) {
        return n < 10 ? '0' + n : n;
      }
      const ahora = new Date();
      const desfaseMs = -6 * 60 * 60 * 1000; // -6 horas
      const fechaDesfasada = new Date(ahora.getTime() + desfaseMs);
      // Solo la fecha del momento
      const fechaActual = `${fechaDesfasada.getFullYear()}-${pad(fechaDesfasada.getMonth() + 1)}-${pad(fechaDesfasada.getDate())}`;

      //Si fechaInicio y fechaFin son null arroja las transacciones del dia de la tabla TransaccionesRecarga y TransaccionesDebito
      if (!fechaInicio && !fechaFin) {
        fechaInicio = fechaActual;
        fechaFin = fechaActual;
        entidadRecarga = 'TransaccionesRecarga';
        transacciones = await this.resolverPorRolRecargas(fechaInicio, fechaFin, idUser, email, cliente, rol, page, limit, entidadRecarga);
      } else {
        fechaInicio = fechaInicio?.split("T")[0] ?? fechaActual;
        fechaFin = fechaFin?.split("T")[0] ?? fechaActual;
        entidadRecarga = 'HistoricoTransaccionesRecarga';
        transacciones = await this.resolverPorRolRecargas(fechaInicio, fechaFin, idUser, email, cliente, rol, page, limit, entidadRecarga);
      }

      const { data, total } = transacciones

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
      console.error('[paginadoRecarga]', (error as Error)?.message ?? error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({
        message: 'Error al obtener transacciones paginado.',
      });
    }
  }


  async resolverPorRolRecargas(
    fechaInicio: string,
    fechaFin: string,
    idUser: number,
    email: string,
    cliente: number,
    rol: number,
    page: number,
    limit: number,
    entidadRecarga: string
  ) {
    try {
      let totalResult;
      let transacciones;
      const offset = (page - 1) * limit;
      switch (rol) {
        case 1:
          transacciones = await this.transaccionesrecargaRepository.query(
            `
SELECT 
    'RECARGA' AS origenTabla,
    tr.Id AS id,
    ctt.Nombre AS tipoTransaccion,
    tr.Monto AS monto,
    tr.LatitudFinal AS latitudFinal,
    tr.LongitudFinal AS longitudFinal,
    tr.FechaHoraFinal AS fechaHoraFinal,
    tr.FHRegistro AS fhRegistro,
    tr.ControlTransaccion AS controlTransaccion,
    tr.IdMetodoPago AS idMetodoPago,
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieDispositivo AS numeroSerieDispositivo,
    tr.Contexto AS contexto,

    -- Datos del cliente
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,

    -- Datos del dispositivo
    d.Marca AS marcaDispositivo,
    d.Modelo AS modeloDispositivo,

    -- Datos del pasajero
    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero

FROM ${entidadRecarga} tr
INNER JOIN CatTiposTransacciones ctt 
    ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN Dispositivos d 
    ON tr.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
INNER JOIN Clientes c
    ON m.IdCliente = c.Id

WHERE tr.FechaHoraFinal BETWEEN ? AND ?

ORDER BY tr.FechaHoraFinal DESC
  LIMIT ? OFFSET ?;
        `,
            [`${fechaInicio}T00:00:00Z`, `${fechaFin}T23:59:59Z`, limit, offset],
          );

          // Query para total (sin paginación)
          totalResult = await this.transaccionesrecargaRepository.query(
            `
            SELECT COUNT(*) AS total
		FROM ${entidadRecarga} tr
INNER JOIN CatTiposTransacciones ctt 
    ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN Dispositivos d 
    ON tr.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
INNER JOIN Clientes c
    ON m.IdCliente = c.Id

WHERE tr.FechaHoraFinal BETWEEN ? AND ?
  `,
            [`${fechaInicio}T00:00:00Z`, `${fechaFin}T23:59:59Z`],
          );
          break;

        case 2:
          transacciones = await this.transaccionesrecargaRepository.query(
            `
SELECT 
    'RECARGA' AS origenTabla,
    tr.Id AS id,
    ctt.Nombre AS tipoTransaccion,
    tr.Monto AS monto,
    tr.LatitudFinal AS latitudFinal,
    tr.LongitudFinal AS longitudFinal,
    tr.FechaHoraFinal AS fechaHoraFinal,
    tr.FHRegistro AS fhRegistro,
    tr.ControlTransaccion AS controlTransaccion,
    tr.IdMetodoPago AS idMetodoPago,
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieDispositivo AS numeroSerieDispositivo,
    tr.Contexto AS contexto,

    -- Datos del cliente
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,

    -- Datos del dispositivo
    d.Marca AS marcaDispositivo,
    d.Modelo AS modeloDispositivo,

    -- Datos del pasajero
    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero

FROM ${entidadRecarga} tr
INNER JOIN CatTiposTransacciones ctt 
    ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN Dispositivos d 
    ON tr.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
INNER JOIN Clientes c
    ON m.IdCliente = c.Id

WHERE c.Id = ?   -- 👈 filtro por cliente
  AND tr.FechaHoraFinal BETWEEN ? AND ?

ORDER BY tr.FechaHoraFinal DESC
LIMIT ? OFFSET ?;

        `,
            [cliente, `${fechaInicio}T00:00:00Z`, `${fechaFin}T23:59:59Z`, limit, offset],
          );

          // Query para total (sin paginación)
          totalResult = await this.transaccionesrecargaRepository.query(
            `
            SELECT COUNT(*) AS total
FROM ${entidadRecarga} tr
INNER JOIN CatTiposTransacciones ctt 
    ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN Dispositivos d 
    ON tr.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
INNER JOIN Clientes c
    ON m.IdCliente = c.Id

WHERE c.Id = ?   -- 👈 filtro por cliente
  AND tr.FechaHoraFinal BETWEEN ? AND ?
  `, [cliente, `${fechaInicio}T00:00:00Z`, `${fechaFin}T23:59:59Z`]
          );
          break;

        case 9:
          //Datos por usuario
          const pasajero =
            await this.pasajeroService.findOnePasajeroCorreo(email);
          transacciones = await this.transaccionesrecargaRepository.query(
            `
SELECT 
    'RECARGA' AS origenTabla,       -- 👈 solo indica de qué tabla proviene
    tr.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- 👈 valor real del tipo
    tr.Monto AS monto,
    tr.LatitudFinal AS latitudFinal,
    tr.LongitudFinal AS longitudFinal,
    tr.FechaHoraFinal AS fechaHoraFinal,
    tr.FHRegistro AS fhRegistro,
    tr.ControlTransaccion AS controlTransaccion,
    tr.IdMetodoPago AS idMetodoPago,
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieDispositivo AS numeroSerieDispositivo,
    tr.Contexto AS contexto,

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

FROM ${entidadRecarga} tr
INNER JOIN CatTiposTransacciones ctt 
    ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN Dispositivos d 
    ON tr.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
INNER JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE tr.FechaHoraFinal BETWEEN ? AND ?
AND m.Estatus = 1
AND p.Id = ?

ORDER BY FechaHoraFinal DESC
LIMIT ? OFFSET ?;

        `,
            [`${fechaInicio}T00:00:00Z`, `${fechaFin}T23:59:59Z`, Number(pasajero.id), limit, offset],
          );
          // Query para total (sin paginación)
          totalResult = await this.transaccionesrecargaRepository.query(
            `
SELECT COUNT(*) AS total
FROM ${entidadRecarga} tr
INNER JOIN CatTiposTransacciones ctt 
    ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN Dispositivos d 
    ON tr.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
INNER JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE tr.FechaHoraFinal BETWEEN ? AND ?
AND m.Estatus = 1
AND p.Id = ?

  `,
            [`${fechaInicio}T00:00:00Z`, `${fechaFin}T23:59:59Z`, Number(pasajero.id)],
          );
          break;

        case 11:
          const fechaInicioParam11 = `${fechaInicio}T00:00:00Z`;
          const fechaFinParam11 = `${fechaFin}T23:59:59Z`;
          transacciones = await this.transaccionesrecargaRepository.query(
            `
SELECT 
    'RECARGA' AS origenTabla,
    tr.Id AS id,
    ctt.Nombre AS tipoTransaccion,
    tr.Monto AS monto,
    tr.LatitudFinal AS latitudFinal,
    tr.LongitudFinal AS longitudFinal,
    tr.FechaHoraFinal AS fechaHoraFinal,
    tr.FHRegistro AS fhRegistro,
    tr.ControlTransaccion AS controlTransaccion,
    tr.IdMetodoPago AS idMetodoPago,
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieDispositivo AS numeroSerieDispositivo,
    tr.Contexto AS contexto,

    -- Datos del cliente
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,

    -- Datos del dispositivo
    d.Marca AS marcaDispositivo,
    d.Modelo AS modeloDispositivo,

    -- Datos del pasajero
    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero

FROM ${entidadRecarga} tr
INNER JOIN CatTiposTransacciones ctt 
    ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN Dispositivos d 
    ON tr.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
INNER JOIN Clientes c
    ON m.IdCliente = c.Id

WHERE tr.IdUsuario = ?   -- 👈 filtro por usuario
  AND tr.FechaHoraFinal BETWEEN ? AND ?

ORDER BY tr.FechaHoraFinal DESC
LIMIT ? OFFSET ?;

        `,
            [idUser, fechaInicioParam11, fechaFinParam11, limit, offset],
          );

          // Query para total (sin paginación)
          totalResult = await this.transaccionesrecargaRepository.query(
            `
            SELECT COUNT(*) AS total
FROM ${entidadRecarga} tr
INNER JOIN CatTiposTransacciones ctt 
    ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN Dispositivos d 
    ON tr.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
INNER JOIN Clientes c
    ON m.IdCliente = c.Id

WHERE tr.IdUsuario = ?   -- 👈 filtro por usuario
  AND tr.FechaHoraFinal BETWEEN ? AND ?
  `, [idUser, fechaInicioParam11, fechaFinParam11]
          );
          break;
      }

      const total = Number(totalResult[0]?.total || 0);

      // 🔥 Transformación de datos (ids → number, nombreCompleto)
      const data = transacciones.map((item) => ({
        ...item,
        id: Number(item.id),
        monto: Number(item.monto),
        latitudFinal: Number(item.latitudFinal),
        longitudFinal: Number(item.longitudFinal),
        idCliente: Number(item.idCliente),
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
      return { data, total };
    } catch (error) {
      console.error('[resolverPorRolRecargas]', (error as Error)?.message ?? error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({
        message: 'Error al obtener transacciones paginadas por rol',
      });
    }

  }

  // ========================================
  // 🔹 LIMPIAR TABLA DE TRABAJO TransaccionesRecarga
  // ========================================
  /**
   * Limpia la tabla TransaccionesRecarga verificando que todos los registros
   * ya existan en HistoricoTransaccionesRecarga antes de hacer TRUNCATE.
   * 
   * Este método se ejecuta mediante cron job a las 02:00 AM diariamente.
   */
  async limpiarTransaccionesRecarga(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Obtener repositorios dentro de la transacción
      const transaccionesRecargaRepo = queryRunner.manager.getRepository(TransaccionesRecarga);
      const historicoTransaccionesRecargaRepo = queryRunner.manager.getRepository(HistoricoTransaccionesRecarga);

      // 1) Obtener todos los registros de TransaccionesRecarga
      const transaccionesRecarga = await transaccionesRecargaRepo.find();

      if (transaccionesRecarga.length === 0) {
        await queryRunner.release();
        return;
      }

      // CRÍTICO: No hacer TRUNCATE hasta confirmar que cada registro existe en histórico (evitar pérdida de datos).
      for (const transaccion of transaccionesRecarga) {
        const existeEnHistorico = await historicoTransaccionesRecargaRepo.findOne({
          where: {
            numeroSerieMonedero: transaccion.numeroSerieMonedero,
            monto: transaccion.monto,
            fechaHoraFinal: transaccion.fechaHoraFinal,
          },
        });

        if (!existeEnHistorico) {
          await queryRunner.rollbackTransaction();
          await queryRunner.release();
          console.warn(
            `[limpiarTransaccionesRecarga] No se puede limpiar: transacción ID ${transaccion.id} no existe en histórico.`,
          );
          await this.bitacoraLogger.logToBitacora(
            'Transacciones',
            `Error al limpiar TransaccionesRecarga: La transacción con ID ${transaccion.id} no existe en histórico.`,
            'DELETE',
            { transaccionId: transaccion.id },
            1, // Usuario del sistema
            EnumModulos.TRANSACCIONES,
            EstatusEnumBitcora.ERROR,
            'La transacción no existe en histórico',
          );
          return;
        }
      }

      // 3) Todos los registros existen en histórico, proceder con TRUNCATE
      await queryRunner.query('TRUNCATE TABLE TransaccionesRecarga;');

      // Commit de la transacción
      await queryRunner.commitTransaction();

      await this.bitacoraLogger.logToBitacora(
        'Transacciones',
        `Limpieza automática de TransaccionesRecarga completada. Registros eliminados: ${transaccionesRecarga.length}`,
        'DELETE',
        { registrosEliminados: transaccionesRecarga.length },
        1,
        EnumModulos.TRANSACCIONES,
        EstatusEnumBitcora.SUCCESS,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('[limpiarTransaccionesRecarga]', (error as Error)?.message ?? error);

      // Registrar error en bitácora
      await this.bitacoraLogger.logToBitacora(
        'Transacciones',
        `Error al limpiar TransaccionesRecarga`,
        'DELETE',
        {},
        1, // Usuario del sistema
        EnumModulos.TRANSACCIONES,
        EstatusEnumBitcora.ERROR,
        error.message,
      );

      throw new InternalServerErrorException({
        message: 'Error al limpiar la tabla TransaccionesRecarga',
        error: error.message,
      });
    } finally {
      // Liberar el QueryRunner
      await queryRunner.release();
    }
  }

  // ========================================
  // 🔹 LIMPIAR TABLA TransaccionesDebito
  // ========================================
  /**
   * Limpia la tabla TransaccionesDebito verificando que todos los registros
   * existan en HistoricoTransaccionesDebito. Luego hace TRUNCATE (elimina datos y reinicia contador a 0).
   */
  async limpiarTransaccionesDebito(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const transaccionesDebitoRepo = queryRunner.manager.getRepository(TransaccionesDebito);
      const historicoRepo = queryRunner.manager.getRepository(HistoricoTransaccionesDebito);

      const transaccionesDebito = await transaccionesDebitoRepo.find();

      if (transaccionesDebito.length === 0) {
        await queryRunner.release();
        return;
      }

      for (const trans of transaccionesDebito) {
        const where: any = {
          numeroSerieMonedero: trans.numeroSerieMonedero,
          monto: trans.monto,
          fechaHoraFinal: trans.fechaHoraFinal,
          idViajes: trans.idViajes != null ? trans.idViajes : IsNull(),
        };
        const existeEnHistorico = await historicoRepo.findOne({ where });

        if (!existeEnHistorico) {
          await queryRunner.rollbackTransaction();
          await queryRunner.release();
          console.warn(
            `[limpiarTransaccionesDebito] No se puede limpiar: transacción ID ${trans.id} no existe en histórico.`,
          );
          await this.bitacoraLogger.logToBitacora(
            'Transacciones',
            `Error al limpiar TransaccionesDebito: La transacción con ID ${trans.id} no existe en histórico.`,
            'DELETE',
            { transaccionId: trans.id },
            1,
            EnumModulos.TRANSACCIONES,
            EstatusEnumBitcora.ERROR,
            'La transacción no existe en histórico',
          );
          return;
        }
      }

      await queryRunner.query('TRUNCATE TABLE TransaccionesDebito;');
      await queryRunner.commitTransaction();

      await this.bitacoraLogger.logToBitacora(
        'Transacciones',
        `Limpieza automática de TransaccionesDebito completada. Registros eliminados: ${transaccionesDebito.length}`,
        'DELETE',
        { registrosEliminados: transaccionesDebito.length },
        1,
        EnumModulos.TRANSACCIONES,
        EstatusEnumBitcora.SUCCESS,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('[limpiarTransaccionesDebito]', (error as Error)?.message ?? error);
      await this.bitacoraLogger.logToBitacora(
        'Transacciones',
        `Error al limpiar TransaccionesDebito`,
        'DELETE',
        {},
        1,
        EnumModulos.TRANSACCIONES,
        EstatusEnumBitcora.ERROR,
        (error as Error).message,
      );
      throw new InternalServerErrorException({
        message: 'Error al limpiar la tabla TransaccionesDebito',
        error: (error as Error).message,
      });
    } finally {
      await queryRunner.release();
    }
  }

  // ========================================
  // 🔹 Transacciones Debito Para Cierre de Viajes
  // ========================================
  /**
   * Cierra todas las transacciones débito abiertas.
   * Usado por el cron de cierre automático: busca TransaccionesDebito con idControlTransaccion=ABIERTA,
   * agrupa por idViajes y ejecuta viajeCierre (que usa createTransaccionDebitoByViajes) para cada viaje.
   */
  async cerrarTransaccionesDebitoAbiertasCron(): Promise<{ viajesProcesados: number; errores: string[] }> {
    const errores: string[] = [];
    let viajesProcesados = 0;
    const transacciones = await this.transaccionesdebitoRepository.find({
      where: { idControlTransaccion: EnumControlTransacciones.ABIERTA },
      select: ['idViajes'],
    });
    const idViajesUnicos = [...new Set(transacciones.map((t) => t.idViajes).filter(Boolean))] as number[];
    for (const idViaje of idViajesUnicos) {
      try {
        await this.viajeCierre(idViaje);
        viajesProcesados++;
      } catch (err) {
        const msg = (err as Error)?.message ?? String(err);
        errores.push(`Viaje ${idViaje}: ${msg}`);
      }
    }
    return { viajesProcesados, errores };
  }

  /**
   * Cierra una transacción abierta de débito en el contexto de cierre de viaje.
   * CRÍTICO: Calcula monto (montoTarifa), aplica descuentos, valida saldo. Si insuficiente → RECHAZO + histórico;
   * si OK → update monedero (vía updateMonederoSaldoSafe), transacción a PAGADO, histórico.
   * Usar manager/QueryRunner cuando se invoque desde flujo transaccional (viajeCierre, createOrClose) para evitar locks.
   */
  async createTransaccionDebitoByViajes(
    montoCalculado: number,
    latitudInicial: number,
    longitudInicial: number,
    fechaHoraInicio: Date,
    distanciaInicial: number,
    latitudFinal: number,
    longitudFinal: number,
    numeroSerieDispositivo: string,
    idViaje: number,
    numeroSerieMonedero: string,
    idUser: number,
    idTransaccion: number,
    idCardMonedero?: string,
    queryRunner?: QueryRunner,
  ): Promise<ApiCrudResponse> {
    let estado: EstadoTransaccion = EstadoTransaccion.INICIADA;
    let idUsuario;

    const manager = queryRunner?.manager;
    const monederoRepo = manager ? manager.getRepository(Monederos) : this.monederoRepository;
    const transDebitoRepo = manager ? manager.getRepository(TransaccionesDebito) : this.transaccionesdebitoRepository;
    const historicoRepo = manager ? manager.getRepository(HistoricoTransaccionesDebito) : this.historicoTransaccionesDebitoRepository;
    const catTiposRepo = manager ? manager.getRepository(CatTiposPasajeros) : this.CatTiposPasajerosRepository;

    try {
      let monedero;
      // 1️⃣ Cambiamos estado a VALIDANDO_SALDO
      estado = transicionarEstado(estado, EventoTransaccion.CREAR);

      // 2️⃣ Buscamos el monedero
      if (!idCardMonedero && !numeroSerieMonedero) {
        estado = EstadoTransaccion.ERROR;
        throw new BadRequestException('Debe proporcionarse al menos uno de los campos requeridos: número de serie del monedero o ID Card.');
      }
      if (idCardMonedero) {
        monedero = await monederoRepo.findOne({
          where:
            { idCard: idCardMonedero, estatus: 1 }
        });
      } else if (numeroSerieMonedero) {
        monedero = await monederoRepo.findOne({
          where:
            { numeroSerie: numeroSerieMonedero, estatus: 1, }
        });
      } else {
        throw new BadRequestException('Debe proporcionarse al menos uno de los campos requeridos: número de serie del monedero o ID Card.');
      }

      //controlTransaccion
      if (!monedero) {
        estado = EstadoTransaccion.ERROR;
        throw new BadRequestException('Monedero no encontrado');
      }

      numeroSerieMonedero = monedero.numeroSerie;

      const query = `
SELECT 
    m.Id AS idMonedero,
    p.Id AS idPasajero,
    u.Id AS idUsuarioPasajero,
    u.Nombre AS nombrePasajero,
    u.ApellidoMaterno AS apellidoMaterno
FROM
    Monederos m
        INNER JOIN
    Pasajeros p ON m.IdPasajero = p.Id
        INNER JOIN
    Usuarios u ON p.Correo = u.UserName
WHERE
    m.NumeroSerie = ?
    `;
      const pasajero = manager
        ? await manager.query(query, [numeroSerieMonedero])
        : await this.viajesRepository.query(query, [numeroSerieMonedero]);

      if (pasajero.length !== 0) {
        const { idUsuarioPasajero } = pasajero[0];
        idUsuario = idUsuarioPasajero;
      } else {
        idUsuario = null
      }

      //Obtenemos el monto con descuento
      let montoConDescuento = montoCalculado;

      if (monedero.idTipoPasajero) {
        const tipoPasajero = await catTiposRepo.findOne({
          where: { id: monedero.idTipoPasajero },
          relations: ['CatTipoDescuento'],
        });

        if (tipoPasajero && tipoPasajero.idCatTipoDescuento) {
          const tipoDescuento = Number(tipoPasajero.idCatTipoDescuento);
          const cantidad = tipoPasajero.cantidad || 0;

          switch (tipoDescuento) {
            case Number(EnumTipoDescuento.PORCENTAJE):
              montoConDescuento =
                montoConDescuento - (montoConDescuento * cantidad) / 100;
              break;
            case EnumTipoDescuento.MONETARIO:
              montoConDescuento = montoConDescuento - cantidad;
              break;
            case EnumTipoDescuento.NULO:
            default:
              break;
          }
        }
      }

      let montoFinal = Number(monedero.saldo) - montoConDescuento;

      // CRÍTICO: Validación de saldo antes de actualizar monedero y guardar transacción.
      if (montoFinal < 0) {
        estado = transicionarEstado(
          estado,
          EventoTransaccion.SALDO_INSUFICIENTE,
        );
        //Obtenemos la fecha con desfase de 6 horas
        const { fechaDesfasada } = await horaDesfasada();

        // Guardar transacción rechazada (update por id)
        await transDebitoRepo.update(idTransaccion, {
          idTipoTransaccion: EnumTipoTransaccion.RECHAZO,
          monto: montoConDescuento,
          idControlTransaccion: EnumControlTransacciones.PAGADO,
          latitudInicial: latitudInicial,
          longitudInicial: longitudInicial,
          fechaHoraInicio: fechaHoraInicio,
          distanciaInicialKm: distanciaInicial,
          latitudFinal: latitudFinal,
          longitudFinal: longitudFinal,
          fechaHoraFinal: fechaDesfasada,
          numeroSerieMonedero: numeroSerieMonedero,
          numeroSerieDispositivo: numeroSerieDispositivo,
          idViajes: idViaje,
          idUsuario: idUsuario,
        });
        const transaccionRechazo = await transDebitoRepo.findOne({ where: { id: idTransaccion } });
        if (!transaccionRechazo) throw new NotFoundException('No se pudo recuperar la transacción actualizada');
        const historicoRechazo = historicoRepo.create({
          idTipoTransaccion: transaccionRechazo.idTipoTransaccion,
          monto: transaccionRechazo.monto,
          idControlTransaccion: transaccionRechazo.idControlTransaccion,
          latitudInicial: transaccionRechazo.latitudInicial,
          longitudInicial: transaccionRechazo.longitudInicial,
          fechaHoraInicio: transaccionRechazo.fechaHoraInicio,
          distanciaInicialKm: transaccionRechazo.distanciaInicialKm,
          latitudFinal: transaccionRechazo.latitudFinal,
          longitudFinal: transaccionRechazo.longitudFinal,
          fechaHoraFinal: transaccionRechazo.fechaHoraFinal,
          numeroSerieMonedero: transaccionRechazo.numeroSerieMonedero,
          numeroSerieDispositivo: transaccionRechazo.numeroSerieDispositivo,
          idViajes: transaccionRechazo.idViajes,
          idUsuario: transaccionRechazo.idUsuario,
        });
        await historicoRepo.save(historicoRechazo);

        // Registrar en bitácora
        await this.bitacoraLogger.logToBitacora(
          'Transacciones',
          `Transacción de débito RECHAZADA por saldo insuficiente`,
          'CREATE',
          { transaccionRechazo },
          idUser,
          EnumModulos.TRANSACCIONES,
          EstatusEnumBitcora.ERROR,
          'Saldo insuficiente',
        );

        return {
          status: 'error',
          message: 'Transacción creada correctamente',
          data: {
            id: Number(idTransaccion),
            nombre: `${monedero.numeroSerie}`,
          },
        };
      }

      // 5️⃣ Si saldo OK, actualizamos el monedero y estado
      const { fechaDesfasada } = await horaDesfasada();
      const bodyTransaccionDebito = {
        idTipoTransaccion: EnumTipoTransaccion.DEBITO,
        monto: montoConDescuento,
        idControlTransaccion: EnumControlTransacciones.PAGADO,
        latitudInicial: latitudInicial,
        longitudInicial: longitudInicial,
        fechaHoraInicio: fechaHoraInicio,
        distanciaInicialKm: distanciaInicial,
        latitudFinal: latitudFinal,
        longitudFinal: longitudFinal,
        fechaHoraFinal: fechaDesfasada,
        numeroSerieMonedero: numeroSerieMonedero,
        numeroSerieDispositivo: numeroSerieDispositivo,
        idViajes: idViaje,
        idUsuario: idUsuario,
      };

      estado = transicionarEstado(estado, EventoTransaccion.SALDO_OK);

      await this.updateMonederoSaldoSafe(
        manager ?? null,
        monedero.id,
        numeroSerieMonedero,
        montoFinal,
        idUser,
      );

      // 6️⃣ Guardamos transacción aprobada (update por id)
      await transDebitoRepo.update(idTransaccion, bodyTransaccionDebito);
      const transaccionSave = await transDebitoRepo.findOne({ where: { id: idTransaccion } });
      if (!transaccionSave) throw new NotFoundException('No se pudo recuperar la transacción actualizada');
      const historicoTransaccion = historicoRepo.create({
        idTipoTransaccion: transaccionSave.idTipoTransaccion,
        monto: transaccionSave.monto,
        idControlTransaccion: transaccionSave.idControlTransaccion,
        latitudInicial: transaccionSave.latitudInicial,
        longitudInicial: transaccionSave.longitudInicial,
        fechaHoraInicio: transaccionSave.fechaHoraInicio,
        distanciaInicialKm: transaccionSave.distanciaInicialKm,
        latitudFinal: transaccionSave.latitudFinal,
        longitudFinal: transaccionSave.longitudFinal,
        fechaHoraFinal: transaccionSave.fechaHoraFinal,
        numeroSerieMonedero: transaccionSave.numeroSerieMonedero,
        numeroSerieDispositivo: transaccionSave.numeroSerieDispositivo,
        idViajes: transaccionSave.idViajes,
        idUsuario: transaccionSave.idUsuario,
      });
      await historicoRepo.save(historicoTransaccion);

      //Se guardara la transaccion en el historico de transacciones solamente cuando controltransaccion sea pagado

      // 7️⃣ Bitácora de éxito
      await this.bitacoraLogger.logToBitacora(
        'Transacciones',
        `Transacción de débito APROBADA`,
        'CREATE',
        { bodyTransaccionDebito },
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
          id: Number(idTransaccion),
          nombre: `${monedero.numeroSerie}`,
        },
      };
    } catch (error) {
      console.error('[createTransaccionDebitoByViajes]', (error as Error)?.message ?? error);
      estado = EstadoTransaccion.ERROR;
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        `Error al cerrar la transacción abiertas de débito de un viaje`,
      );
    }
  }
}
