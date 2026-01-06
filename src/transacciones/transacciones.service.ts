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
  EnumMetodoPago,
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
   * Transforma el valor de EsQR (0/1) a texto descriptivo
   * @param esQR Valor numérico (0 o 1) o null
   * @returns "Monedero Físico" si es 0, "Monedero QR" si es 1, null si es null
   */
  private transformarEsQR(esQR: number | null | undefined): string | null {
    if (esQR === null || esQR === undefined) {
      return null;
    }
    return esQR === 1 ? 'Monedero QR' : 'Monedero Físico';
  }

  /**
   * Calcula la distancia en kil?metros desde el punto inicial de la variante hasta el último punto de la variante,
   * sumando punto a punto a lo largo del recorridoDetallado
   * @param variante Variante con recorridoDetallado y puntoInicio
   * @param latitud Latitud del punto de la transacci?n
   * @param longitud Longitud del punto de la transacci?n
   * @param tarifaInfo Información de la tarifa (opcional) para calcular el extra potencial
   * @returns Distancia en kil?metros desde el punto inicial hasta el último punto de la variante, o 0 si no se puede calcular
   */
  private calcularDistanciaInicialKm(
    variante: Variantes | null,
    latitud: number,
    longitud: number,
    tarifaInfo?: { tarifaBase?: number; costoAdicional?: number; distanciaBaseKm?: number; incrementoCadaMetros?: number; tipoTarifa?: number } | null,
  ): number {
    if (!variante?.recorridoDetallado) {
      console.log('[TRANSACCIONES] No se puede calcular distancia: variante sin recorridoDetallado');
      return 0;
    }

    try {
      const recorrido = this.parsearRecorridoDetallado(variante.recorridoDetallado);
      if (!recorrido || recorrido.length === 0) {
        console.log('[TRANSACCIONES] No se puede calcular distancia: recorrido vacío o inválido');
        return 0;
      }

      // Encontrar el punto más cercano del recorrido al punto de transacción
      const puntoTransaccion = { lat: latitud, lng: longitud };
      const puntoMasCercanoIndex = this.encontrarPuntoMasCercano(recorrido, puntoTransaccion);
      
      let puntoMasCercano: { lat: number; lng: number } | null = null;
      let distanciaAlPuntoMasCercano = Infinity;
      
      if (puntoMasCercanoIndex !== -1 && puntoMasCercanoIndex < recorrido.length) {
        puntoMasCercano = recorrido[puntoMasCercanoIndex];
        if (puntoMasCercano) {
          distanciaAlPuntoMasCercano = haversine(puntoMasCercano, puntoTransaccion);
        }
      }

      // Calcular distancia desde puntoInicio hasta el primer punto del recorrido (si son diferentes)
      const distanciaDesdePuntoInicio = this.calcularDistanciaDesdePuntoInicio(
        variante,
        recorrido[0],
      );

      // Calcular el tamaño total del recorridoDetallado (sumando punto por punto desde el primero hasta el último)
      const tamañoTotalRecorrido = this.calcularDistanciaAcumuladaRecorrido(
        recorrido,
        recorrido.length - 1, // Hasta el último punto
      );
      const tamañoTotalRecorridoKm = parseFloat((tamañoTotalRecorrido / 1000).toFixed(2));

      // Calcular distancia desde el punto de transacción hasta el punto 1 del recorrido
      // Esto incluye: distancia al punto más cercano + distancia desde ese punto hasta el punto 1
      let distanciaDesdeTransaccionHastaPunto1 = 0;

      if (puntoMasCercanoIndex !== -1 && puntoMasCercano) {
        // Distancia desde punto de transacción al punto más cercano
        const distanciaAlPuntoMasCercano = haversine(puntoTransaccion, puntoMasCercano);
        
        // Si el punto más cercano es el punto 1, solo usamos la distancia directa
        if (puntoMasCercanoIndex === 0) {
          distanciaDesdeTransaccionHastaPunto1 = distanciaAlPuntoMasCercano;
        } else {
          // Calcular distancia desde el punto más cercano hasta el punto 1 (sumando punto por punto hacia atrás)
          const distanciaDesdePuntoMasCercanoHastaPunto1 = this.calcularDistanciaAcumuladaRecorrido(
            recorrido,
            puntoMasCercanoIndex,
          );
          
          // La distancia total es: distancia al punto más cercano + distancia desde ese punto hasta el punto 1
          distanciaDesdeTransaccionHastaPunto1 = distanciaAlPuntoMasCercano + distanciaDesdePuntoMasCercanoHastaPunto1;
        }
      } else {
        // Si no se encuentra punto cercano, calcular distancia directa al punto 1
        distanciaDesdeTransaccionHastaPunto1 = haversine(puntoTransaccion, recorrido[0]);
      }

      const distanciaEnKm = parseFloat((distanciaDesdeTransaccionHastaPunto1 / 1000).toFixed(2));
      
      // Imprimir en consola el cálculo detallado
      console.log('[TRANSACCIONES] ===== CÁLCULO DE DISTANCIA INICIAL KM =====');
      console.log(`[TRANSACCIONES] Variante ID: ${variante.id}`);
      console.log(`[TRANSACCIONES] Total de puntos en recorrido: ${recorrido.length}`);
      console.log(`[TRANSACCIONES] Tamaño total del recorridoDetallado: ${tamañoTotalRecorridoKm} km (${tamañoTotalRecorrido.toFixed(2)} metros)`);
      console.log(`[TRANSACCIONES] Punto de transacción: Lat ${latitud}, Lng ${longitud}`);
      console.log(`[TRANSACCIONES] Punto 1 del recorrido: Lat ${recorrido[0].lat}, Lng ${recorrido[0].lng}`);
      console.log(`[TRANSACCIONES] Último punto del recorrido: Lat ${recorrido[recorrido.length - 1].lat}, Lng ${recorrido[recorrido.length - 1].lng}`);
      
      if (puntoMasCercanoIndex !== -1 && puntoMasCercano) {
        console.log(`[TRANSACCIONES] --- PUNTO MÁS CERCANO DEL RECORRIDO ---`);
        console.log(`[TRANSACCIONES] Índice del punto más cercano: ${puntoMasCercanoIndex + 1} (de ${recorrido.length})`);
        console.log(`[TRANSACCIONES] Coordenadas del punto más cercano: Lat ${puntoMasCercano.lat}, Lng ${puntoMasCercano.lng}`);
        console.log(`[TRANSACCIONES] Distancia desde punto de transacción al punto más cercano: ${(distanciaAlPuntoMasCercano / 1000).toFixed(2)} km (${distanciaAlPuntoMasCercano.toFixed(2)} metros)`);
        
        if (puntoMasCercanoIndex === 0) {
          console.log(`[TRANSACCIONES] El punto más cercano ES el punto 1, usando distancia directa`);
        } else {
          // Calcular distancia desde el punto más cercano hasta el punto 1
          const distanciaDesdePuntoMasCercanoHastaPunto1 = this.calcularDistanciaAcumuladaRecorrido(
            recorrido,
            puntoMasCercanoIndex,
          );
          console.log(`[TRANSACCIONES] Distancia desde punto más cercano hasta punto 1 (sumando punto por punto): ${(distanciaDesdePuntoMasCercanoHastaPunto1 / 1000).toFixed(2)} km`);
          
          // Imprimir detalle punto por punto desde punto más cercano hasta punto 1
          console.log('[TRANSACCIONES] --- Detalle punto por punto (desde punto más cercano hasta punto 1) ---');
          let distanciaAcumuladaHaciaPunto1 = 0;
          for (let i = puntoMasCercanoIndex; i > 0; i--) {
            const puntoActual = recorrido[i];
            const puntoAnterior = recorrido[i - 1];
            
            if (
              typeof puntoActual.lat === 'number' &&
              typeof puntoActual.lng === 'number' &&
              typeof puntoAnterior.lat === 'number' &&
              typeof puntoAnterior.lng === 'number'
            ) {
              const distanciaSegmento = haversine(puntoActual, puntoAnterior);
              distanciaAcumuladaHaciaPunto1 += distanciaSegmento;
              console.log(`[TRANSACCIONES] Punto ${i + 1} -> Punto ${i}: ${(distanciaSegmento / 1000).toFixed(2)} km | Acumulado hacia punto 1: ${(distanciaAcumuladaHaciaPunto1 / 1000).toFixed(2)} km`);
            }
          }
        }
      } else {
        console.log(`[TRANSACCIONES] No se encontró un punto cercano válido, usando distancia directa al punto 1`);
      }
      
      console.log(`[TRANSACCIONES] --- RESULTADO FINAL ---`);
      console.log(`[TRANSACCIONES] Distancia desde punto de transacción hasta punto 1: ${distanciaEnKm} km`);
      
      // Imprimir detalle punto por punto del recorrido completo para mostrar el tamaño total
      console.log('[TRANSACCIONES] --- Detalle punto por punto del recorrido completo (tamaño total) ---');
      let distanciaAcumuladaRecorridoCompleto = 0;
      for (let i = 0; i < recorrido.length - 1; i++) {
        const puntoActual = recorrido[i];
        const puntoSiguiente = recorrido[i + 1];
        
        if (
          typeof puntoActual.lat === 'number' &&
          typeof puntoActual.lng === 'number' &&
          typeof puntoSiguiente.lat === 'number' &&
          typeof puntoSiguiente.lng === 'number'
        ) {
          const distanciaSegmento = haversine(puntoActual, puntoSiguiente);
          distanciaAcumuladaRecorridoCompleto += distanciaSegmento;
          console.log(`[TRANSACCIONES] Punto ${i + 1} -> Punto ${i + 2}: ${(distanciaSegmento / 1000).toFixed(2)} km | Acumulado total: ${(distanciaAcumuladaRecorridoCompleto / 1000).toFixed(2)} km`);
        }
      }
      console.log(`[TRANSACCIONES] Tamaño total del recorridoDetallado (verificado): ${(distanciaAcumuladaRecorridoCompleto / 1000).toFixed(2)} km`);
      
      // Calcular y mostrar información de tarifa y extra potencial
      if (tarifaInfo) {
        const tarifaBase = tarifaInfo.tarifaBase || 0;
        const costoAdicional = tarifaInfo.costoAdicional || 0;
        const distanciaBaseKm = tarifaInfo.distanciaBaseKm || 0;
        const incrementoCadaMetros = tarifaInfo.incrementoCadaMetros || 0;
        const tipoTarifa = tarifaInfo.tipoTarifa;
        
        console.log('[TRANSACCIONES] --- INFORMACIÓN DE TARIFA Y COSTO POTENCIAL ---');
        console.log(`[TRANSACCIONES] Tarifa base: $${tarifaBase.toFixed(2)}`);
        // INCREMENTAL = 2 según el usuario
        const esTarifaIncremental = tipoTarifa === 2; // Valor 2 corresponde a INCREMENTAL
        const nombreTipoTarifa = tipoTarifa === 1 ? 'FIJA' : tipoTarifa === 2 ? 'INCREMENTAL' : 'DESCONOCIDO';
        console.log(`[TRANSACCIONES] Tipo de tarifa: ${tipoTarifa} (${nombreTipoTarifa})`);
        console.log(`[TRANSACCIONES] Distancia base incluida: ${distanciaBaseKm} km`);
        
        // Solo calcular el extra potencial si la tarifa es INCREMENTAL (valor 2) y tiene configuración de costo adicional
        if (esTarifaIncremental && costoAdicional > 0 && incrementoCadaMetros > 0) {
          const distanciaTotalMetros = distanciaAcumuladaRecorridoCompleto;
          const distanciaBaseMetros = distanciaBaseKm * 1000;
          
          // Calcular cuántos incrementos se aplicarían si hace el recorrido completo
          let extraPotencial = 0;
          if (distanciaTotalMetros > distanciaBaseMetros) {
            const distanciaExcedente = distanciaTotalMetros - distanciaBaseMetros;
            const numeroIncrementos = Math.ceil(distanciaExcedente / incrementoCadaMetros);
            extraPotencial = numeroIncrementos * costoAdicional;
            
            console.log(`[TRANSACCIONES] Distancia total del recorrido: ${(distanciaTotalMetros / 1000).toFixed(2)} km (${distanciaTotalMetros.toFixed(2)} metros)`);
            console.log(`[TRANSACCIONES] Distancia excedente sobre la base: ${(distanciaExcedente / 1000).toFixed(2)} km (${distanciaExcedente.toFixed(2)} metros)`);
            console.log(`[TRANSACCIONES] Incremento cada: ${incrementoCadaMetros} metros`);
            console.log(`[TRANSACCIONES] Costo adicional por incremento: $${costoAdicional.toFixed(2)}`);
            console.log(`[TRANSACCIONES] Número de incrementos necesarios: ${numeroIncrementos}`);
            console.log(`[TRANSACCIONES] Extra potencial si hace el recorrido completo: $${extraPotencial.toFixed(2)}`);
            console.log(`[TRANSACCIONES] Costo total potencial (tarifa base + extra): $${(tarifaBase + extraPotencial).toFixed(2)}`);
          } else {
            console.log(`[TRANSACCIONES] La distancia del recorrido (${(distanciaTotalMetros / 1000).toFixed(2)} km) está dentro de la distancia base (${distanciaBaseKm} km)`);
            console.log(`[TRANSACCIONES] No se aplicaría costo adicional. Costo total: $${tarifaBase.toFixed(2)}`);
          }
        } else {
          if (!esTarifaIncremental) {
            console.log(`[TRANSACCIONES] Tipo de tarifa no es INCREMENTAL (tipo: ${tipoTarifa}), no se calcula extra por distancia`);
          } else {
            console.log(`[TRANSACCIONES] No hay configuración de costo adicional (costoAdicional: ${costoAdicional}, incrementoCadaMetros: ${incrementoCadaMetros})`);
          }
          console.log(`[TRANSACCIONES] Costo total: $${tarifaBase.toFixed(2)} (solo tarifa base)`);
        }
      } else {
        console.log('[TRANSACCIONES] No se proporcionó información de tarifa para calcular el extra potencial');
      }
      
      console.log('[TRANSACCIONES] ===========================================');
      
      return isNaN(distanciaEnKm) || distanciaEnKm < 0 ? 0 : distanciaEnKm;
    } catch (error) {
      console.error('[TRANSACCIONES] Error al calcular distancia inicial:', error);
      return 0;
    }
  }

  /**
   * Calcula el cobro máximo potencial basado en la tarifa y la distancia total del recorrido
   * Solo se calcula para tarifas INCREMENTAL (tipoTarifa === 2)
   * @param variante Variante con recorridoDetallado
   * @param tarifaInfo Información de la tarifa
   * @returns Cobro máximo potencial o null si no aplica
   */
  private calcularCobroMaximo(
    variante: Variantes | null,
    tarifaInfo?: { tarifaBase?: number; costoAdicional?: number; distanciaBaseKm?: number; incrementoCadaMetros?: number; tipoTarifa?: number } | null,
  ): number | null {
    if (!variante?.recorridoDetallado || !tarifaInfo) {
      return null;
    }

    const tipoTarifa = tarifaInfo.tipoTarifa;
    // Solo calcular para tarifas INCREMENTAL (tipoTarifa === 2)
    if (tipoTarifa !== 2) {
      return null;
    }

    const tarifaBase = tarifaInfo.tarifaBase || 0;
    const costoAdicional = tarifaInfo.costoAdicional || 0;
    const distanciaBaseKm = tarifaInfo.distanciaBaseKm || 0;
    const incrementoCadaMetros = tarifaInfo.incrementoCadaMetros || 0;

    // Si no hay configuración de costo adicional, el cobro máximo es solo la tarifa base
    if (costoAdicional <= 0 || incrementoCadaMetros <= 0) {
      return tarifaBase;
    }

    try {
      const recorrido = this.parsearRecorridoDetallado(variante.recorridoDetallado);
      if (!recorrido || recorrido.length === 0) {
        return tarifaBase;
      }

      // Calcular el tamaño total del recorridoDetallado
      const tamañoTotalRecorrido = this.calcularDistanciaAcumuladaRecorrido(
        recorrido,
        recorrido.length - 1,
      );

      const distanciaTotalMetros = tamañoTotalRecorrido;
      const distanciaBaseMetros = distanciaBaseKm * 1000;

      // Si la distancia total está dentro de la distancia base, el cobro máximo es solo la tarifa base
      if (distanciaTotalMetros <= distanciaBaseMetros) {
        return tarifaBase;
      }

      // Calcular cuántos incrementos se aplicarían si hace el recorrido completo
      const distanciaExcedente = distanciaTotalMetros - distanciaBaseMetros;
      const numeroIncrementos = Math.ceil(distanciaExcedente / incrementoCadaMetros);
      const extraMaximo = numeroIncrementos * costoAdicional;
      const cobroMaximo = tarifaBase + extraMaximo;

      console.log(`[TRANSACCIONES] Cobro máximo calculado: $${cobroMaximo.toFixed(2)} (tarifa base: $${tarifaBase.toFixed(2)} + extra: $${extraMaximo.toFixed(2)})`);

      return parseFloat(cobroMaximo.toFixed(2));
    } catch (error) {
      console.error('[TRANSACCIONES] Error al calcular cobro máximo:', error);
      return tarifaBase; // En caso de error, retornar al menos la tarifa base
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
      // Validar que idMetodoPago sea obligatorio
      if (!createTransaccioneRecargaDto.idMetodoPago) {
        throw new BadRequestException('El campo idMetodoPago es obligatorio para crear una recarga.');
      }

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
        idMetodoPago: createTransaccioneRecargaDto.idMetodoPago, // Guardar el método de pago
      });
      newTransaccion.idTipoTransaccion = EnumTipoTransaccion.RECARGA;
      newTransaccion.controlTransaccion = EnumControlTransacciones.PAGADO;

      // Si el método de pago es Tarjeta (3 o 4), guardar los datos de Netpay
      if (
        createTransaccioneRecargaDto.idMetodoPago === EnumMetodoPago.TARJETA_CREDITO ||
        createTransaccioneRecargaDto.idMetodoPago === EnumMetodoPago.TARJETA_DEBITO
      ) {
        newTransaccion.tokenCardNetPay = createTransaccioneRecargaDto.tokenCardNetPay || null;
        newTransaccion.transactionTokenIdNetPay = createTransaccioneRecargaDto.transactionTokenIdNetPay || null;
        newTransaccion.referenceIdNetPay = createTransaccioneRecargaDto.referenceIdNetPay || null;
      }
      

    
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
          DistanciaBaseKm: tarifa?.distanciaBaseKm || null,
          IncrementoCadaMetros: tarifa?.incrementoCadaMetros || null,
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
            ta.DistanciaBaseKm,
            ta.IncrementoCadaMetros,
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

      console.log('[TRANSACCIONES] ===== INFORMACIÓN DE TARIFA =====');
      console.log(`[TRANSACCIONES] Tipo de tarifa: ${tipoTarifa} (${tipoTarifa === 1 ? 'FIJA' : tipoTarifa === 2 ? 'INCREMENTAL' : 'OTRO'})`);
      console.log(`[TRANSACCIONES] Tarifa base: $${tarifaBase.toFixed(2)}`);
      console.log('[TRANSACCIONES] ==========================================');

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

      console.log('[TRANSACCIONES] ===== CONTROL DE TRANSACCIÓN =====');
      console.log(`[TRANSACCIONES] Control transacción: ${controlTransaccion === EnumControlTransacciones.PAGADO ? 'PAGADO (0)' : 'ABIERTA (1)'}`);
      console.log('[TRANSACCIONES] ========================================');

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
      
      // Buscar el transbordo que pertenezca al cliente y esté activo
      const transbordoPermitido = await this.transbordosPermitidosRepository.findOne({
        where: { 
          idCliente: Number(monedero.idCliente),
          estatus: 1,
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


        if (transaccionesEnRango.length === 0) {
          // Es la primera transacci?n en ese rango de tiempo (cobro inicial)
          numeroTransbordo = 0;
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
                } else {
                  numeroTransbordo = siguienteTransbordo;
                }
              } else {
                numeroTransbordo = 1;
              }
            }
          } else {
            // No hay cobro inicial (numeroTransbordo = 0) en el rango, empezamos en 0
            numeroTransbordo = 0;
          }
        }
        

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


            if (tipoDescuentoTransbordo === EnumTipoDescuentoTransbordo.MONETARIO) {
              // Si es monetario, descuento directo del costo del transbordo de la tarifa base
              montoCalculado = tarifaBase - costoTransbordo;
            } else if (tipoDescuentoTransbordo === EnumTipoDescuentoTransbordo.PORCENTAJE) {
              // Si es porcentaje, descuento porcentual calculado de la tarifa base
              // costoTransbordo contiene el porcentaje (ej: 10 = 10%)
              const descuentoPorcentual = (tarifaBase * costoTransbordo) / 100;
              montoCalculado = tarifaBase - descuentoPorcentual;
            } else {
            }
            
            // Asegurar que el monto no sea negativo
            if (montoCalculado < 0) {
              montoCalculado = 0;
            }
            
          } else {
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

      console.log('[TRANSACCIONES] ===== DESCUENTO DEL MONEDERO =====');
      console.log(`[TRANSACCIONES] Saldo ANTES del descuento: $${Number(monedero.saldo).toFixed(2)}`);
      console.log(`[TRANSACCIONES] Monto a descontar (con descuentos aplicados): $${montoConDescuento.toFixed(2)}`);
      console.log(`[TRANSACCIONES] Saldo DESPUÉS del descuento: $${montoFinal.toFixed(2)}`);
      console.log('[TRANSACCIONES] =============================================');

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
          {
            tarifaBase: tarifaInfo.TarifaBase ? Number(tarifaInfo.TarifaBase) : undefined,
            costoAdicional: tarifaInfo.CostoAdicional ? Number(tarifaInfo.CostoAdicional) : undefined,
            distanciaBaseKm: tarifaInfo.DistanciaBaseKm ? Number(tarifaInfo.DistanciaBaseKm) : undefined,
            incrementoCadaMetros: tarifaInfo.IncrementoCadaMetros ? Number(tarifaInfo.IncrementoCadaMetros) : undefined,
            tipoTarifa: tarifaInfo.TipoTarifa ? Number(tarifaInfo.TipoTarifa) : undefined,
          },
        );
        
        // Asegurar que el valor sea un n?mero v?lido
        const distanciaInicialKmFinal = (typeof distanciaInicialKm === 'number' && !isNaN(distanciaInicialKm)) 
          ? parseFloat(distanciaInicialKm.toFixed(2)) 
          : 0;
        
        // Calcular cobro máximo solo si es tarifa INCREMENTAL (tipoTarifa === 2)
        const cobroMaximoRechazo = this.calcularCobroMaximo(variante, {
          tarifaBase: tarifaInfo.TarifaBase ? Number(tarifaInfo.TarifaBase) : undefined,
          costoAdicional: tarifaInfo.CostoAdicional ? Number(tarifaInfo.CostoAdicional) : undefined,
          distanciaBaseKm: tarifaInfo.DistanciaBaseKm ? Number(tarifaInfo.DistanciaBaseKm) : undefined,
          incrementoCadaMetros: tarifaInfo.IncrementoCadaMetros ? Number(tarifaInfo.IncrementoCadaMetros) : undefined,
          tipoTarifa: tarifaInfo.TipoTarifa ? Number(tarifaInfo.TipoTarifa) : undefined,
        });

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
          esQR: createTransaccioneDebitoDto.esQR ? 1 : 0,
          cobroMaximo: cobroMaximoRechazo,
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
        console.log('[TRANSACCIONES] ===== ACTUALIZANDO SALDO DEL MONEDERO =====');
        console.log(`[TRANSACCIONES] Número de serie del monedero: ${createTransaccioneDebitoDto.numeroSerieMonedero}`);
        console.log(`[TRANSACCIONES] Saldo que se va a guardar en el monedero: $${montoFinal.toFixed(2)}`);
        console.log(`[TRANSACCIONES] Control transacción: PAGADO`);
        
        await this.monederosService.updateMonederoSaldo(
          createTransaccioneDebitoDto.numeroSerieMonedero,
          idUser,
          montoFinal,
        );
        
        console.log('[TRANSACCIONES] Saldo del monedero actualizado exitosamente');
        console.log('[TRANSACCIONES] =================================================');
        
        // Para tarifas INCREMENTAL (tipoTarifa === 2), guardar la tarifa base en el campo monto
        // Para otras tarifas, guardar el monto con descuento
        if (tipoTarifa === 2) {
          montoAGuardar = tarifaBase; // Guardar tarifa base para tarifas INCREMENTAL
        } else {
          montoAGuardar = montoConDescuento;
        }
      } else {
        console.log('[TRANSACCIONES] ===== TRANSACCIÓN ABIERTA - NO SE DESCUENTA SALDO =====');
        console.log(`[TRANSACCIONES] Control transacción: ABIERTA`);
        console.log(`[TRANSACCIONES] El saldo del monedero NO se descuenta todavía`);
        console.log('[TRANSACCIONES] =======================================================');
        
        // Para transacciones ABIERTAS, si es tarifa INCREMENTAL (tipoTarifa === 2), guardar la tarifa base
        // Si no es INCREMENTAL, el monto se guarda como 0
        if (tipoTarifa === 2) {
          montoAGuardar = tarifaBase; // Guardar tarifa base para tarifas INCREMENTAL
        } else {
          montoAGuardar = 0;
        }
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
        {
          tarifaBase: tarifaInfo.TarifaBase ? Number(tarifaInfo.TarifaBase) : undefined,
          costoAdicional: tarifaInfo.CostoAdicional ? Number(tarifaInfo.CostoAdicional) : undefined,
          distanciaBaseKm: tarifaInfo.DistanciaBaseKm ? Number(tarifaInfo.DistanciaBaseKm) : undefined,
          incrementoCadaMetros: tarifaInfo.IncrementoCadaMetros ? Number(tarifaInfo.IncrementoCadaMetros) : undefined,
        },
      );
      
      // Asegurar que el valor sea un n?mero v?lido
      const distanciaInicialKmFinal = (typeof distanciaInicialKm === 'number' && !isNaN(distanciaInicialKm)) 
        ? parseFloat(distanciaInicialKm.toFixed(2)) 
        : 0;
      
      // Calcular cobro máximo solo si es tarifa INCREMENTAL (tipoTarifa === 2)
      const cobroMaximo = this.calcularCobroMaximo(variante, {
        tarifaBase: tarifaInfo.TarifaBase ? Number(tarifaInfo.TarifaBase) : undefined,
        costoAdicional: tarifaInfo.CostoAdicional ? Number(tarifaInfo.CostoAdicional) : undefined,
        distanciaBaseKm: tarifaInfo.DistanciaBaseKm ? Number(tarifaInfo.DistanciaBaseKm) : undefined,
        incrementoCadaMetros: tarifaInfo.IncrementoCadaMetros ? Number(tarifaInfo.IncrementoCadaMetros) : undefined,
        tipoTarifa: tarifaInfo.TipoTarifa ? Number(tarifaInfo.TipoTarifa) : undefined,
      });
      
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
        esQR: createTransaccioneDebitoDto.esQR ? 1 : 0,
        cobroMaximo: cobroMaximo,
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
      console.log('[paginado] Inicio - Parámetros recibidos:', {
        idUser,
        email,
        cliente,
        rol,
        page,
        limit,
        fechaInicio,
        fechaFin,
      });

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

      console.log('[paginado] Fecha actual calculada:', fechaActual);

      //Si fechaInicio y fechaFin son null arroja las transacciones del dia de la tabla TransaccionesRecarga y TransaccionesDebito
      if (!fechaInicio && !fechaFin) {
        fechaInicio = fechaActual
        fechaFin = fechaActual
        entidadRecarga = 'TransaccionesRecarga';
        entidadDebito = 'TransaccionesDebito';
        console.log('[paginado] Sin fechas - usando tablas actuales:', { entidadRecarga, entidadDebito, fechaInicio, fechaFin });
        transacciones = await this.resolverPorRolDefault(fechaInicio, fechaFin, email, cliente, rol, page, limit, entidadDebito, entidadRecarga);
      } else {
        //Si fechaInicio y fechaFin no son null arroja las transacciones del dia de la tabla HistoricoTransaccionesRecarga y HistoricoTransaccionesDebito
        //asigna fechaActual solo si el valor de la izquierda es null o undefined
        fechaInicio = fechaInicio?.split("T")[0] ?? fechaActual;
        fechaFin = fechaFin?.split("T")[0] ?? fechaActual;
        entidadRecarga = 'HistoricoTransaccionesRecarga';
        entidadDebito = 'HistoricoTransaccionesDebito';
        console.log('[paginado] Con fechas - usando tablas históricas:', { entidadRecarga, entidadDebito, fechaInicio, fechaFin });
        transacciones = await this.resolverPorRolDefault(fechaInicio, fechaFin, email, cliente, rol, page, limit, entidadDebito, entidadRecarga);
      }

      console.log('[paginado] Resultado de resolverPorRolDefault:', {
        tieneData: !!transacciones?.data,
        cantidadData: Array.isArray(transacciones?.data) ? transacciones.data.length : 'no es array',
        total: transacciones?.total,
      });

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
      console.log('[paginado] Respuesta final preparada:', {
        cantidadData: Array.isArray(data) ? data.length : 'no es array',
        total,
        page,
        lastPage: Math.ceil(total / limit),
      });
      return result;
    } catch (error) {
      console.error('[paginado] ERROR:', {
        message: error.message,
        stack: error.stack,
        error: error,
      });
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({
        message: 'Error al obtener transacciones paginado.',
        error: error.message,
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
      console.log('[resolverPorRolDefault] Inicio - Parámetros:', {
        fechaInicio,
        fechaFin,
        email,
        cliente,
        rol,
        page,
        limit,
        entidadDebito,
        entidadRecarga,
      });

      let totalResult;
      let transacciones;
      const offset = (page - 1) * limit;
      console.log('[resolverPorRolDefault] Offset calculado:', offset);
      
      switch (rol) {
        case 1:
          console.log('[resolverPorRolDefault] Caso 1 (Super Admin) - Ejecutando query de transacciones');
          transacciones = await this.transaccionesrecargaRepository.query(
            `
SELECT * FROM (
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
    td.EsQR AS esQR,
    NULL AS nombreMetodoPago,

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
LEFT JOIN CatTiposTransacciones ctt 
    ON td.IdTipoTransaccion = ctt.Id
LEFT JOIN Validadores d 
    ON td.NumeroSerieValidador = d.NumeroSerie
LEFT JOIN Monederos m 
    ON td.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
LEFT JOIN Clientes c
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
    NULL AS esQR,
    NULL AS nombreMetodoPago,

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
LEFT JOIN CatTiposTransacciones ctt 
    ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN Validadores  d 
    ON tr.NumeroSerieValidador = d.NumeroSerie
LEFT JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
LEFT JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE DATE(tr.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'
) AS todas_transacciones
ORDER BY fhRegistro DESC
LIMIT ${limit} OFFSET ${offset};
        `,
          );
          console.log('[resolverPorRolDefault] Caso 1 - Query transacciones ejecutado:', {
            esArray: Array.isArray(transacciones),
            cantidad: Array.isArray(transacciones) ? transacciones.length : 'no es array',
          });

          // Query para total (sin paginaci?n)
          console.log('[resolverPorRolDefault] Caso 1 - Ejecutando query de total');
          totalResult = await this.transaccionesrecargaRepository.query(
            `
SELECT COUNT(*) AS total
FROM (
    SELECT td.Id
    FROM ${entidadDebito} td
LEFT JOIN CatTiposTransacciones ctt 
    ON td.IdTipoTransaccion = ctt.Id
LEFT JOIN Validadores d 
    ON td.NumeroSerieValidador = d.NumeroSerie
LEFT JOIN Monederos m 
    ON td.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
LEFT JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE DATE(td.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'

    UNION ALL

    SELECT tr.Id
    FROM ${entidadRecarga} tr
LEFT JOIN CatTiposTransacciones ctt 
    ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN Validadores d 
    ON tr.NumeroSerieValidador = d.NumeroSerie
LEFT JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
LEFT JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE DATE(tr.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'
) AS todas;
		
  `,
          );
          console.log('[resolverPorRolDefault] Caso 1 - Query total ejecutado:', {
            resultado: totalResult,
            total: totalResult?.[0]?.total,
          });
          break;

        case 3:
        default:
          //Usuarios Operador
          transacciones = await this.transaccionesrecargaRepository.query(
            `
SELECT * FROM (
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
    td.EsQR AS esQR,
    NULL AS nombreMetodoPago,

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
LEFT JOIN CatTiposTransacciones ctt 
    ON td.IdTipoTransaccion = ctt.Id
LEFT JOIN Validadores d 
    ON td.NumeroSerieValidador = d.NumeroSerie
LEFT JOIN Monederos m 
    ON td.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
LEFT JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE DATE(td.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'
AND (m.IdCliente = ${cliente} OR m.IdCliente IS NULL)


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
    NULL AS esQR,
    COALESCE(cmp.Nombre, 'Efectivo') AS nombreMetodoPago,

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
LEFT JOIN CatTiposTransacciones ctt 
    ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN CatMetodoPago cmp 
    ON tr.IdMetodoPago = cmp.Id
LEFT JOIN Validadores d 
    ON tr.NumeroSerieValidador = d.NumeroSerie
LEFT JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
LEFT JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE DATE(tr.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'
AND (m.IdCliente = ${cliente} OR m.IdCliente IS NULL)
) AS todas_transacciones
ORDER BY fhRegistro DESC
LIMIT ${limit} OFFSET ${offset};
        `,
          );
          console.log('[resolverPorRolDefault] Caso 3 - Query transacciones ejecutado:', {
            esArray: Array.isArray(transacciones),
            cantidad: Array.isArray(transacciones) ? transacciones.length : 'no es array',
            cliente,
          });

          // Query para total (sin paginaci?n)
          console.log('[resolverPorRolDefault] Caso 3 - Ejecutando query de total');
          totalResult = await this.transaccionesrecargaRepository.query(
            `
SELECT COUNT(*) AS total
FROM (
    SELECT td.Id
    FROM ${entidadDebito} td
LEFT JOIN CatTiposTransacciones ctt 
    ON td.IdTipoTransaccion = ctt.Id
LEFT JOIN Validadores d 
    ON td.NumeroSerieValidador = d.NumeroSerie
LEFT JOIN Monederos m 
    ON td.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
LEFT JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE DATE(td.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'
AND (m.IdCliente = ${cliente} OR m.IdCliente IS NULL)

    UNION ALL

    SELECT tr.Id
    FROM ${entidadRecarga} tr
LEFT JOIN CatTiposTransacciones ctt 
    ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN Validadores d 
    ON tr.NumeroSerieValidador = d.NumeroSerie
LEFT JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
LEFT JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE DATE(tr.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'
AND (m.IdCliente = ${cliente} OR m.IdCliente IS NULL)


) AS todas;

  `,
          );
          break;

        case 9:
          //Datos por usuario
          const pasajero =
            await this.pasajeroService.findOnePasajeroCorreo(email);
          
          if (!pasajero || !pasajero.id) {
            throw new NotFoundException('Pasajero no encontrado para el usuario');
          }
          
          transacciones = await this.transaccionesrecargaRepository.query(
            `
SELECT * FROM (
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
    td.EsQR AS esQR,
    NULL AS nombreMetodoPago,

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
LEFT JOIN CatTiposTransacciones ctt 
    ON td.IdTipoTransaccion = ctt.Id
LEFT JOIN Validadores d 
    ON td.NumeroSerieValidador = d.NumeroSerie
LEFT JOIN Monederos m 
    ON td.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
LEFT JOIN Clientes c
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
    NULL AS esQR,
    COALESCE(cmp.Nombre, 'Efectivo') AS nombreMetodoPago,

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
LEFT JOIN CatTiposTransacciones ctt 
    ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN CatMetodoPago cmp 
    ON tr.IdMetodoPago = cmp.Id
LEFT JOIN Validadores d 
    ON tr.NumeroSerieValidador = d.NumeroSerie
LEFT JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
LEFT JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE DATE(tr.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'
AND m.Estatus = 1
AND p.Id = ?
) AS todas_transacciones
ORDER BY fhRegistro DESC
LIMIT ${limit} OFFSET ${offset};
        `,
            [Number(pasajero.id), Number(pasajero.id)],
          );
          console.log('[resolverPorRolDefault] Caso 9 - Query transacciones ejecutado:', {
            esArray: Array.isArray(transacciones),
            cantidad: Array.isArray(transacciones) ? transacciones.length : 'no es array',
            pasajeroId: pasajero.id,
          });

          // Query para total (sin paginaci?n)
          console.log('[resolverPorRolDefault] Caso 9 - Ejecutando query de total');
          totalResult = await this.transaccionesrecargaRepository.query(
            `
SELECT COUNT(*) AS total
FROM (
    SELECT td.Id
    FROM ${entidadDebito} td
LEFT JOIN CatTiposTransacciones ctt 
    ON td.IdTipoTransaccion = ctt.Id
LEFT JOIN Validadores d 
    ON td.NumeroSerieValidador = d.NumeroSerie
LEFT JOIN Monederos m 
    ON td.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
LEFT JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE DATE(td.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'
AND m.Estatus = 1
AND p.Id = ?

    UNION ALL

    SELECT tr.Id
    FROM ${entidadRecarga} tr
LEFT JOIN CatTiposTransacciones ctt 
    ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN Validadores d 
    ON tr.NumeroSerieValidador = d.NumeroSerie
LEFT JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
LEFT JOIN Clientes c
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
    td.EsQR AS esQR,
    NULL AS nombreMetodoPago,

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
LEFT JOIN CatTiposTransacciones ctt 
    ON td.IdTipoTransaccion = ctt.Id
LEFT JOIN Validadores d 
    ON td.NumeroSerieValidador = d.NumeroSerie
LEFT JOIN Monederos m 
    ON td.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
LEFT JOIN Clientes c
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
    NULL AS esQR,
    COALESCE(cmp.Nombre, 'Efectivo') AS nombreMetodoPago,

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
LEFT JOIN CatTiposTransacciones ctt 
    ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN CatMetodoPago cmp 
    ON tr.IdMetodoPago = cmp.Id
LEFT JOIN Validadores d 
    ON tr.NumeroSerieValidador = d.NumeroSerie
LEFT JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
LEFT JOIN Clientes c
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
    FROM ${entidadDebito} td
LEFT JOIN CatTiposTransacciones ctt 
    ON td.IdTipoTransaccion = ctt.Id
LEFT JOIN Validadores d 
    ON td.NumeroSerieValidador = d.NumeroSerie
LEFT JOIN Monederos m 
    ON td.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
LEFT JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE DATE(td.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'
AND m.IdCliente IN (${placeholders})   -- ?? aqu? colocas el ID del cliente que quieres consultar

    UNION ALL

    SELECT tr.Id
    FROM ${entidadRecarga} tr
LEFT JOIN CatTiposTransacciones ctt 
    ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN Validadores d 
    ON tr.NumeroSerieValidador = d.NumeroSerie
LEFT JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
LEFT JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE DATE(tr.FHRegistro) BETWEEN '${fechaInicio}' AND '${fechaFin}'
AND m.IdCliente IN (${placeholders})   -- ?? aqu? colocas el ID del cliente que quieres consultar


) AS todas;

  `,
            [...ids, ...ids],
          );
          console.log('[resolverPorRolDefault] Caso 2/8/10 - Query total ejecutado:', {
            resultado: totalResult,
            total: totalResult?.[0]?.total,
          });
          break;
      }

      console.log('[resolverPorRolDefault] Procesando resultados:', {
        totalResult,
        totalResultLength: totalResult?.length,
        transaccionesEsArray: Array.isArray(transacciones),
        transaccionesLength: Array.isArray(transacciones) ? transacciones.length : 'no es array',
      });

      const total = Number(totalResult[0]?.total || 0);
      console.log('[resolverPorRolDefault] Total calculado:', total);

      // Validar que transacciones sea un array
      if (!Array.isArray(transacciones)) {
        console.error('[resolverPorRolDefault] ERROR: transacciones no es un array:', {
          tipo: typeof transacciones,
          valor: transacciones,
        });
        throw new BadRequestException({
          message: 'Error: las transacciones no se obtuvieron correctamente',
        });
      }

      console.log('[resolverPorRolDefault] Transformando datos - cantidad de transacciones:', transacciones.length);
      // ?? Transformaci?n de datos (ids ? number, nombreCompleto)
      const data = transacciones.map((item) => ({
        ...item,
        id: Number(item.id),
        monto: Number(item.monto),
        latitudInicial: item.latitudInicial ? Number(item.latitudInicial) : null,
        longitudInicial: item.longitudInicial ? Number(item.longitudInicial) : null,
        latitudFinal: item.latitudFinal ? Number(item.latitudFinal) : null,
        longitudFinal: item.longitudFinal ? Number(item.longitudFinal) : null,
        idCliente: item.idCliente ? Number(item.idCliente) : null,
        idPasajero: item.idPasajero ? Number(item.idPasajero) : null,
        tipoMonedero: item.origenTabla === 'DEBITO' && item.esQR !== undefined 
          ? this.transformarEsQR(Number(item.esQR)) 
          : null,
      }));

      console.log('[resolverPorRolDefault] Datos transformados - cantidad:', data.length);
      console.log('[resolverPorRolDefault] Retornando resultado:', {
        dataLength: data.length,
        total,
        page,
        lastPage: Math.ceil(total / limit),
      });

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
      console.error('[resolverPorRolDefault] ERROR:', {
        message: error.message,
        stack: error.stack,
        error: error,
        rol,
        cliente,
        email,
        fechaInicio,
        fechaFin,
        entidadDebito,
        entidadRecarga,
      });
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({
        message: 'Error al obtener transacciones paginadas por rol',
        error: error.message,
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
    td.EsQR AS esQR,

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
    NULL AS esQR,

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
      td.EsQR AS esQR,

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
      NULL AS esQR,

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
          
          if (!pasajero || !pasajero.id) {
            throw new NotFoundException('Pasajero no encontrado para el usuario');
          }
          
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
      td.EsQR AS esQR,

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
      NULL AS esQR,

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
      td.EsQR AS esQR,

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
      NULL AS esQR,

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
        tipoMonedero: item.origenTabla === 'DEBITO' && item.esQR !== undefined 
          ? this.transformarEsQR(Number(item.esQR)) 
          : null,
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
    td.EsQR AS esQR,
    NULL AS nombreMetodoPago,

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
LEFT JOIN CatTiposTransacciones ctt 
    ON td.IdTipoTransaccion = ctt.Id
LEFT JOIN Validadores d 
    ON td.NumeroSerieValidador = d.NumeroSerie
LEFT JOIN Monederos m 
    ON td.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
LEFT JOIN Clientes c
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
    NULL AS esQR,
    COALESCE(cmp.Nombre, 'Efectivo') AS nombreMetodoPago,

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
LEFT JOIN CatTiposTransacciones ctt 
    ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN CatMetodoPago cmp 
    ON tr.IdMetodoPago = cmp.Id
LEFT JOIN Validadores d 
    ON tr.NumeroSerieValidador = d.NumeroSerie
LEFT JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
LEFT JOIN Clientes c
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
      NULL AS latitudInicial,
      NULL AS longitudInicial,
      td.LatitudFinal AS latitudFinal,
      td.LongitudFinal AS longitudFinal,
      NULL AS fechaHoraInicio,
      td.FechaHoraFinal AS fechaHoraFinal,
      td.FHRegistro AS fhRegistro,
      td.NumeroSerieMonedero AS numeroSerieMonedero,
      td.NumeroSerieValidador AS numeroSerieValidador,
      td.EsQR AS esQR,
      NULL AS nombreMetodoPago,

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
LEFT JOIN CatTiposTransacciones ctt 
    ON td.IdTipoTransaccion = ctt.Id
LEFT JOIN Validadores d 
    ON td.NumeroSerieValidador = d.NumeroSerie
LEFT JOIN Monederos m 
    ON td.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
LEFT JOIN Clientes c
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
    NULL AS esQR,
    COALESCE(cmp.Nombre, 'Efectivo') AS nombreMetodoPago,

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
LEFT JOIN CatTiposTransacciones ctt 
    ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN CatMetodoPago cmp 
    ON tr.IdMetodoPago = cmp.Id
LEFT JOIN Validadores d 
    ON tr.NumeroSerieValidador = d.NumeroSerie
LEFT JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
LEFT JOIN Clientes c
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
    td.ControlTransaccion AS controlTransaccion,
    td.EsQR AS esQR,
    NULL AS nombreMetodoPago,

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
    tr.LatitudFinal AS latitudFinal,
    tr.LongitudFinal AS longitudFinal,
    tr.FechaHoraFinal AS fechaHoraFinal,
    tr.FHRegistro AS fhRegistro,
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieValidador AS numeroSerieValidador,
    tr.ControlTransaccion AS controlTransaccion,
    NULL AS esQR,
    COALESCE(cmp.Nombre, 'Efectivo') AS nombreMetodoPago,

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
  LEFT JOIN CatMetodoPago cmp 
      ON tr.IdMetodoPago = cmp.Id
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
        error: error?.message || 'Error desconocido',
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
    NULL AS esQR,


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
        tipoMonedero: item.origenTabla === 'DEBITO' && item.esQR !== undefined 
          ? this.transformarEsQR(Number(item.esQR)) 
          : null,
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
    td.EsQR AS esQR,


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
        tipoMonedero: item.origenTabla === 'DEBITO' && item.esQR !== undefined 
          ? this.transformarEsQR(Number(item.esQR)) 
          : null,
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
      console.log('[getHistoricoRecargasPaginado] Inicio - Parámetros:', {
        idUser,
        email,
        cliente,
        rol,
        dto: getHistoricoRecargasDto,
      });

      const { page, limit, fechaInicio, fechaFin } = getHistoricoRecargasDto;
      const offset = (page - 1) * limit;

      // Determinar qué tablas usar según las fechas
      // Si no hay fechas o las fechas incluyen hoy, usar ambas tablas (actual + histórico)
      // Si las fechas son solo pasadas, usar solo histórico
      function pad(n: number) {
        return n < 10 ? '0' + n : n;
      }
      const ahora = new Date();
      const desfaseMs = -6 * 60 * 60 * 1000; // -6 horas
      const fechaDesfasada = new Date(ahora.getTime() + desfaseMs);
      const fechaActual = `${fechaDesfasada.getFullYear()}-${pad(fechaDesfasada.getMonth() + 1)}-${pad(fechaDesfasada.getDate())}`;

      // Construir condición de fechas (separadas para cada tabla)
      // Usar FHRegistro para el filtro de fechas
      let fechaCondition = ''; // Para casos 1, 2, 3 (solo HistoricoTransaccionesRecarga)
      let fechaConditionHistorico = ''; // Para tabla HistoricoTransaccionesRecarga
      let fechaConditionActivo = ''; // Para tabla TransaccionesRecarga
      const queryParams: any[] = [];

      let usarTablaActual = false;
      let usarTablaHistorico = true;
      
      if (!fechaInicio && !fechaFin) {
        // Sin fechas = usar ambas tablas (actual + histórico del día de hoy)
        // Esto asegura que se muestren todas las recargas del día actual
        usarTablaActual = true;
        usarTablaHistorico = true;
        // Agregar condición para histórico: solo del día de hoy
        fechaConditionHistorico = `AND DATE(htr.FHRegistro) = '${fechaActual}'`;
        fechaConditionActivo = `AND DATE(tr.FHRegistro) = '${fechaActual}'`;
      } else {
        // Con fechas: si incluyen hoy, usar ambas tablas
        const fechaInicioComparar = fechaInicio?.split("T")[0] ?? fechaActual;
        const fechaFinComparar = fechaFin?.split("T")[0] ?? fechaActual;
        usarTablaActual = fechaFinComparar >= fechaActual || fechaInicioComparar <= fechaActual;
        usarTablaHistorico = true; // Siempre consultar histórico si hay fechas
        
        // Construir condiciones de fechas
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
      }

      console.log('[getHistoricoRecargasPaginado] Configuración de tablas:', {
        usarTablaActual,
        usarTablaHistorico,
        fechaActual,
        fechaInicio,
        fechaFin,
        fechaConditionHistorico,
        fechaConditionActivo,
      });

      let recargas: any[];
      let totalResult: any[];

      switch (rol) {
        case 1:
          // SA = Todas las recargas
          console.log('[getHistoricoRecargasPaginado] Caso 1 - Ejecutando query');
          if (usarTablaActual && usarTablaHistorico) {
            // Consultar ambas tablas con UNION ALL
            recargas = await this.historicoTransaccionesRecargaRepository.query(
              `
SELECT * FROM (
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
    u.ApellidoMaterno AS apellidoMaternoUsuario,
    COALESCE(cmp.Nombre, 'Efectivo') AS nombreMetodoPago

FROM HistoricoTransaccionesRecarga htr
LEFT JOIN CatTiposTransacciones ctt ON htr.IdTipoTransaccion = ctt.Id
LEFT JOIN CatMetodoPago cmp ON htr.IdMetodoPago = cmp.Id
LEFT JOIN Monederos m ON htr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Clientes c ON m.IdCliente = c.Id
LEFT JOIN Pasajeros p ON m.IdPasajero = p.Id
LEFT JOIN Usuarios u ON htr.IdUsuario = u.Id
WHERE 1=1
${fechaConditionHistorico}

UNION ALL

SELECT 
    tr.Id AS id,
    tr.IdTipoTransaccion AS idTipoTransaccion,
    ctt.Nombre AS tipoTransaccion,
    NULL AS controlTransaccion,
    tr.Monto AS monto,
    tr.LatitudFinal AS latitudFinal,
    tr.LongitudFinal AS longitudFinal,
    tr.FechaHoraFinal AS fechaHoraFinal,
    tr.FHRegistro AS fhRegistro,
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieValidador AS numeroSerieValidador,
    NULL AS idUsuario,
    
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
    NULL AS idUsuarioRecarga,
    NULL AS nombreUsuario,
    NULL AS apellidoPaternoUsuario,
    NULL AS apellidoMaternoUsuario,
    COALESCE(cmp.Nombre, 'Efectivo') AS nombreMetodoPago

FROM TransaccionesRecarga tr
LEFT JOIN CatTiposTransacciones ctt ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN CatMetodoPago cmp ON tr.IdMetodoPago = cmp.Id
LEFT JOIN Monederos m ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Clientes c ON m.IdCliente = c.Id
LEFT JOIN Pasajeros p ON m.IdPasajero = p.Id
WHERE 1=1
${fechaConditionActivo}
) AS todas_recargas
ORDER BY fhRegistro DESC
LIMIT ? OFFSET ?;
            `,
              [...queryParams, ...queryParams, limit, offset],
            );

            totalResult = await this.historicoTransaccionesRecargaRepository.query(
              `
SELECT COUNT(*) AS total
FROM (
SELECT htr.Id
FROM HistoricoTransaccionesRecarga htr
LEFT JOIN Monederos m ON htr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Clientes c ON m.IdCliente = c.Id
WHERE 1=1
${fechaConditionHistorico}

UNION ALL

SELECT tr.Id
FROM TransaccionesRecarga tr
LEFT JOIN Monederos m ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Clientes c ON m.IdCliente = c.Id
WHERE 1=1
${fechaConditionActivo}
) AS todas;
            `,
              [...queryParams, ...queryParams],
            );
          } else if (usarTablaActual) {
            // Solo tabla actual
            recargas = await this.historicoTransaccionesRecargaRepository.query(
              `
SELECT 
    tr.Id AS id,
    tr.IdTipoTransaccion AS idTipoTransaccion,
    ctt.Nombre AS tipoTransaccion,
    NULL AS controlTransaccion,
    tr.Monto AS monto,
    tr.LatitudFinal AS latitudFinal,
    tr.LongitudFinal AS longitudFinal,
    tr.FechaHoraFinal AS fechaHoraFinal,
    tr.FHRegistro AS fhRegistro,
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieValidador AS numeroSerieValidador,
    NULL AS idUsuario,
    
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
    NULL AS idUsuarioRecarga,
    NULL AS nombreUsuario,
    NULL AS apellidoPaternoUsuario,
    NULL AS apellidoMaternoUsuario,
    COALESCE(cmp.Nombre, 'Efectivo') AS nombreMetodoPago

FROM TransaccionesRecarga tr
LEFT JOIN CatTiposTransacciones ctt ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN CatMetodoPago cmp ON tr.IdMetodoPago = cmp.Id
LEFT JOIN Monederos m ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Clientes c ON m.IdCliente = c.Id
LEFT JOIN Pasajeros p ON m.IdPasajero = p.Id
WHERE 1=1
${fechaConditionActivo}
ORDER BY tr.FHRegistro DESC
LIMIT ? OFFSET ?;
            `,
              [...queryParams, limit, offset],
            );

            totalResult = await this.historicoTransaccionesRecargaRepository.query(
              `
SELECT COUNT(*) AS total
FROM TransaccionesRecarga tr
LEFT JOIN Monederos m ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Clientes c ON m.IdCliente = c.Id
WHERE 1=1
${fechaConditionActivo};
            `,
              queryParams,
            );
          } else {
            // Solo histórico
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
    u.ApellidoMaterno AS apellidoMaternoUsuario,
    COALESCE(cmp.Nombre, 'Efectivo') AS nombreMetodoPago

FROM HistoricoTransaccionesRecarga htr
LEFT JOIN CatTiposTransacciones ctt ON htr.IdTipoTransaccion = ctt.Id
LEFT JOIN CatMetodoPago cmp ON htr.IdMetodoPago = cmp.Id
LEFT JOIN Monederos m ON htr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Clientes c ON m.IdCliente = c.Id
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
LEFT JOIN Monederos m ON htr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Clientes c ON m.IdCliente = c.Id
WHERE 1=1
${fechaCondition};
            `,
              queryParams,
            );
          }
          console.log('[getHistoricoRecargasPaginado] Caso 1 - Resultado:', {
            cantidad: Array.isArray(recargas) ? recargas.length : 'no es array',
            total: totalResult?.[0]?.total,
          });
          break;

        case 2:
          // ADMIN = Sus recargas y las de clientes hijos
          console.log('[getHistoricoRecargasPaginado] Caso 2 - Ejecutando query');
          const { ids, placeholders } = await this.clienteHijos(cliente);
          
          if (usarTablaActual && usarTablaHistorico) {
            // Consultar ambas tablas con UNION ALL
            recargas = await this.historicoTransaccionesRecargaRepository.query(
              `
SELECT * FROM (
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
    u.ApellidoMaterno AS apellidoMaternoUsuario,
    COALESCE(cmp.Nombre, 'Efectivo') AS nombreMetodoPago

FROM HistoricoTransaccionesRecarga htr
LEFT JOIN CatTiposTransacciones ctt ON htr.IdTipoTransaccion = ctt.Id
LEFT JOIN CatMetodoPago cmp ON htr.IdMetodoPago = cmp.Id
LEFT JOIN Monederos m ON htr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Clientes c ON m.IdCliente = c.Id
LEFT JOIN Pasajeros p ON m.IdPasajero = p.Id
LEFT JOIN Usuarios u ON htr.IdUsuario = u.Id
WHERE (m.IdCliente IN (${placeholders}) OR m.IdCliente IS NULL)
${fechaConditionHistorico}

UNION ALL

SELECT 
    tr.Id AS id,
    tr.IdTipoTransaccion AS idTipoTransaccion,
    ctt.Nombre AS tipoTransaccion,
    NULL AS controlTransaccion,
    tr.Monto AS monto,
    tr.LatitudFinal AS latitudFinal,
    tr.LongitudFinal AS longitudFinal,
    tr.FechaHoraFinal AS fechaHoraFinal,
    tr.FHRegistro AS fhRegistro,
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieValidador AS numeroSerieValidador,
    NULL AS idUsuario,
    
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
    NULL AS idUsuarioRecarga,
    NULL AS nombreUsuario,
    NULL AS apellidoPaternoUsuario,
    NULL AS apellidoMaternoUsuario,
    COALESCE(cmp.Nombre, 'Efectivo') AS nombreMetodoPago

FROM TransaccionesRecarga tr
LEFT JOIN CatTiposTransacciones ctt ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN CatMetodoPago cmp ON tr.IdMetodoPago = cmp.Id
LEFT JOIN Monederos m ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Clientes c ON m.IdCliente = c.Id
LEFT JOIN Pasajeros p ON m.IdPasajero = p.Id
WHERE m.IdCliente IN (${placeholders})
${fechaConditionActivo}
) AS todas_recargas
ORDER BY fhRegistro DESC
LIMIT ? OFFSET ?;
            `,
              [...ids, ...ids, ...queryParams, ...queryParams, limit, offset],
            );

            totalResult = await this.historicoTransaccionesRecargaRepository.query(
              `
SELECT COUNT(*) AS total
FROM (
SELECT htr.Id
FROM HistoricoTransaccionesRecarga htr
LEFT JOIN Monederos m ON htr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Clientes c ON m.IdCliente = c.Id
WHERE (m.IdCliente IN (${placeholders}) OR m.IdCliente IS NULL)
${fechaConditionHistorico}

UNION ALL

SELECT tr.Id
FROM TransaccionesRecarga tr
LEFT JOIN Monederos m ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Clientes c ON m.IdCliente = c.Id
WHERE m.IdCliente IN (${placeholders})
${fechaConditionActivo}
) AS todas;
            `,
              [...ids, ...ids, ...queryParams, ...queryParams],
            );
          } else if (usarTablaActual) {
            // Solo tabla actual
            recargas = await this.historicoTransaccionesRecargaRepository.query(
              `
SELECT 
    tr.Id AS id,
    tr.IdTipoTransaccion AS idTipoTransaccion,
    ctt.Nombre AS tipoTransaccion,
    NULL AS controlTransaccion,
    tr.Monto AS monto,
    tr.LatitudFinal AS latitudFinal,
    tr.LongitudFinal AS longitudFinal,
    tr.FechaHoraFinal AS fechaHoraFinal,
    tr.FHRegistro AS fhRegistro,
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieValidador AS numeroSerieValidador,
    NULL AS idUsuario,
    
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
    NULL AS idUsuarioRecarga,
    NULL AS nombreUsuario,
    NULL AS apellidoPaternoUsuario,
    NULL AS apellidoMaternoUsuario,
    COALESCE(cmp.Nombre, 'Efectivo') AS nombreMetodoPago

FROM TransaccionesRecarga tr
LEFT JOIN CatTiposTransacciones ctt ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN CatMetodoPago cmp ON tr.IdMetodoPago = cmp.Id
LEFT JOIN Monederos m ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Clientes c ON m.IdCliente = c.Id
LEFT JOIN Pasajeros p ON m.IdPasajero = p.Id
WHERE m.IdCliente IN (${placeholders})
${fechaConditionActivo}
ORDER BY tr.FHRegistro DESC
LIMIT ? OFFSET ?;
            `,
              [...ids, ...queryParams, limit, offset],
            );

            totalResult = await this.historicoTransaccionesRecargaRepository.query(
              `
SELECT COUNT(*) AS total
FROM TransaccionesRecarga tr
LEFT JOIN Monederos m ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Clientes c ON m.IdCliente = c.Id
WHERE m.IdCliente IN (${placeholders})
${fechaConditionActivo};
            `,
              [...ids, ...queryParams],
            );
          } else {
            // Solo histórico
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
    u.ApellidoMaterno AS apellidoMaternoUsuario,
    COALESCE(cmp.Nombre, 'Efectivo') AS nombreMetodoPago

FROM HistoricoTransaccionesRecarga htr
LEFT JOIN CatTiposTransacciones ctt ON htr.IdTipoTransaccion = ctt.Id
LEFT JOIN CatMetodoPago cmp ON htr.IdMetodoPago = cmp.Id
LEFT JOIN Monederos m ON htr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Clientes c ON m.IdCliente = c.Id
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
LEFT JOIN Monederos m ON htr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Clientes c ON m.IdCliente = c.Id
WHERE m.IdCliente IN (${placeholders})
${fechaCondition};
            `,
              [...ids, ...queryParams],
            );
          }
          console.log('[getHistoricoRecargasPaginado] Caso 2 - Resultado:', {
            cantidad: Array.isArray(recargas) ? recargas.length : 'no es array',
            total: totalResult?.[0]?.total,
          });
          break;

        case 3:
          // Cajero = Solo sus recargas (por IdUsuario) Y filtrar por clientes hijos
          console.log('[getHistoricoRecargasPaginado] Caso 3 - Ejecutando query, idUser:', idUser, 'cliente:', cliente);
          const { ids: idsCajero, placeholders: placeholdersCajero } = await this.clienteHijos(cliente);
          console.log('[getHistoricoRecargasPaginado] Caso 3 - Clientes hijos obtenidos:', {
            ids: idsCajero,
            placeholders: placeholdersCajero,
            cantidad: idsCajero?.length,
          });
          
          if (usarTablaActual && usarTablaHistorico) {
            // Consultar ambas tablas con UNION ALL
            // Nota: TransaccionesRecarga no tiene IdUsuario, así que solo consultamos histórico cuando hay IdUsuario
            recargas = await this.historicoTransaccionesRecargaRepository.query(
              `
SELECT * FROM (
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
    u.ApellidoMaterno AS apellidoMaternoUsuario,
    COALESCE(cmp.Nombre, 'Efectivo') AS nombreMetodoPago

FROM HistoricoTransaccionesRecarga htr
LEFT JOIN CatTiposTransacciones ctt ON htr.IdTipoTransaccion = ctt.Id
LEFT JOIN CatMetodoPago cmp ON htr.IdMetodoPago = cmp.Id
LEFT JOIN Monederos m ON htr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Clientes c ON m.IdCliente = c.Id
LEFT JOIN Pasajeros p ON m.IdPasajero = p.Id
LEFT JOIN Usuarios u ON htr.IdUsuario = u.Id
WHERE htr.IdUsuario = ? AND (m.IdCliente IN (${placeholdersCajero}) OR m.IdCliente IS NULL)
${fechaConditionHistorico}
) AS todas_recargas
ORDER BY fhRegistro DESC
LIMIT ? OFFSET ?;
            `,
              [idUser, ...idsCajero, ...queryParams, limit, offset],
            );

            totalResult = await this.historicoTransaccionesRecargaRepository.query(
              `
SELECT COUNT(*) AS total
FROM HistoricoTransaccionesRecarga htr
LEFT JOIN Monederos m ON htr.NumeroSerieMonedero = m.NumeroSerie
WHERE htr.IdUsuario = ? AND (m.IdCliente IN (${placeholdersCajero}) OR m.IdCliente IS NULL)
${fechaConditionHistorico};
            `,
              [idUser, ...idsCajero, ...queryParams],
            );
          } else if (usarTablaActual) {
            // Solo tabla actual - pero TransaccionesRecarga no tiene IdUsuario, así que no hay recargas del cajero en tabla actual
            recargas = [];
            totalResult = [{ total: 0 }];
          } else {
            // Solo histórico
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
    u.ApellidoMaterno AS apellidoMaternoUsuario,
    COALESCE(cmp.Nombre, 'Efectivo') AS nombreMetodoPago

FROM HistoricoTransaccionesRecarga htr
LEFT JOIN CatTiposTransacciones ctt ON htr.IdTipoTransaccion = ctt.Id
LEFT JOIN CatMetodoPago cmp ON htr.IdMetodoPago = cmp.Id
LEFT JOIN Monederos m ON htr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Clientes c ON m.IdCliente = c.Id
LEFT JOIN Pasajeros p ON m.IdPasajero = p.Id
LEFT JOIN Usuarios u ON htr.IdUsuario = u.Id
WHERE htr.IdUsuario = ? AND (m.IdCliente IN (${placeholdersCajero}) OR m.IdCliente IS NULL)
${fechaCondition}
ORDER BY htr.FechaHoraFinal DESC
LIMIT ? OFFSET ?;
            `,
              [idUser, ...idsCajero, ...queryParams, limit, offset],
            );

            totalResult = await this.historicoTransaccionesRecargaRepository.query(
              `
SELECT COUNT(*) AS total
FROM HistoricoTransaccionesRecarga htr
LEFT JOIN Monederos m ON htr.NumeroSerieMonedero = m.NumeroSerie
WHERE htr.IdUsuario = ? AND (m.IdCliente IN (${placeholdersCajero}) OR m.IdCliente IS NULL)
${fechaCondition};
            `,
              [idUser, ...idsCajero, ...queryParams],
            );
          }
          console.log('[getHistoricoRecargasPaginado] Caso 3 - Resultado:', {
            cantidad: Array.isArray(recargas) ? recargas.length : 'no es array',
            total: totalResult?.[0]?.total,
          });
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
          // Filtrar por: IdUsuario del usuario Y clientes hijos (solo las recargas que él realizó en su cliente y clientes hijos)
          // Para pasajero: solo mostrar las recargas donde IdUsuario = idUser AND m.IdCliente IN (clientes hijos)
          console.log('[getHistoricoRecargasPaginado] Caso 9 - Obteniendo clientes hijos para cliente:', cliente);
          const { ids: idsPasajero, placeholders: placeholdersPasajero } = await this.clienteHijos(cliente);
          console.log('[getHistoricoRecargasPaginado] Caso 9 - Clientes hijos obtenidos:', {
            ids: idsPasajero,
            placeholders: placeholdersPasajero,
            cantidad: idsPasajero?.length,
          });
          
          const condicionesWhereHistorico = `htr.IdUsuario = ? AND (m.IdCliente IN (${placeholdersPasajero}) OR m.IdCliente IS NULL)`;
          const paramsWhere = [idUser, ...idsPasajero, ...queryParams];
          
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
    u.ApellidoMaterno AS apellidoMaternoUsuario,
    COALESCE(cmp.Nombre, 'Efectivo') AS nombreMetodoPago

FROM HistoricoTransaccionesRecarga htr
LEFT JOIN CatTiposTransacciones ctt ON htr.IdTipoTransaccion = ctt.Id
LEFT JOIN CatMetodoPago cmp ON htr.IdMetodoPago = cmp.Id
LEFT JOIN Monederos m ON htr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Clientes c ON m.IdCliente = c.Id
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
          console.log('[getHistoricoRecargasPaginado] Caso 9 - Ejecutando query de total');
          totalResult = await this.historicoTransaccionesRecargaRepository.query(
            `
SELECT COUNT(*) AS total
FROM HistoricoTransaccionesRecarga htr
LEFT JOIN Monederos m ON htr.NumeroSerieMonedero = m.NumeroSerie
WHERE htr.IdUsuario = ? AND (m.IdCliente IN (${placeholdersPasajero}) OR m.IdCliente IS NULL)
${fechaConditionHistorico};
            `,
            paramsWhere,
          );
          console.log('[getHistoricoRecargasPaginado] Caso 9 - Resultado:', {
            cantidad: Array.isArray(recargas) ? recargas.length : 'no es array',
            total: totalResult?.[0]?.total,
          });
          break;

        default:
          throw new BadRequestException('Rol no válido para consultar histórico de recargas');
      }

      console.log('[getHistoricoRecargasPaginado] Procesando resultados:', {
        recargasEsArray: Array.isArray(recargas),
        recargasLength: Array.isArray(recargas) ? recargas.length : 'no es array',
        totalResult,
        total: totalResult?.[0]?.total,
      });

      const total = Number(totalResult[0]?.total || 0);
      console.log('[getHistoricoRecargasPaginado] Total calculado:', total);

      // Validar que recargas sea un array
      if (!Array.isArray(recargas)) {
        console.error('[getHistoricoRecargasPaginado] ERROR: recargas no es un array:', {
          tipo: typeof recargas,
          valor: recargas,
        });
        throw new BadRequestException({
          message: 'Error: las recargas no se obtuvieron correctamente',
        });
      }

      // Convertir BigInt a Number
      const data = recargas.map((item) => ({
        ...item,
        id: Number(item.id),
        idTipoTransaccion: item.idTipoTransaccion ? Number(item.idTipoTransaccion) : null,
        monto: Number(item.monto),
        idCliente: item.idCliente ? Number(item.idCliente) : null,
        idMonedero: item.idMonedero ? Number(item.idMonedero) : null,
        idPasajero: item.idPasajero ? Number(item.idPasajero) : null,
        idUsuario: item.idUsuario ? Number(item.idUsuario) : null,
        idUsuarioRecarga: item.idUsuarioRecarga ? Number(item.idUsuarioRecarga) : null,
      }));

      console.log('[getHistoricoRecargasPaginado] Datos transformados - cantidad:', data.length);

      const result: ApiResponseCommon = {
        data: data,
        paginated: {
          total: total,
          page: page,
          lastPage: Math.ceil(total / limit),
        },
      };

      console.log('[getHistoricoRecargasPaginado] Respuesta final:', {
        cantidadData: data.length,
        total,
        page,
        lastPage: Math.ceil(total / limit),
      });

      return result;
    } catch (error) {
      console.error('[getHistoricoRecargasPaginado] ERROR:', {
        message: error.message,
        stack: error.stack,
        error: error,
        rol,
        cliente,
        email,
        dto: getHistoricoRecargasDto,
      });
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({
        message: 'Error al obtener histórico de recargas',
        error: error.message,
      });
    }
  }
}
