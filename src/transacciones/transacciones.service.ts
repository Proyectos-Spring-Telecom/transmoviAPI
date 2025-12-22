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
  EnumTipoTarifa,
  EnumTipoDescuentoTransbordo,
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
import { HistoricoTransaccionesRecarga } from 'src/entities/HistoricoTransaccionesRecarga';
import { Viajes } from 'src/entities/Viajes';
import { Tarifas } from 'src/entities/Tarifas';
import { Variantes } from 'src/entities/Variantes';
import { Turnos } from 'src/entities/Turnos';
import { Instalaciones } from 'src/entities/Instalaciones';
import { Pasajeros } from 'src/entities/Pasajeros';

import { UpdateTransaccioneDebitoDto } from './dto/update-transaccione-debito.dto';
import { GetTransaccioneDto } from './dto/get-transacciones.dto';
import { GetHistoricoRecargasDto } from './dto/get-historico-recargas.dto';
import haversine from 'haversine-distance';

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
    
    @InjectRepository(HistoricoTransaccionesRecarga)
    private readonly historicoTransaccionesRecargaRepository: Repository<HistoricoTransaccionesRecarga>,
   
    @InjectRepository(Clientes)
    private readonly clienteRepository: Repository<Clientes>,
    @InjectRepository(CatTiposPasajeros)
    private readonly CatTiposPasajerosRepository: Repository<CatTiposPasajeros>,
    @InjectRepository(Pasajeros)
    private readonly pasajeroRepository: Repository<Pasajeros>,
    @InjectRepository(Monederos)
    private readonly monederoRepository: Repository<Monederos>,
    @InjectRepository(TransbordosPermitidos)
    private readonly transbordosPermitidosRepository: Repository<TransbordosPermitidos>,
    @InjectRepository(DetalleTransbordos)
    private readonly detalleTransbordosRepository: Repository<DetalleTransbordos>,
    @InjectRepository(Viajes)
    private readonly viajesRepository: Repository<Viajes>,
    @InjectRepository(Tarifas)
    private readonly tarifasRepository: Repository<Tarifas>,
    @InjectRepository(Variantes)
    private readonly variantesRepository: Repository<Variantes>,
    @InjectRepository(Turnos)
    private readonly turnosRepository: Repository<Turnos>,
    @InjectRepository(Instalaciones)
    private readonly instalacionesRepository: Repository<Instalaciones>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly monederosService: MonederosService,
    private readonly pasajeroService: PasajerosService,
  ) { }

  /**
   * Calcula la distancia en kil?metros desde el punto inicial de la variante hasta el punto de transacci?n,
   * sumando punto a punto a lo largo del recorridoDetallado
   * @param variante Variante con recorridoDetallado y puntoInicio
   * @param latitud Latitud del punto de la transacci?n
   * @param longitud Longitud del punto de la transacci?n
   * @returns Distancia en kil?metros desde el punto inicial hasta el punto de transacci?n, o 0 si no se puede calcular
   */
  private calcularDistanciaInicialKm(
    variante: Variantes | null,
    latitud: number,
    longitud: number,
  ): number {
    if (!variante?.recorridoDetallado) {
      return 0;
    }

    try {
      const recorrido = this.parsearRecorridoDetallado(variante.recorridoDetallado);
      if (!recorrido || recorrido.length === 0) {
        return 0;
      }

      const puntoTransaccion = { lat: latitud, lng: longitud };
      const puntoMasCercanoIndex = this.encontrarPuntoMasCercano(recorrido, puntoTransaccion);
      
      if (puntoMasCercanoIndex === -1) {
        return 0;
      }

      const puntoMasCercano = recorrido[puntoMasCercanoIndex];
      
      // Calcular distancia desde puntoInicio hasta el primer punto del recorrido (si son diferentes)
      const distanciaDesdePuntoInicio = this.calcularDistanciaDesdePuntoInicio(
        variante,
        recorrido[0],
      );

      // Calcular distancia acumulada a lo largo del recorrido desde el inicio hasta el punto m?s cercano
      const distanciaAcumuladaRecorrido = this.calcularDistanciaAcumuladaRecorrido(
        recorrido,
        puntoMasCercanoIndex,
      );

      // Calcular distancia desde el punto m?s cercano hasta el punto de transacci?n
      const distanciaPuntoMasCercanoATransaccion = haversine(
        puntoMasCercano,
        puntoTransaccion,
      );

      // Distancia total = distancia desde puntoInicio + distancia a lo largo del recorrido + distancia final
      const distanciaTotal = distanciaDesdePuntoInicio + 
                            distanciaAcumuladaRecorrido + 
                            distanciaPuntoMasCercanoATransaccion;

      const distanciaEnKm = parseFloat((distanciaTotal / 1000).toFixed(2));
      
      return isNaN(distanciaEnKm) || distanciaEnKm < 0 ? 0 : distanciaEnKm;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Parsea el recorridoDetallado que puede venir como string JSON o como objeto
   * @param recorridoDetallado Recorrido detallado en formato string o array
   * @returns Array de puntos con lat y lng, o null si no se puede parsear
   */
  private parsearRecorridoDetallado(
    recorridoDetallado: object | null,
  ): Array<{ lat: number; lng: number }> | null {
    if (!recorridoDetallado) {
      return null;
    }

    try {
      if (typeof recorridoDetallado === 'string') {
        return JSON.parse(recorridoDetallado);
      }
      
      return recorridoDetallado as Array<{ lat: number; lng: number }>;
    } catch {
      return null;
    }
  }

  /**
   * Extrae las coordenadas del puntoInicio de la variante
   * Soporta dos formatos: { lat, lng } o { direccion, coordenadas: { lat, lng } }
   * @param puntoInicio Punto de inicio de la variante
   * @returns Coordenadas { lat, lng } o null si no se pueden extraer
   */
  private extraerCoordenadasPuntoInicio(
    puntoInicio: object | null,
  ): { lat: number; lng: number } | null {
    if (!puntoInicio) {
      return null;
    }

    const puntoInicioRaw = puntoInicio as any;
    let lat: number | undefined;
    let lng: number | undefined;

    if (puntoInicioRaw.coordenadas) {
      lat = puntoInicioRaw.coordenadas.lat;
      lng = puntoInicioRaw.coordenadas.lng;
    } else if (puntoInicioRaw.lat !== undefined && puntoInicioRaw.lng !== undefined) {
      lat = puntoInicioRaw.lat;
      lng = puntoInicioRaw.lng;
    }

    if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }

    return null;
  }

  /**
   * Encuentra el ?ndice del punto m?s cercano en el recorrido al punto de transacci?n
   * @param recorrido Array de puntos del recorrido
   * @param puntoTransaccion Punto de la transacci?n
   * @returns ?ndice del punto m?s cercano, o -1 si no se encuentra
   */
  private encontrarPuntoMasCercano(
    recorrido: Array<{ lat: number; lng: number }>,
    puntoTransaccion: { lat: number; lng: number },
  ): number {
    let puntoMasCercanoIndex = -1;
    let distanciaMinima = Infinity;

    for (let i = 0; i < recorrido.length; i++) {
      const punto = recorrido[i];
      
      if (typeof punto.lat !== 'number' || typeof punto.lng !== 'number') {
        continue;
      }

      const distancia = haversine(punto, puntoTransaccion);

      if (distancia < distanciaMinima) {
        distanciaMinima = distancia;
        puntoMasCercanoIndex = i;
      }
    }

    return puntoMasCercanoIndex;
  }

  /**
   * Calcula la distancia desde el puntoInicio de la variante hasta el primer punto del recorrido
   * @param variante Variante con puntoInicio
   * @param primerPuntoRecorrido Primer punto del recorridoDetallado
   * @returns Distancia en metros, o 0 si no se puede calcular o si son el mismo punto
   */
  private calcularDistanciaDesdePuntoInicio(
    variante: Variantes,
    primerPuntoRecorrido: { lat: number; lng: number },
  ): number {
    if (!variante.puntoInicio || 
        typeof primerPuntoRecorrido.lat !== 'number' || 
        typeof primerPuntoRecorrido.lng !== 'number') {
      return 0;
    }

    const coordenadasPuntoInicio = this.extraerCoordenadasPuntoInicio(variante.puntoInicio);
    if (!coordenadasPuntoInicio) {
      return 0;
    }

    const distancia = haversine(coordenadasPuntoInicio, primerPuntoRecorrido);
    
    // Si la distancia es menor a 10 metros, consideramos que son el mismo punto
    return distancia > 10 ? distancia : 0;
  }

  /**
   * Calcula la distancia acumulada sumando punto a punto a lo largo del recorrido
   * desde el ?ndice 0 hasta el ?ndice del punto m?s cercano
   * @param recorrido Array de puntos del recorrido
   * @param puntoMasCercanoIndex ?ndice del punto m?s cercano
   * @returns Distancia acumulada en metros
   */
  private calcularDistanciaAcumuladaRecorrido(
    recorrido: Array<{ lat: number; lng: number }>,
    puntoMasCercanoIndex: number,
  ): number {
    if (puntoMasCercanoIndex <= 0) {
      return 0;
    }

    let distanciaAcumulada = 0;

    for (let i = 0; i < puntoMasCercanoIndex; i++) {
      const puntoActual = recorrido[i];
      const puntoSiguiente = recorrido[i + 1];

      if (
        typeof puntoActual.lat === 'number' &&
        typeof puntoActual.lng === 'number' &&
        typeof puntoSiguiente.lat === 'number' &&
        typeof puntoSiguiente.lng === 'number'
      ) {
        const distanciaSegmento = haversine(puntoActual, puntoSiguiente);
        distanciaAcumulada += distanciaSegmento;
      }
    }

    return distanciaAcumulada;
  }

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
      // Mapear latitudInicial/longitudInicial del DTO a latitudFinal/longitudFinal de la entidad
      const newTransaccion = await this.transaccionesrecargaRepository.create({
        monto: createTransaccioneRecargaDto.monto,
        latitudFinal: createTransaccioneRecargaDto.latitudInicial,
        longitudFinal: createTransaccioneRecargaDto.longitudInicial,
        numeroSerieMonedero: createTransaccioneRecargaDto.numeroSerieMonedero,
        numeroSerieValidador: createTransaccioneRecargaDto.numeroSerieValidador,
        idUsuario: idUser, // Guardar el ID del usuario que realiza la recarga
      });
      newTransaccion.idTipoTransaccion = EnumTipoTransaccion.RECARGA;
      newTransaccion.controlTransaccion = EnumControlTransacciones.PAGADO;
      

    
      const transaccionSave =
        await this.transaccionesrecargaRepository.save(newTransaccion);

      // --- Registro en la bit?cora --- SUCCESS
      const querylogger = { createTransaccioneRecargaDto };
      await this.bitacoraLogger.logToBitacora(
        'Transacciones',
        `Se realizo una transaccion de tipo RECARGA`,
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
      // --- Registro en la bit?cora --- ERROR
      console.log(JSON.stringify(error)); 
      const querylogger = { createTransaccioneRecargaDto };
      await this.bitacoraLogger.logToBitacora(
        'Transacciones',
        `Error al realizar una transaccion de tipo RECARGA`,
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
        `Error generar la transaccion de tipo RECARGA`,
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
      // 1?? Cambiamos estado a VALIDANDO_SALDO
      estado = transicionarEstado(estado, EventoTransaccion.CREAR);

      // 2?? Buscamos el monedero
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

      // 2.3?? Consulta de informaci?n de instalaci?n, validador, turno, viaje, variante y tarifa usando idViaje
      let infoValidadorViaje: any = null;
      let variante: Variantes | null = null; // Guardar la variante para calcular distancia

      if (createTransaccioneDebitoDto.idViaje) {
        // Buscar el viaje con sus relaciones
        const viaje = await this.viajesRepository.findOne({
          where: { id: createTransaccioneDebitoDto.idViaje },
          relations: ['idVariante2', 'idTurno2'],
        });

        if (!viaje) {
          throw new NotFoundException(`El viaje con ID ${createTransaccioneDebitoDto.idViaje} no existe`);
        }

        // Guardar la variante para calcular la distancia
        // Asegurarnos de obtener la variante completa con todos sus campos
        if (viaje.idVariante) {
          variante = await this.variantesRepository.findOne({
            where: { id: viaje.idVariante },
          });
        } else {
          variante = viaje.idVariante2;
        }

        // Obtener el turno con la instalaci?n
        const turno = await this.turnosRepository.findOne({
          where: { id: viaje.idTurno },
          relations: ['idInstalacion2'],
        });

        if (!turno) {
          throw new NotFoundException(`El turno con ID ${viaje.idTurno} no existe`);
        }

        // Obtener la instalaci?n con el validador
        const instalacion = await this.instalacionesRepository.findOne({
          where: { id: turno.idInstalacion },
          relations: ['validadores'],
        });

        if (!instalacion) {
          throw new NotFoundException(`La instalaci?n con ID ${turno.idInstalacion} no existe`);
        }

        // Obtener la tarifa de la variante
        const tarifa = await this.tarifasRepository.findOne({
          where: { idVariante: viaje.idVariante },
        });

        // Construir el objeto con la misma estructura que el query anterior
        infoValidadorViaje = [{
          id: instalacion.id,
          NumeroSerie: instalacion.validadores?.numeroSerie || null,
          Estatus: turno.estatus,
          turno: turno.id,
          inicioTurno: turno.inicio,
          idViaje: viaje.id,
          idVariante: viaje.idVariante,
          nombreVariante: viaje.idVariante2?.nombre || null,
          TarifaBase: tarifa?.tarifaBase || null,
          CostoAdicional: tarifa?.costoAdicional || null,
          TipoTarifa: tarifa?.tipoTarifa || null,
        }];
      } else {
        // Si no se proporciona idViaje, mantener la l?gica anterior con el query SQL
        infoValidadorViaje = await this.transaccionesdebitoRepository.query(
          `
          SELECT 
            i.Id AS id,
            v.NumeroSerie,
            t.Estatus,
            t.Id AS turno,
            t.Inicio AS inicioTurno,
            vi.Id AS idViaje,
            vi.IdVariante AS idVariante,
            va.Nombre AS nombreVariante,
            ta.TarifaBase,
            ta.CostoAdicional,
            ta.TipoTarifa
          FROM DashCamDev.Instalaciones i
          JOIN DashCamDev.Validadores v ON i.IdValidador = v.Id
          JOIN DashCamDev.Turnos t ON t.IdInstalacion = i.Id
          JOIN DashCamDev.Viajes vi ON vi.IdTurno = t.Id
          JOIN DashCamDev.Variantes va ON va.Id = vi.IdVariante
          JOIN DashCamDev.Tarifas ta ON ta.IdVariante = va.Id
          WHERE v.NumeroSerie = ?
            AND DATE(vi.Inicio) = CURDATE()
            AND vi.Inicio <= NOW()
            AND t.Estatus = 1
            AND vi.EstadoActual = 1
          LIMIT 1
          `,
          [createTransaccioneDebitoDto.numeroSerieValidador],
        );

        // Obtener la variante para calcular la distancia
        if (infoValidadorViaje && infoValidadorViaje.length > 0 && infoValidadorViaje[0].idVariante) {
          variante = await this.variantesRepository.findOne({
            where: { id: infoValidadorViaje[0].idVariante },
          });
        }
      }

      // 2.4?? Validar que tenemos informaci?n de tarifa
      if (!infoValidadorViaje || infoValidadorViaje.length === 0 || !infoValidadorViaje[0].TipoTarifa) {
        throw new BadRequestException('No se pudo obtener la informaci?n de tarifa del viaje');
      }

      const tarifaInfo = infoValidadorViaje[0];
      const tipoTarifa = Number(tarifaInfo.TipoTarifa);
      const tarifaBase = Number(tarifaInfo.TarifaBase) || 0;
      const idViaje = tarifaInfo.idViaje ? Number(tarifaInfo.idViaje) : null;

      // 2.5?? Determinamos controlTransaccion seg?n el tipo de tarifa
      // Si TipoTarifa = 1 (Fija), controlTransaccion = PAGADO
      // Si TipoTarifa = 2 (Abierta), controlTransaccion = ABIERTA
      let controlTransaccion: EnumControlTransacciones;
      if (tipoTarifa === EnumTipoTarifa.FIJA) {
        controlTransaccion = EnumControlTransacciones.PAGADO;
      } else if (tipoTarifa === EnumTipoTarifa.ABIERTA) {
        controlTransaccion = EnumControlTransacciones.ABIERTA;
      } else {
        // Por defecto, si no se puede determinar, usar PAGADO
        controlTransaccion = EnumControlTransacciones.PAGADO;
      }

      // 2.6?? Calculamos el monto seg?n el tipo de tarifa
      // Si TipoTarifa = 1 (Fija), usar TarifaBase
      // Si TipoTarifa = 2 (Abierta), tambi?n usar TarifaBase (o se puede extender la l?gica)
      let montoCalculado = tarifaBase;
      
      if (tipoTarifa === EnumTipoTarifa.FIJA) {
        montoCalculado = tarifaBase;
      } else if (tipoTarifa === EnumTipoTarifa.ABIERTA) {
        // Para tarifa abierta, usar TarifaBase (puede extenderse con l?gica adicional)
        montoCalculado = tarifaBase;
      }

      // 2.6?? Calculamos el numeroTransbordo y aplicamos el descuento del transbordo (opcional)
      // Si no existe un transbordo para el cliente, continuamos con la l?gica normal
      let numeroTransbordo: number | null = null;
      
      // Buscar el transbordo que pertenezca al cliente
      const transbordoPermitido = await this.transbordosPermitidosRepository.findOne({
        where: { 
          idCliente: Number(monedero.idCliente),
        },
        relations: ['tipoDescuento'],
      });
      
      // Solo aplicamos la l?gica de transbordos si existe configuraci?n para el cliente
      if (transbordoPermitido && transbordoPermitido.tiempo && transbordoPermitido.numeroTransbordos) {
        // Calculamos la fecha l?mite hacia atr?s (tiempo en minutos)
        // Aplicar desfase de -6 horas para la zona horaria
        const ahora = new Date();
        const desfaseMs = -6 * 60 * 60 * 1000; // -6 horas en milisegundos
        const fechaHoraTransaccion = new Date(ahora.getTime() + desfaseMs);
        const tiempoEnMs = transbordoPermitido.tiempo * 60 * 1000; // Convertir minutos a milisegundos
        const fechaLimite = new Date(fechaHoraTransaccion.getTime() - tiempoEnMs);

        // Buscamos transacciones en el rango de tiempo con el mismo numeroSerieMonedero
        // Priorizamos fechaHoraInicio ya que ahora guardamos con ese campo
        // Usamos < en lugar de <= para evitar problemas con transacciones en el mismo momento
        const transaccionesEnRango = await this.transaccionesdebitoRepository
          .createQueryBuilder('td')
          .where('td.numeroSerieMonedero = :numeroSerieMonedero', {
            numeroSerieMonedero: createTransaccioneDebitoDto.numeroSerieMonedero,
          })
          .andWhere('COALESCE(td.fechaHoraInicio, td.fechaHoraFinal, td.fhRegistro) >= :fechaLimite', { fechaLimite })
          .andWhere('COALESCE(td.fechaHoraInicio, td.fechaHoraFinal, td.fhRegistro) < :fechaHoraTransaccion', { fechaHoraTransaccion })
          .orderBy('COALESCE(td.fechaHoraInicio, td.fechaHoraFinal, td.fhRegistro)', 'ASC')
          .getMany();

        console.log('Transbordos - Transacciones en rango:', transaccionesEnRango.length, '| NumeroTransbordos:', transaccionesEnRango.map(t => t.numeroTransbordo));

        if (transaccionesEnRango.length === 0) {
          // Es la primera transacci?n en ese rango de tiempo (cobro inicial)
          numeroTransbordo = 0;
          console.log('NumeroTransbordo asignado: 0 (primera transacci?n)');
        } else {
          // Buscamos la transacci?n con numeroTransbordo = 0 (el cobro inicial)
          const cobroInicial = transaccionesEnRango.find((t) => t.numeroTransbordo === 0);
          
          if (cobroInicial) {
            // Calculamos si el tiempo desde el cobro inicial ya pas?
            const fechaCobroInicial = new Date(
              cobroInicial.fechaHoraInicio || cobroInicial.fechaHoraFinal || cobroInicial.fhRegistro
            );
            const fechaExpiracionCobroInicial = new Date(
              fechaCobroInicial.getTime() + tiempoEnMs,
            );

            // Si el tiempo desde el cobro inicial ya pas?, reiniciamos el contador a 0
            if (fechaHoraTransaccion > fechaExpiracionCobroInicial) {
              numeroTransbordo = 0;
              console.log('NumeroTransbordo asignado: 0 (tiempo expirado)');
            } else {
              // El cobro inicial todav?a est? vigente, continuamos con el consecutivo (1, 2, 3, etc.)
              // Incluimos todos los n?meros de transbordo (incluyendo 0) para calcular correctamente el m?ximo
              const numerosTransbordo = transaccionesEnRango
                .map((t) => t.numeroTransbordo)
                .filter((n) => n !== null && n !== undefined) as number[];

              if (numerosTransbordo.length > 0) {
                const maxNumeroTransbordo = Math.max(...numerosTransbordo);
                const siguienteTransbordo = maxNumeroTransbordo + 1;
                
                // Validar si se alcanz? el n?mero m?ximo de transbordos permitidos
                // Si se alcanz? o super? el m?ximo, reiniciamos el contador a 0
                if (siguienteTransbordo > transbordoPermitido.numeroTransbordos) {
                  numeroTransbordo = 0;
                  console.log('NumeroTransbordo asignado: 0 (m?ximo alcanzado)');
                } else {
                  numeroTransbordo = siguienteTransbordo;
                  console.log('NumeroTransbordo asignado:', numeroTransbordo, '(incrementado desde', maxNumeroTransbordo, ')');
                }
              } else {
                numeroTransbordo = 1;
                console.log('NumeroTransbordo asignado: 1 (primer transbordo despu?s del inicial)');
              }
            }
          } else {
            // No hay cobro inicial (numeroTransbordo = 0) en el rango, empezamos en 0
            numeroTransbordo = 0;
            console.log('NumeroTransbordo asignado: 0 (no hay cobro inicial en rango)');
          }
        }
        
        console.log('NumeroTransbordo final:', numeroTransbordo);

        // Buscamos el costo del transbordo en DetalleTransbordos y aplicamos el descuento seg?n el tipo
        // Aplicamos el descuento si numeroTransbordo no es null (incluye 0) y hay tipo de descuento configurado
        if (numeroTransbordo !== null && transbordoPermitido.id && transbordoPermitido.idTipoDescuento) {
          const detalleTransbordo = await this.detalleTransbordosRepository.findOne({
            where: {
              idTransbordo: transbordoPermitido.id,
              nroTransbordo: numeroTransbordo,
            },
          });

          // Si encontramos el detalle, aplicamos el descuento seg?n el tipo
          if (detalleTransbordo && detalleTransbordo.costo !== null) {
            const tipoDescuentoTransbordo = Number(transbordoPermitido.idTipoDescuento);
            const costoTransbordo = Number(detalleTransbordo.costo);

            console.log('Descuento transbordo - Tipo:', tipoDescuentoTransbordo, '| Enum MONETARIO:', EnumTipoDescuentoTransbordo.MONETARIO, '| Enum PORCENTAJE:', EnumTipoDescuentoTransbordo.PORCENTAJE, '| Costo:', costoTransbordo, '| NumeroTransbordo:', numeroTransbordo, '| TarifaBase:', tarifaBase);

            if (tipoDescuentoTransbordo === EnumTipoDescuentoTransbordo.MONETARIO) {
              // Si es monetario, descuento directo del costo del transbordo de la tarifa base
              montoCalculado = tarifaBase - costoTransbordo;
              console.log('Aplicado descuento MONETARIO:', montoCalculado);
            } else if (tipoDescuentoTransbordo === EnumTipoDescuentoTransbordo.PORCENTAJE) {
              // Si es porcentaje, descuento porcentual calculado de la tarifa base
              // costoTransbordo contiene el porcentaje (ej: 10 = 10%)
              const descuentoPorcentual = (tarifaBase * costoTransbordo) / 100;
              montoCalculado = tarifaBase - descuentoPorcentual;
              console.log('Aplicado descuento PORCENTAJE - Descuento:', descuentoPorcentual, '| Monto final:', montoCalculado);
            } else {
              console.log('Tipo de descuento no reconocido:', tipoDescuentoTransbordo, '- No se aplica descuento');
            }
            
            // Asegurar que el monto no sea negativo
            if (montoCalculado < 0) {
              montoCalculado = 0;
            }
            
            console.log('Monto calculado despu?s del descuento:', montoCalculado);
          } else {
            console.log('No se encontr? detalle transbordo para nroTransbordo:', numeroTransbordo);
          }
        }
      }

      // 3?? Calculamos monto final (aqu? se pueden aplicar descuentos si existen)
      let montoConDescuento = montoCalculado;

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

      // 4?? Validaci?n de saldo
      if (montoFinal < 0) {
        estado = transicionarEstado(
          estado,
          EventoTransaccion.SALDO_INSUFICIENTE,
        );

        // Guardar transacci?n rechazada
        // Mapear latitud/longitud a latitudInicial/longitudInicial
        // Aplicar desfase de -6 horas para la zona horaria
        const ahora = new Date();
        const desfaseMs = -6 * 60 * 60 * 1000; // -6 horas en milisegundos
        const fechaHoraInicio = new Date(ahora.getTime() + desfaseMs);
        
        // Calcular distancia inicial desde el punto inicial de la variante
        const distanciaInicialKm = this.calcularDistanciaInicialKm(
          variante,
          createTransaccioneDebitoDto.latitud,
          createTransaccioneDebitoDto.longitud,
        );
        
        // Asegurar que el valor sea un n?mero v?lido
        const distanciaInicialKmFinal = (typeof distanciaInicialKm === 'number' && !isNaN(distanciaInicialKm)) 
          ? parseFloat(distanciaInicialKm.toFixed(2)) 
          : 0;
        
        const newTransaccion = this.transaccionesdebitoRepository.create({
          idTipoTransaccion: EnumTipoTransaccion.RECHAZO,
          monto: montoConDescuento,
          controlTransaccion: EnumControlTransacciones.PAGADO,
          latitudInicial: createTransaccioneDebitoDto.latitud,
          longitudInicial: createTransaccioneDebitoDto.longitud,
          distanciaInicialKm: distanciaInicialKmFinal,
          fechaHoraInicio: fechaHoraInicio,
          numeroSerieMonedero: createTransaccioneDebitoDto.numeroSerieMonedero,
          numeroSerieValidador: createTransaccioneDebitoDto.numeroSerieValidador,
          idViaje: idViaje,
        });
        await this.transaccionesdebitoRepository.save(newTransaccion);
        
        //se guarda en el historico
        await this.historicoTransaccionesDebitoRepository.save(newTransaccion);

        // Registrar en bit?cora
        await this.bitacoraLogger.logToBitacora(
          'Transacciones',
          `Transacci?n de d?bito RECHAZADA por saldo insuficiente`,
          'CREATE',
          { createTransaccioneDebitoDto },
          idUser,
          EnumModulos.TRANSACCIONES,
          EstatusEnumBitcora.ERROR,
          'Saldo insuficiente',
        );

        throw new BadRequestException('Saldo insuficiente');
      }

      // 5?? Si saldo OK, actualizamos el monedero y estado
      estado = transicionarEstado(estado, EventoTransaccion.SALDO_OK);
      
      // Solo actualizar el saldo del monedero si la transacci?n es PAGADO
      // Si es ABIERTA, no se descuenta el saldo todav?a
      let montoAGuardar = 0;
      if (controlTransaccion === EnumControlTransacciones.PAGADO) {
        await this.monederosService.updateMonederoSaldo(
          createTransaccioneDebitoDto.numeroSerieMonedero,
          idUser,
          montoFinal,
        );
        montoAGuardar = montoConDescuento;
      } else {
        // Para transacciones ABIERTAS, el monto se guarda como 0
        montoAGuardar = 0;
      }

      // 6?? Guardamos transacci?n aprobada
      // Mapear latitud/longitud a latitudInicial/longitudInicial
      // Aplicar desfase de -6 horas para la zona horaria
      const ahora = new Date();
      const desfaseMs = -6 * 60 * 60 * 1000; // -6 horas en milisegundos
      const fechaHoraInicio = new Date(ahora.getTime() + desfaseMs);
      
      // Calcular distancia inicial desde el punto inicial de la variante
      const distanciaInicialKm = this.calcularDistanciaInicialKm(
        variante,
        createTransaccioneDebitoDto.latitud,
        createTransaccioneDebitoDto.longitud,
      );
      
      // Asegurar que el valor sea un n?mero v?lido
      const distanciaInicialKmFinal = (typeof distanciaInicialKm === 'number' && !isNaN(distanciaInicialKm)) 
        ? parseFloat(distanciaInicialKm.toFixed(2)) 
        : 0;
      
      const newTransaccion = this.transaccionesdebitoRepository.create({
        idTipoTransaccion: EnumTipoTransaccion.DEBITO,
        monto: montoAGuardar,
        controlTransaccion: controlTransaccion,
        latitudInicial: createTransaccioneDebitoDto.latitud,
        longitudInicial: createTransaccioneDebitoDto.longitud,
        distanciaInicialKm: distanciaInicialKmFinal,
        fechaHoraInicio: fechaHoraInicio,
        numeroSerieMonedero: createTransaccioneDebitoDto.numeroSerieMonedero,
        numeroSerieValidador: createTransaccioneDebitoDto.numeroSerieValidador,
        numeroTransbordo,
        idViaje: idViaje,
      });
      const transaccionSave =
        await this.transaccionesdebitoRepository.save(newTransaccion);
      
      let transaccionSaveHis;

      //Se guardara la transaccion en el historico de transacciones solamente cuando controltransaccion sea pagado
      if (controlTransaccion === EnumControlTransacciones.PAGADO) {
        transaccionSaveHis =
          await this.historicoTransaccionesDebitoRepository.save(newTransaccion);
        // 7?? Bit?cora de ?xito //controltransaccion pagado----
        await this.bitacoraLogger.logToBitacora(
          'Transacciones',
          `Transacci?n de d?bito APROBADA`,
          'CREATE',
          { createTransaccioneDebitoDto },
          idUser,
          EnumModulos.TRANSACCIONES,
          EstatusEnumBitcora.SUCCESS,
        );

        // 8?? Finalizamos la transacci?n //controltransaccion pagado----
        estado = transicionarEstado(estado, EventoTransaccion.FINALIZAR);

        return {
          status: 'success',
          message: 'Transacci?n creada correctamente',
          data: {
            id: Number(transaccionSaveHis.id) || Number(transaccionSave.id),
            nombre: `${monedero.numeroSerie}`,
          },
        };
      } else {
        // 7?? Bit?cora de ?xito para transacciones ABIERTAS
        await this.bitacoraLogger.logToBitacora(
          'Transacciones',
          `Transacci?n de d?bito APROBADA (ABIERTA)`,
          'CREATE',
          { createTransaccioneDebitoDto },
          idUser,
          EnumModulos.TRANSACCIONES,
          EstatusEnumBitcora.SUCCESS,
        );

        // 8?? Finalizamos la transacci?n
        estado = transicionarEstado(estado, EventoTransaccion.FINALIZAR);

        return {
          status: 'success',
          message: 'Transacci?n creada correctamente',
          data: {
            id: Number(transaccionSave.id),
            nombre: `${monedero?.numeroSerie || createTransaccioneDebitoDto.numeroSerieMonedero}`,
          },
        };
      }
    } catch (error) {
      estado = EstadoTransaccion.ERROR;
      if (error instanceof HttpException) {
        throw error;
      }

      // Bit?cora de error
      const querylogger = { createTransaccioneDebitoDto };
      await this.bitacoraLogger.logToBitacora(
        'Transacciones',
        `Error en transacci?n de d?bito`,
        'CREATE',
        querylogger,
        idUser,
        EnumModulos.TRANSACCIONES,
        EstatusEnumBitcora.ERROR,
        error.message,
      );

      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException(
        `Error al generar la transacci?n de d?bito`,
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

      // 3?? Calculamos monto final (aqu? se pueden aplicar descuentos si existen)
      // Si no se proporciona monto, obtenerlo de la transacci?n existente
      let montoBase = updateTransaccioneDebitoDto.monto;
      if (!montoBase) {
        const transaccionExistente = await this.transaccionesdebitoRepository.findOne({
          where: { id: updateTransaccioneDebitoDto.idTransaccionDebito }
        });
        if (!transaccionExistente) {
          throw new NotFoundException('La transacci?n no existe');
        }
        montoBase = transaccionExistente.monto;
      }
      let montoConDescuento = Number(montoBase);

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

      // 4?? Validaci?n de saldo
      if (montoFinal < 0) {
        updateTransaccioneDebitoDto.idTipoTransaccion =
          EnumTipoTransaccion.RECHAZO;

        // Obtener idViaje de la transacci?n existente si existe
        let idViajeUpdate: number | null = null;
        if (updateTransaccioneDebitoDto.idTransaccionDebito) {
          const transaccionExistente = await this.transaccionesdebitoRepository.findOne({
            where: { id: updateTransaccioneDebitoDto.idTransaccionDebito }
          });
          idViajeUpdate = transaccionExistente?.idViaje || null;
        }

        // Guardar transacci?n rechazada
        const updateTransaccion = this.transaccionesdebitoRepository.create({
          idTipoTransaccion: EnumTipoTransaccion.RECHAZO,
          monto: montoFinal,
          controlTransaccion: EnumControlTransacciones.PAGADO,
          latitudFinal: updateTransaccioneDebitoDto.latitudFinal,
          longitudFinal: updateTransaccioneDebitoDto.longitudFinal,
          fechaHoraFinal: updateTransaccioneDebitoDto.fechaHoraFinal,
          numeroSerieMonedero: updateTransaccioneDebitoDto.numeroSerieMonedero,
          numeroSerieValidador: updateTransaccioneDebitoDto.numeroSerieValidador,
          idViaje: idViajeUpdate,
        }
        );
        await this.transaccionesdebitoRepository.save(updateTransaccion);
        //se guarda en el historico
        await this.historicoTransaccionesDebitoRepository.save(updateTransaccion);

        // Registrar en bit?cora
        await this.bitacoraLogger.logToBitacora(
          'Transacciones',
          `Transacci?n de d?bito RECHAZADA por saldo insuficiente`,
          'CREATE',
          { updateTransaccioneDebitoDto },
          idUser,
          EnumModulos.TRANSACCIONES,
          EstatusEnumBitcora.ERROR,
          'Saldo insuficiente',
        );

        throw new BadRequestException('Saldo insuficiente');
      }

      // 5?? Si saldo OK, actualizamos el monedero y estado
      await this.monederosService.updateMonederoSaldo(
        updateTransaccioneDebitoDto.numeroSerieMonedero,
        idUser,
        montoFinal,
      );

      // 6?? Guardamos transacci?n aprobada
      // Construir objeto de actualizaci?n solo con los campos proporcionados
      const updateData: any = {
        idTipoTransaccion: EnumTipoTransaccion.DEBITO,
        monto: montoConDescuento,
        controlTransaccion: EnumControlTransacciones.PAGADO,
      };

      // Solo agregar campos opcionales si se proporcionan
      if (updateTransaccioneDebitoDto.latitudFinal !== undefined) {
        updateData.latitudFinal = updateTransaccioneDebitoDto.latitudFinal;
      }
      if (updateTransaccioneDebitoDto.longitudFinal !== undefined) {
        updateData.longitudFinal = updateTransaccioneDebitoDto.longitudFinal;
      }
      if (updateTransaccioneDebitoDto.fechaHoraFinal !== undefined) {
        updateData.fechaHoraFinal = updateTransaccioneDebitoDto.fechaHoraFinal;
      }
      if (updateTransaccioneDebitoDto.numeroSerieMonedero) {
        updateData.numeroSerieMonedero = updateTransaccioneDebitoDto.numeroSerieMonedero;
      }
      if (updateTransaccioneDebitoDto.numeroSerieValidador) {
        updateData.numeroSerieValidador = updateTransaccioneDebitoDto.numeroSerieValidador;
      }

      await this.transaccionesdebitoRepository.update(
        updateTransaccioneDebitoDto.idTransaccionDebito,
        updateData
      );
      const transaccionSave =
        await this.transaccionesdebitoRepository.findOne({
          where: {
            id: updateTransaccioneDebitoDto.idTransaccionDebito
          }
        });

      if (!transaccionSave) {
        throw new NotFoundException('La transacci?n no existe');
      }

      const { id: _, ...transaccionBody } = transaccionSave

      const transaccionSaveHis =
        await this.historicoTransaccionesDebitoRepository.save(transaccionBody);


      return {
        status: 'success',
        message: 'Transacci?n creada correctamente',
        data: {
          id: Number(transaccionSaveHis.id),
          nombre: `${monedero.numeroSerie}`,
        },
      };
    } catch (error) {
      // --- Registro en la bit?cora --- ERROR
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

    const idsFiltrados = clientesFiltrado[0]; // El primer ?ndice contiene los resultados
    const ids = idsFiltrados
      .map((clientesFiltrado: any) => Number(clientesFiltrado.Id))
      .filter(Boolean);
    if (ids.length === 0) {
      return { data: [] }; // No hay clientes que consultar
    }

    // 3. Construir el query din?mico con los IDs
    const placeholders = ids.map(() => '?').join(', ');
    return { ids, placeholders };
  }

  async paginado(
    idUser: number,
    email: string,
    cliente: number,
    rol: number,
    page: number,
    limit: number,
    fechaInicio?: string,
    fechaFin?: string
  ) {
    try {
      //Declaramos las variables para el consumo del api
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
        console.log(fechaInicio, fechaFin, fechaActual, entidadDebito, entidadRecarga, rol);
        transacciones = await this.resolverPorRolDefault(fechaInicio, fechaFin, email, cliente, rol, page, limit, entidadDebito, entidadRecarga);
      } else {
        //Si fechaInicio y fechaFin no son null arroja las transacciones del dia de la tabla HistoricoTransaccionesRecarga y HistoricoTransaccionesDebito
        //asigna fechaActual solo si el valor de la izquierda es null o undefined
        fechaInicio = fechaInicio?.split("T")[0] ?? fechaActual;
        fechaFin = fechaFin?.split("T")[0] ?? fechaActual;
        entidadRecarga = 'HistoricoTransaccionesRecarga';
        entidadDebito = 'HistoricoTransaccionesDebito';
        console.log(fechaInicio, fechaFin, fechaActual, entidadDebito, entidadRecarga, rol);
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
      switch (rol) {
        case 1:
          transacciones = await this.transaccionesrecargaRepository.query(
            `
SELECT 
    'DEBITO' AS origenTabla,        -- ?? de qu? tabla viene
    td.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- ?? tipo seg?n el cat?logo (RECARGA, DEBITO o RECHAZADO)
    td.Monto AS monto,
    td.LatitudInicial AS latitudInicial,
    td.LongitudInicial AS longitudInicial,
    td.LatitudFinal AS latitudFinal,
    td.LongitudFinal AS longitudFinal,
    td.FechaHoraInicio AS fechaHoraInicio,
    td.FechaHoraFinal AS fechaHoraFinal,
    td.FHRegistro AS fhRegistro,
    td.NumeroSerieMonedero AS numeroSerieMonedero,
    td.NumeroSerieValidador AS numeroSerieValidador,

    -- Datos del cliente
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,
    

    -- Datos del dispositivo
    d.Marca AS marcaDispositivo,
    d.Modelo AS modeloDispositivo,

    -- Pasajero (v?a Monedero)
    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero

FROM ${entidadDebito} td
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
    
-- condiciones
WHERE DATE(td.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'


UNION ALL

SELECT 
    'RECARGA' AS origenTabla,       -- ?? solo indica de qu? tabla proviene
    tr.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- ?? valor real del tipo
    tr.Monto AS monto,
    NULL AS latitudInicial,
    NULL AS longitudInicial,
    tr.LatitudFinal AS latitudFinal,
    tr.LongitudFinal AS longitudFinal,
    NULL AS fechaHoraInicio,
    tr.FechaHoraFinal AS fechaHoraFinal,
    tr.FHRegistro AS fhRegistro,
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieValidador AS numeroSerieValidador,

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
LEFT JOIN Validadores  d 
    ON tr.NumeroSerieValidador = d.NumeroSerie
INNER JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
INNER JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE DATE(tr.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'

ORDER BY FHRegistro DESC
  LIMIT ? OFFSET ?;
        `,
            [limit, offset],
          );

          // Query para total (sin paginaci?n)
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
INNER JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE DATE(td.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'

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
INNER JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE DATE(tr.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'
) AS todas;
		
  `,
          );
          break;

        case 3:
        default:
          //Usuarios Operador
          transacciones = await this.transaccionesrecargaRepository.query(
            `
SELECT 
    'DEBITO' AS origenTabla,        -- ?? de qu? tabla viene
    td.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- ?? tipo seg?n el cat?logo (RECARGA, DEBITO o RECHAZADO)
    td.Monto AS monto,
    td.LatitudInicial AS latitudInicial,
    td.LongitudInicial AS longitudInicial,
    td.LatitudFinal AS latitudFinal,
    td.LongitudFinal AS longitudFinal,
    td.FechaHoraInicio AS fechaHoraInicio,
    td.FechaHoraFinal AS fechaHoraFinal,
    td.FHRegistro AS fhRegistro,
    td.NumeroSerieMonedero AS numeroSerieMonedero,
    td.NumeroSerieValidador AS numeroSerieValidador,

    -- Datos del cliente
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,
    

    -- Datos del dispositivo
    d.Marca AS marcaDispositivo,
    d.Modelo AS modeloDispositivo,

    -- Pasajero (v?a Monedero)
    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero

FROM ${entidadDebito} td
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
    
-- condiciones
WHERE DATE(td.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'
AND m.IdCliente = ?


UNION ALL

SELECT 
    'RECARGA' AS origenTabla,       -- ?? solo indica de qu? tabla proviene
    tr.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- ?? valor real del tipo
    tr.Monto AS monto,
    NULL AS latitudInicial,
    NULL AS longitudInicial,
    tr.LatitudFinal AS latitudFinal,
    tr.LongitudFinal AS longitudFinal,
    NULL AS fechaHoraInicio,
    tr.FechaHoraFinal AS fechaHoraFinal,
    tr.FHRegistro AS fhRegistro,
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieValidador AS numeroSerieValidador,

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
LEFT JOIN Validadores d 
    ON tr.NumeroSerieValidador = d.NumeroSerie
INNER JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
INNER JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE DATE(tr.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'
AND m.IdCliente = ?

ORDER BY FHRegistro DESC
LIMIT ? OFFSET ?;

        `,
            [cliente, cliente, limit, offset],
          );

          // Query para total (sin paginaci?n)
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
INNER JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE DATE(td.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'
AND m.IdCliente = ?

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
INNER JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE DATE(tr.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'
AND m.IdCliente = ?


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
SELECT 
    'DEBITO' AS origenTabla,        -- ?? de qu? tabla viene
    td.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- ?? tipo seg?n el cat?logo (RECARGA, DEBITO o RECHAZADO)
    td.Monto AS monto,
    td.LatitudInicial AS latitudInicial,
    td.LongitudInicial AS longitudInicial,
    td.LatitudFinal AS latitudFinal,
    td.LongitudFinal AS longitudFinal,
    td.FechaHoraInicio AS fechaHoraInicio,
    td.FechaHoraFinal AS fechaHoraFinal,
    td.FHRegistro AS fhRegistro,
    td.NumeroSerieMonedero AS numeroSerieMonedero,
    td.NumeroSerieValidador AS numeroSerieValidador,

    -- Datos del cliente
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,
    

    -- Datos del dispositivo
    d.Marca AS marcaDispositivo,
    d.Modelo AS modeloDispositivo,

    -- Pasajero (v?a Monedero)
    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero

FROM ${entidadDebito} td
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
    
-- condiciones
WHERE DATE(td.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'
AND m.Estatus = 1
AND p.Id = ?


UNION ALL

SELECT 
    'RECARGA' AS origenTabla,       -- ?? solo indica de qu? tabla proviene
    tr.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- ?? valor real del tipo
    tr.Monto AS monto,
    NULL AS latitudInicial,
    NULL AS longitudInicial,
    tr.LatitudFinal AS latitudFinal,
    tr.LongitudFinal AS longitudFinal,
    NULL AS fechaHoraInicio,
    tr.FechaHoraFinal AS fechaHoraFinal,
    tr.FHRegistro AS fhRegistro,
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieValidador AS numeroSerieValidador,

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
LEFT JOIN Validadores d 
    ON tr.NumeroSerieValidador = d.NumeroSerie
INNER JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
INNER JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE DATE(tr.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'
AND m.Estatus = 1
AND p.Id = ?

ORDER BY FHRegistro DESC
LIMIT ? OFFSET ?;

        `,
            [Number(pasajero.id), Number(pasajero.id), limit, offset],
          );

          // Query para total (sin paginaci?n)
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
INNER JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE DATE(td.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'
AND m.Estatus = 1
AND p.Id = ?

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
INNER JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE DATE(tr.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'
AND m.Estatus = 1
AND p.Id = ?

) AS todas;

  `,
            [Number(pasajero.id), Number(pasajero.id)], // <-- Aqu? debe ir como segundo argumento de query()
          );

          break;

        case 2:
        case 8:
        case 10:
          //resto usuarios
          const { ids, placeholders } = await this.clienteHijos(cliente);
          transacciones = await this.transaccionesrecargaRepository.query(
            `
SELECT 
    'DEBITO' AS origenTabla,        -- ?? de qu? tabla viene
    td.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- ?? tipo seg?n el cat?logo (RECARGA, DEBITO o RECHAZADO)
    td.Monto AS monto,
    td.LatitudInicial AS latitudInicial,
    td.LongitudInicial AS longitudInicial,
    td.LatitudFinal AS latitudFinal,
    td.LongitudFinal AS longitudFinal,
    td.FechaHoraInicio AS fechaHoraInicio,
    td.FechaHoraFinal AS fechaHoraFinal,
    td.FHRegistro AS fhRegistro,
    td.NumeroSerieMonedero AS numeroSerieMonedero,
    td.NumeroSerieValidador AS numeroSerieValidador,

    -- Datos del cliente
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,
    

    -- Datos del dispositivo
    d.Marca AS marcaDispositivo,
    d.Modelo AS modeloDispositivo,

    -- Pasajero (v?a Monedero)
    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero

FROM ${entidadDebito} td
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
    
-- condiciones
WHERE DATE(td.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'
AND m.IdCliente IN (${placeholders})   -- ?? aqu? colocas el ID del cliente que quieres consultar


UNION ALL

SELECT 
    'RECARGA' AS origenTabla,       -- ?? solo indica de qu? tabla proviene
    tr.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- ?? valor real del tipo
    tr.Monto AS monto,
    NULL AS latitudInicial,
    NULL AS longitudInicial,
    tr.LatitudFinal AS latitudFinal,
    tr.LongitudFinal AS longitudFinal,
    NULL AS fechaHoraInicio,
    tr.FechaHoraFinal AS fechaHoraFinal,
    tr.FHRegistro AS fhRegistro,
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieValidador AS numeroSerieValidador,

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
LEFT JOIN Validadores d 
    ON tr.NumeroSerieValidador = d.NumeroSerie
INNER JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
INNER JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE DATE(tr.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'
AND m.IdCliente IN (${placeholders})   -- ?? aqu? colocas el ID del cliente que quieres consultar

ORDER BY FHRegistro DESC
LIMIT ? OFFSET ?;

        `,
            [...ids, ...ids, limit, offset],
          );

          // Query para total (sin paginaci?n)
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
INNER JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE DATE(td.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'
AND m.IdCliente IN (${placeholders})   -- ?? aqu? colocas el ID del cliente que quieres consultar

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
INNER JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE DATE(tr.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'
AND m.IdCliente IN (${placeholders})   -- ?? aqu? colocas el ID del cliente que quieres consultar


) AS todas;

  `,
            [...ids, ...ids],
          );
          break;
      }

      const total = Number(totalResult[0]?.total || 0);

      // ?? Transformaci?n de datos (ids ? number, nombreCompleto)
      const data = transacciones.map((item) => ({
        ...item,
        id: Number(item.id),
        monto: Number(item.monto),
        latitudInicial: item.latitudInicial ? Number(item.latitudInicial) : null,
        longitudInicial: item.longitudInicial ? Number(item.longitudInicial) : null,
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
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({
        message: 'Error al obtener transacciones paginadas por rol',
      });
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
          transacciones = await this.transaccionesrecargaRepository.query(
            `
SELECT 
    'DEBITO' AS origenTabla,        -- ?? de qu? tabla viene
    td.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- ?? tipo seg?n el cat?logo (RECARGA, DEBITO o RECHAZADO)
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
    



    -- Pasajero (v?a Monedero)
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
    'RECARGA' AS origenTabla,       -- ?? solo indica de qu? tabla proviene
    tr.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- ?? valor real del tipo
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

          // Query para total (sin paginaci?n)
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

  WHERE m.IdCliente = ?   -- ?? aqu? colocas el ID del cliente que quieres consultar

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

  WHERE m.IdCliente = ?   -- ?? aqu? colocas el ID del cliente que quieres consultar
)
ORDER BY FHRegistro DESC
LIMIT ? OFFSET ?;

        `,
            [cliente, cliente, limit, offset],
          );

          // Query para total (sin paginaci?n)
          totalResult = await this.transaccionesrecargaRepository.query(
            `
SELECT COUNT(*) AS total
FROM (
  SELECT td.Id
  FROM TransaccionesDebito td
  INNER JOIN Monederos m ON td.NumeroSerieMonedero = m.NumeroSerie
  WHERE m.IdCliente = ?   -- ?? aqu? colocas el ID del cliente que quieres consultar

  UNION ALL

  SELECT tr.Id
  FROM TransaccionesRecarga tr
  INNER JOIN Monederos m ON tr.NumeroSerieMonedero = m.NumeroSerie
  WHERE m.IdCliente = ?   -- ?? aqu? colocas el ID del cliente que quieres consultar
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

          // Query para total (sin paginaci?n)
          totalResult = await this.transaccionesrecargaRepository.query(
            `
SELECT COUNT(*) AS total
FROM (
    SELECT td.Id
    FROM TransaccionesDebito td
    INNER JOIN CatTiposTransacciones ctt ON td.IdTipoTransaccion = ctt.Id
    INNER JOIN Monederos m ON td.NumeroSerieMonedero = m.NumeroSerie
    INNER JOIN Pasajeros p ON m.IdPasajero = p.Id
    WHERE p.Id = ?  -- ?? pasajero espec?fico
      AND m.Estatus = 1

    UNION ALL

    SELECT tr.Id
    FROM TransaccionesRecarga tr
    INNER JOIN CatTiposTransacciones ctt ON tr.IdTipoTransaccion = ctt.Id
    INNER JOIN Monederos m ON tr.NumeroSerieMonedero = m.NumeroSerie
    INNER JOIN Pasajeros p ON m.IdPasajero = p.Id
    WHERE p.Id = ?  -- ?? mismo pasajero
      AND m.Estatus = 1
) AS transacciones_pasajero;

  `,
            [Number(pasajero.id), Number(pasajero.id)], // <-- Aqu? debe ir como segundo argumento de query()
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

  WHERE m.IdCliente IN (${placeholders})   -- ?? aqu? colocas el ID del cliente que quieres consultar

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

  WHERE m.IdCliente IN (${placeholders})   -- ?? aqu? colocas el ID del cliente que quieres consultar
)
ORDER BY FHRegistro DESC
LIMIT ? OFFSET ?;

        `,
            [...ids, ...ids, limit, offset],
          );

          // Query para total (sin paginaci?n)
          totalResult = await this.transaccionesrecargaRepository.query(
            `
SELECT COUNT(*) AS total
FROM (
  SELECT td.Id
  FROM TransaccionesDebito td
  INNER JOIN Monederos m ON td.NumeroSerieMonedero = m.NumeroSerie
  WHERE m.IdCliente IN (${placeholders})   -- ?? aqu? colocas el ID del cliente que quieres consultar

  UNION ALL

  SELECT tr.Id
  FROM TransaccionesRecarga tr
  INNER JOIN Monederos m ON tr.NumeroSerieMonedero = m.NumeroSerie
  WHERE m.IdCliente IN (${placeholders})   -- ?? aqu? colocas el ID del cliente que quieres consultar
) AS todas;

  `,
            [...ids, ...ids],
          );
          break;
      }

      const total = Number(totalResult[0]?.total || 0);

      // ?? Transformaci?n de datos (ids ? number, nombreCompleto)
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
    'DEBITO' AS origenTabla,        -- ?? de qu? tabla viene
    td.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- ?? tipo seg?n el cat?logo (RECARGA, DEBITO o RECHAZADO)
    td.Monto AS monto,
    td.LatitudFinal AS latitudFinal,
    td.LongitudFinal AS longitudFinal,
    td.FechaHoraFinal AS fechaHoraFinal,
    td.FHRegistro AS fhRegistro,
    td.NumeroSerieMonedero AS numeroSerieMonedero,
    td.NumeroSerieValidador AS numeroSerieValidador,
    td.ControlTransaccion AS controlTransaccion,

    -- Datos del cliente
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,
    

    -- Datos del validador
    d.Marca AS marcaValidador,
    d.Modelo AS modeloValidador,

    -- Pasajero (v?a Monedero)
    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero

FROM ${entidadDebito} td
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
    
-- condiciones
WHERE DATE(td.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'


UNION ALL

SELECT 
    'RECARGA' AS origenTabla,       -- ?? solo indica de qu? tabla proviene
    tr.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- ?? valor real del tipo
    tr.Monto AS monto,
    tr.LatitudFinal AS latitudFinal,
    tr.LongitudFinal AS longitudFinal,
    tr.FechaHoraFinal AS fechaHoraFinal,
    tr.FHRegistro AS fhRegistro,
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieValidador AS numeroSerieValidador,
    tr.ControlTransaccion AS controlTransaccion,


    -- Datos del cliente
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,
    

    d.Marca AS marcaValidador,
    d.Modelo AS modeloValidador,

    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero

FROM ${entidadRecarga} tr
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
    
-- condiciones
WHERE DATE(tr.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'

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

    -- Datos del dispositivo
    d.Marca AS marcaDispositivo,
    d.Modelo AS modeloDispositivo,

    -- Pasajero (v?a Monedero)
    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero

FROM ${entidadDebito} td
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
    
-- condiciones
WHERE DATE(td.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'
AND m.IdCliente IN (${placeholders})   -- ?? aqu? colocas el ID del cliente que quieres consultar


UNION ALL

SELECT 
    'RECARGA' AS origenTabla,       -- ?? solo indica de qu? tabla proviene
    tr.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- ?? valor real del tipo
    tr.Monto AS monto,
    NULL AS latitudInicial,
    NULL AS longitudInicial,
    tr.LatitudFinal AS latitudFinal,
    tr.LongitudFinal AS longitudFinal,
    NULL AS fechaHoraInicio,
    tr.FechaHoraFinal AS fechaHoraFinal,
    tr.FHRegistro AS fhRegistro,
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieValidador AS numeroSerieValidador,

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
LEFT JOIN Validadores d 
    ON tr.NumeroSerieValidador = d.NumeroSerie
INNER JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
INNER JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE DATE(tr.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'
AND m.IdCliente IN (${placeholders})   -- ?? aqu? colocas el ID del cliente que quieres consultar

ORDER BY FHRegistro DESC

        `,
            [...ids, ...ids],
          );
          break;

        case 3:
        default:
          transacciones = await this.transaccionesrecargaRepository.query(
            `
SELECT 
    'DEBITO' AS origenTabla,        -- ?? de qu? tabla viene
    td.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- ?? tipo seg?n el cat?logo (RECARGA, DEBITO o RECHAZADO)
    td.Monto AS monto,
    td.LatitudFinal AS latitudFinal,
    td.LongitudFinal AS longitudFinal,
    td.FechaHoraFinal AS fechaHoraFinal,
    td.FHRegistro AS fhRegistro,
    td.NumeroSerieMonedero AS numeroSerieMonedero,
    td.NumeroSerieValidador AS numeroSerieValidador,

    -- Datos del cliente
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,
    

    -- Datos del dispositivo
    d.Marca AS marcaDispositivo,
    d.Modelo AS modeloDispositivo,

    -- Pasajero (v?a Monedero)
    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero

 FROM ${entidadDebito} td
  INNER JOIN CatTiposTransacciones ctt 
      ON td.IdTipoTransaccion = ctt.Id
  LEFT JOIN Validadores d 
      ON td.NumeroSerieValidador = d.NumeroSerie
  INNER JOIN Monederos m 
      ON td.NumeroSerieMonedero = m.NumeroSerie
  LEFT JOIN Pasajeros p 
      ON m.IdPasajero = p.Id
    
-- condiciones
WHERE DATE(td.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'
AND m.IdCliente = ?


UNION ALL

SELECT 
    'RECARGA' AS origenTabla,       -- ?? solo indica de qu? tabla proviene
    tr.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- ?? valor real del tipo
    tr.Monto AS monto,
    tr.LatitudFinal AS latitudFinal,
    tr.LongitudFinal AS longitudFinal,
    tr.FechaHoraFinal AS fechaHoraFinal,
    tr.FHRegistro AS fhRegistro,
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieValidador AS numeroSerieValidador,

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
  LEFT JOIN Validadores d 
      ON tr.NumeroSerieValidador = d.NumeroSerie
  INNER JOIN Monederos m 
      ON tr.NumeroSerieMonedero = m.NumeroSerie
  LEFT JOIN Pasajeros p 
      ON m.IdPasajero = p.Id
INNER JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE DATE(tr.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'
AND m.IdCliente = ?

ORDER BY FHRegistro DESC
        `,
            [cliente, cliente],
          );
          break;
      }

      // ?? Transformaci?n de datos (ids ? number, nombreCompleto)
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
    'RECARGA' AS origenTabla,       -- ?? solo indica de qu? tabla proviene
    tr.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- ?? valor real del tipo
    tr.Monto AS monto,
    tr.LatitudFinal AS latitudFinal,
    tr.LongitudFinal AS longitudFinal,
    tr.FechaHoraFinal AS fechaHoraFinal,
    tr.FHRegistro AS fhRegistro,
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieValidador AS numeroSerieValidador,
    tr.ControlTransaccion AS controlTransaccion,


    -- Datos del cliente
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,

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
INNER JOIN Clientes c
	ON m.IdCliente = c.Id
    WHERE tr.Id = ?

        `,
        [id],
      );

      if (!transacciones)
        throw new NotFoundException('Transaccion no encontradas');

      // ?? Transformaci?n de datos (ids ? number, nombreCompleto)
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
    'DEBITO' AS origenTabla,        -- ?? de qu? tabla viene
    td.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- ?? tipo seg?n el cat?logo (RECARGA, DEBITO o RECHAZADO)
    td.Monto AS monto,
    td.LatitudFinal AS latitudFinal,
    td.LongitudFinal AS longitudFinal,
    td.FechaHoraFinal AS fechaHoraFinal,
    td.FHRegistro AS fhRegistro,
    td.NumeroSerieMonedero AS numeroSerieMonedero,
    td.NumeroSerieValidador AS numeroSerieValidador,
    td.ControlTransaccion AS controlTransaccion,


    -- Datos del cliente
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,

    -- Datos del validador
    d.Marca AS marcaValidador,
    d.Modelo AS modeloValidador,

    -- Pasajero (v?a Monedero)
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
    WHERE td.Id = ?

        `,
        [id],
      );

      if (!transacciones)
        throw new NotFoundException('Transaccion no encontradas');
      // ?? Transformaci?n de datos (ids ? number, nombreCompleto)
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
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({
        message: 'Error al obtener transacciones',
      });
    }
  }

  /**
   * Obtiene el histórico de recargas paginado con filtros según el rol del usuario
   * @param idUser ID del usuario
   * @param email Email del usuario
   * @param cliente ID del cliente
   * @param rol Rol del usuario (1=SA, 2=ADMIN, 3=Cajero, 9=Pasajero)
   * @param getHistoricoRecargasDto DTO con parámetros de paginación y fechas
   * @returns Histórico de recargas paginado
   */
  async getHistoricoRecargasPaginado(
    idUser: number,
    email: string,
    cliente: number,
    rol: number,
    getHistoricoRecargasDto: GetHistoricoRecargasDto,
  ): Promise<ApiResponseCommon> {
    try {
      const { page, limit, fechaInicio, fechaFin } = getHistoricoRecargasDto;
      const offset = (page - 1) * limit;

      // Construir condición de fechas (separadas para cada tabla)
      // Usar FHRegistro para el filtro de fechas
      let fechaCondition = ''; // Para casos 1, 2, 3 (solo HistoricoTransaccionesRecarga)
      let fechaConditionHistorico = ''; // Para caso 9 - tabla HistoricoTransaccionesRecarga
      let fechaConditionActivo = ''; // Para caso 9 - tabla TransaccionesRecarga
      const queryParams: any[] = [];

      if (fechaInicio && fechaFin) {
        fechaCondition = 'AND DATE(htr.FHRegistro) BETWEEN ? AND ?';
        fechaConditionHistorico = 'AND DATE(htr.FHRegistro) BETWEEN ? AND ?';
        fechaConditionActivo = 'AND DATE(tr.FHRegistro) BETWEEN ? AND ?';
        queryParams.push(fechaInicio, fechaFin);
      } else if (fechaInicio) {
        fechaCondition = 'AND DATE(htr.FHRegistro) >= ?';
        fechaConditionHistorico = 'AND DATE(htr.FHRegistro) >= ?';
        fechaConditionActivo = 'AND DATE(tr.FHRegistro) >= ?';
        queryParams.push(fechaInicio);
      } else if (fechaFin) {
        fechaCondition = 'AND DATE(htr.FHRegistro) <= ?';
        fechaConditionHistorico = 'AND DATE(htr.FHRegistro) <= ?';
        fechaConditionActivo = 'AND DATE(tr.FHRegistro) <= ?';
        queryParams.push(fechaFin);
      }

      let recargas: any[];
      let totalResult: any[];

      switch (rol) {
        case 1:
          // SA = Todas las recargas
          recargas = await this.historicoTransaccionesRecargaRepository.query(
            `
SELECT 
    htr.Id AS id,
    htr.IdTipoTransaccion AS idTipoTransaccion,
    ctt.Nombre AS tipoTransaccion,
    htr.ControlTransaccion AS controlTransaccion,
    htr.Monto AS monto,
    htr.LatitudFinal AS latitudFinal,
    htr.LongitudFinal AS longitudFinal,
    htr.FechaHoraFinal AS fechaHoraFinal,
    htr.FHRegistro AS fhRegistro,
    htr.NumeroSerieMonedero AS numeroSerieMonedero,
    htr.NumeroSerieValidador AS numeroSerieValidador,
    htr.IdUsuario AS idUsuario,
    
    -- Datos del cliente
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,
    
    -- Datos del monedero y pasajero
    m.Id AS idMonedero,
    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero,
    
    -- Datos del usuario que realizó la recarga
    u.Id AS idUsuarioRecarga,
    u.Nombre AS nombreUsuario,
    u.ApellidoPaterno AS apellidoPaternoUsuario,
    u.ApellidoMaterno AS apellidoMaternoUsuario

FROM HistoricoTransaccionesRecarga htr
INNER JOIN CatTiposTransacciones ctt ON htr.IdTipoTransaccion = ctt.Id
INNER JOIN Monederos m ON htr.NumeroSerieMonedero = m.NumeroSerie
INNER JOIN Clientes c ON m.IdCliente = c.Id
LEFT JOIN Pasajeros p ON m.IdPasajero = p.Id
LEFT JOIN Usuarios u ON htr.IdUsuario = u.Id
WHERE 1=1
${fechaCondition}
ORDER BY htr.FechaHoraFinal DESC
LIMIT ? OFFSET ?;
            `,
            [...queryParams, limit, offset],
          );

          totalResult = await this.historicoTransaccionesRecargaRepository.query(
            `
SELECT COUNT(*) AS total
FROM HistoricoTransaccionesRecarga htr
INNER JOIN Monederos m ON htr.NumeroSerieMonedero = m.NumeroSerie
INNER JOIN Clientes c ON m.IdCliente = c.Id
WHERE 1=1
${fechaCondition};
            `,
            queryParams,
          );
          break;

        case 2:
          // ADMIN = Sus recargas y las de clientes hijos
          const { ids, placeholders } = await this.clienteHijos(cliente);
          
          recargas = await this.historicoTransaccionesRecargaRepository.query(
            `
SELECT 
    htr.Id AS id,
    htr.IdTipoTransaccion AS idTipoTransaccion,
    ctt.Nombre AS tipoTransaccion,
    htr.ControlTransaccion AS controlTransaccion,
    htr.Monto AS monto,
    htr.LatitudFinal AS latitudFinal,
    htr.LongitudFinal AS longitudFinal,
    htr.FechaHoraFinal AS fechaHoraFinal,
    htr.FHRegistro AS fhRegistro,
    htr.NumeroSerieMonedero AS numeroSerieMonedero,
    htr.NumeroSerieValidador AS numeroSerieValidador,
    htr.IdUsuario AS idUsuario,
    
    -- Datos del cliente
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,
    
    -- Datos del monedero y pasajero
    m.Id AS idMonedero,
    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero,
    
    -- Datos del usuario que realizó la recarga
    u.Id AS idUsuarioRecarga,
    u.Nombre AS nombreUsuario,
    u.ApellidoPaterno AS apellidoPaternoUsuario,
    u.ApellidoMaterno AS apellidoMaternoUsuario

FROM HistoricoTransaccionesRecarga htr
INNER JOIN CatTiposTransacciones ctt ON htr.IdTipoTransaccion = ctt.Id
INNER JOIN Monederos m ON htr.NumeroSerieMonedero = m.NumeroSerie
INNER JOIN Clientes c ON m.IdCliente = c.Id
LEFT JOIN Pasajeros p ON m.IdPasajero = p.Id
LEFT JOIN Usuarios u ON htr.IdUsuario = u.Id
WHERE m.IdCliente IN (${placeholders})
${fechaCondition}
ORDER BY htr.FechaHoraFinal DESC
LIMIT ? OFFSET ?;
            `,
            [...ids, ...queryParams, limit, offset],
          );

          totalResult = await this.historicoTransaccionesRecargaRepository.query(
            `
SELECT COUNT(*) AS total
FROM HistoricoTransaccionesRecarga htr
INNER JOIN Monederos m ON htr.NumeroSerieMonedero = m.NumeroSerie
INNER JOIN Clientes c ON m.IdCliente = c.Id
WHERE m.IdCliente IN (${placeholders})
${fechaCondition};
            `,
            [...ids, ...queryParams],
          );
          break;

        case 3:
          // Cajero = Solo sus recargas (por IdUsuario)
          recargas = await this.historicoTransaccionesRecargaRepository.query(
            `
SELECT 
    htr.Id AS id,
    htr.IdTipoTransaccion AS idTipoTransaccion,
    ctt.Nombre AS tipoTransaccion,
    htr.ControlTransaccion AS controlTransaccion,
    htr.Monto AS monto,
    htr.LatitudFinal AS latitudFinal,
    htr.LongitudFinal AS longitudFinal,
    htr.FechaHoraFinal AS fechaHoraFinal,
    htr.FHRegistro AS fhRegistro,
    htr.NumeroSerieMonedero AS numeroSerieMonedero,
    htr.NumeroSerieValidador AS numeroSerieValidador,
    htr.IdUsuario AS idUsuario,
    
    -- Datos del cliente
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,
    
    -- Datos del monedero y pasajero
    m.Id AS idMonedero,
    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero,
    
    -- Datos del usuario que realizó la recarga
    u.Id AS idUsuarioRecarga,
    u.Nombre AS nombreUsuario,
    u.ApellidoPaterno AS apellidoPaternoUsuario,
    u.ApellidoMaterno AS apellidoMaternoUsuario

FROM HistoricoTransaccionesRecarga htr
INNER JOIN CatTiposTransacciones ctt ON htr.IdTipoTransaccion = ctt.Id
INNER JOIN Monederos m ON htr.NumeroSerieMonedero = m.NumeroSerie
INNER JOIN Clientes c ON m.IdCliente = c.Id
LEFT JOIN Pasajeros p ON m.IdPasajero = p.Id
LEFT JOIN Usuarios u ON htr.IdUsuario = u.Id
WHERE htr.IdUsuario = ?
${fechaCondition}
ORDER BY htr.FechaHoraFinal DESC
LIMIT ? OFFSET ?;
            `,
            [idUser, ...queryParams, limit, offset],
          );

          totalResult = await this.historicoTransaccionesRecargaRepository.query(
            `
SELECT COUNT(*) AS total
FROM HistoricoTransaccionesRecarga htr
WHERE htr.IdUsuario = ?
${fechaCondition};
            `,
            [idUser, ...queryParams],
          );
          break;

        case 9:
          // Pasajero = Solo las de él (filtrar por monederos del pasajero asociado al usuario)
          // Buscar pasajero por IdUsuario directamente o por correo como fallback
          let pasajeroId: number | null = null;
          
          try {
            // Intentar buscar pasajero por IdUsuario directamente
            const pasajeroPorUsuario = await this.pasajeroRepository.findOne({
              where: { idUsuario: idUser },
            });
            
            if (pasajeroPorUsuario) {
              pasajeroId = pasajeroPorUsuario.id;
            } else {
              // Fallback: buscar por correo
              const pasajeroPorCorreo = await this.pasajeroService.findOnePasajeroCorreo(email);
              if (pasajeroPorCorreo && pasajeroPorCorreo.id) {
                pasajeroId = pasajeroPorCorreo.id;
              }
            }
          } catch (error) {
            // Si falla, intentar por correo
            try {
              const pasajeroPorCorreo = await this.pasajeroService.findOnePasajeroCorreo(email);
              if (pasajeroPorCorreo && pasajeroPorCorreo.id) {
                pasajeroId = pasajeroPorCorreo.id;
              }
            } catch (e) {
              // Si no se encuentra, pasajeroId queda null
            }
          }
          
          // Buscar recargas solo en HistoricoTransaccionesRecarga
          // Filtrar por: IdUsuario del usuario Y idCliente del usuario (solo las recargas que él realizó en su cliente)
          // Para pasajero: solo mostrar las recargas donde IdUsuario = idUser AND m.IdCliente = cliente
          const condicionesWhereHistorico = `htr.IdUsuario = ? AND m.IdCliente = ?`;
          const paramsWhere = [idUser, cliente, ...queryParams];
          
          // Obtener recargas del histórico con paginación
          recargas = await this.historicoTransaccionesRecargaRepository.query(
            `
SELECT 
    htr.Id AS id,
    htr.IdTipoTransaccion AS idTipoTransaccion,
    ctt.Nombre AS tipoTransaccion,
    htr.ControlTransaccion AS controlTransaccion,
    htr.Monto AS monto,
    htr.LatitudFinal AS latitudFinal,
    htr.LongitudFinal AS longitudFinal,
    htr.FechaHoraFinal AS fechaHoraFinal,
    htr.FHRegistro AS fhRegistro,
    htr.NumeroSerieMonedero AS numeroSerieMonedero,
    htr.NumeroSerieValidador AS numeroSerieValidador,
    htr.IdUsuario AS idUsuario,
    
    -- Datos del cliente
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,
    
    -- Datos del monedero y pasajero
    m.Id AS idMonedero,
    p.Id AS idPasajero,
    p.Nombre AS nombrePasajero,
    p.ApellidoPaterno AS apellidoPaternoPasajero,
    p.ApellidoMaterno AS apellidoMaternoPasajero,
    
    -- Datos del usuario que realizó la recarga
    u.Id AS idUsuarioRecarga,
    u.Nombre AS nombreUsuario,
    u.ApellidoPaterno AS apellidoPaternoUsuario,
    u.ApellidoMaterno AS apellidoMaternoUsuario

FROM HistoricoTransaccionesRecarga htr
INNER JOIN CatTiposTransacciones ctt ON htr.IdTipoTransaccion = ctt.Id
INNER JOIN Monederos m ON htr.NumeroSerieMonedero = m.NumeroSerie
INNER JOIN Clientes c ON m.IdCliente = c.Id
LEFT JOIN Pasajeros p ON m.IdPasajero = p.Id
LEFT JOIN Usuarios u ON htr.IdUsuario = u.Id
WHERE ${condicionesWhereHistorico}
${fechaConditionHistorico}
ORDER BY htr.FechaHoraFinal DESC
LIMIT ? OFFSET ?;
            `,
            [...paramsWhere, limit, offset],
          );

          // Query para total
          totalResult = await this.historicoTransaccionesRecargaRepository.query(
            `
SELECT COUNT(*) AS total
FROM HistoricoTransaccionesRecarga htr
INNER JOIN Monederos m ON htr.NumeroSerieMonedero = m.NumeroSerie
WHERE ${condicionesWhereHistorico}
${fechaConditionHistorico};
            `,
            paramsWhere,
          );
          break;

        default:
          throw new BadRequestException('Rol no válido para consultar histórico de recargas');
      }

      const total = Number(totalResult[0]?.total || 0);

      // Convertir BigInt a Number
      const data = recargas.map((item) => ({
        ...item,
        id: Number(item.id),
        idTipoTransaccion: Number(item.idTipoTransaccion),
        monto: Number(item.monto),
        idCliente: Number(item.idCliente),
        idMonedero: item.idMonedero ? Number(item.idMonedero) : null,
        idPasajero: item.idPasajero ? Number(item.idPasajero) : null,
        idUsuario: item.idUsuario ? Number(item.idUsuario) : null,
        idUsuarioRecarga: item.idUsuarioRecarga ? Number(item.idUsuarioRecarga) : null,
      }));

      const result: ApiResponseCommon = {
        data: data,
        paginated: {
          total: total,
          page: page,
          lastPage: Math.ceil(total / limit),
        },
      };

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({
        message: 'Error al obtener histórico de recargas',
      });
    }
  }
}
