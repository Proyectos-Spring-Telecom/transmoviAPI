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
  EnumControlTarifaIncremental,
  EnumControlTransacciones,
  EnumModulos,
  EnumTipoDescuento,
  EnumTipoTarifa,
  EnumTipoTransaccion,
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
import { UpdateTransaccioneDebitoDto } from './dto/update-transaccione-debito.dto';
import { GetTransaccioneDto } from './dto/get-transacciones.dto';
import { Viajes } from 'src/entities/Viajes';
import { calcularDistanciaHastaIndex, calcularDistanciaReal, snapToRoute } from 'src/utils/recorrido.utils';

@Injectable()
export class TransaccionesService {
  constructor(
    @InjectRepository(TransaccionesRecarga)
    private readonly transaccionesrecargaRepository: Repository<TransaccionesRecarga>,
    @InjectRepository(TransaccionesDebito)
    private readonly transaccionesdebitoRepository: Repository<TransaccionesDebito>,
    @InjectRepository(HistoricoTransaccionesDebito)
    private readonly historicoTransaccionesDebitoRepository: Repository<HistoricoTransaccionesDebito>,
    @InjectRepository(Dispositivos)
    private readonly dispositivoRepository: Repository<Dispositivos>,
    @InjectRepository(Clientes)
    private readonly clienteRepository: Repository<Clientes>,
    @InjectRepository(CatTiposPasajeros)
    private readonly CatTiposPasajerosRepository: Repository<CatTiposPasajeros>,
    @InjectRepository(Monederos)
    private readonly monederoRepository: Repository<Monederos>,
    @InjectRepository(Viajes)
    private readonly viajesRepository: Repository<Viajes>,
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
      newTransaccion.idTipoTransaccion = EnumTipoTransaccion.RECARGA
      newTransaccion.idUsuario = idUser
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
      console.log({ 'TransaccionesRecarga': error })
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
    let idUsuario;

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

      //controlTransaccion

      if (!monedero) {
        estado = EstadoTransaccion.ERROR;
        throw new BadRequestException('Monedero no encontrado');
      }

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
    m.NumeroSerie = '${createTransaccioneDebitoDto.numeroSerieMonedero}'
    `
      const pasajero = await this.viajesRepository.query(query);

      if (pasajero.length != 0) {
        const { idUsuarioPasajero } = pasajero[0];
        idUsuario = idUsuarioPasajero
      } else {
        idUsuario = null
      }


      // 3️⃣ Calculamos monto final (aquí se pueden aplicar descuentos si existen)

      //Obtenemos los datos del viajes, obtenemos el derrotero, tarifa
      const viajeData = await this.findTarifa(createTransaccioneDebitoDto.idViaje)
      const {
        estatusTurno,
        estatusViaje,
        recorridoInterpolar,
        distanciaKm,
        tarifaBase,
        DistanciaBaseKm,
        incrementoCadaMetros,
        costoAdicional,
        tipoTarifa
      } = viajeData[0]
      //console.log(...viajeData)
      if (!estatusTurno || !estatusViaje) {
        throw new BadRequestException(`Transacción realizada fuera del viaje o del turno.`)
      }

      //Creamos las variables para nuesto flujo de montoTarifa
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

      console.log('Monto Final: ', montoFinal, 'Monedero Saldo: ', monedero.saldo, 'Monto Con Descuento: ', montoConDescuento)

      // 4️⃣ Validación de saldo
      if (montoFinal < 0) {
        estado = transicionarEstado(
          estado,
          EventoTransaccion.SALDO_INSUFICIENTE,
        );
        //Obtenemos la fecha con desfase de 6 horas
        const { fechaDesfasada } = await horaDesfasada();

        // Guardar transacción rechazada
        const newTransaccion = this.transaccionesdebitoRepository.create(
          {
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
            idUsuario: idUsuario
          }
        );
        await this.transaccionesdebitoRepository.save(newTransaccion);
        //se guarda en el historico
        await this.historicoTransaccionesDebitoRepository.save(newTransaccion);

        // Registrar en bitácora
        await this.bitacoraLogger.logToBitacora(
          'Transacciones',
          `Transacción de débito RECHAZADA por saldo insuficiente`,
          'CREATE',
          { newTransaccion },
          idUser,
          EnumModulos.TRANSACCIONES,
          EstatusEnumBitcora.ERROR,
          'Saldo insuficiente',
        );

        throw new BadRequestException('Saldo insuficiente');
      }

      // 5️⃣ Si saldo OK, actualizamos el monedero y estado

      //Obtenemos la fecha con desfase de 6 horas
      const { fechaDesfasada } = await horaDesfasada();
      //Creamos el body para crear una transaccion
      const bodyTransaccionDebito = {
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
        idUsuario: idUsuario
      }

      switch (controlTransaccion) {
        case EnumControlTransacciones.ABIERTA:
          estado = transicionarEstado(estado, EventoTransaccion.SALDO_OK);
          bodyTransaccionDebito.monto = 0
          bodyTransaccionDebito.idControlTransaccion = EnumControlTransacciones.ABIERTA
          break;

        default:
          estado = transicionarEstado(estado, EventoTransaccion.SALDO_OK);
          await this.monederosService.updateMonederoSaldo(
            createTransaccioneDebitoDto.numeroSerieMonedero,
            idUser,
            montoFinal,
          );
          bodyTransaccionDebito.monto = montoConDescuento
          bodyTransaccionDebito.idControlTransaccion = EnumControlTransacciones.PAGADO
          break;
      }

      // 6️⃣ Guardamos transacción aprobada
      const newTransaccion = this.transaccionesdebitoRepository.create(
        bodyTransaccionDebito,
      );
      newTransaccion.idTipoTransaccion = EnumTipoTransaccion.DEBITO
      const transaccionSave =
        await this.transaccionesdebitoRepository.save(newTransaccion);
      let transaccionSaveHis;

      //Se guardara la transaccion en el historico de transacciones solamente cuando controltransaccion sea pagado
      if (controlTransaccion === EnumControlTransacciones.PAGADO) {
        transaccionSaveHis =
          await this.historicoTransaccionesDebitoRepository.save(newTransaccion);
        // 7️⃣ Bitácora de éxito //controltransaccion pagado----
        await this.bitacoraLogger.logToBitacora(
          'Transacciones',
          `Transacción de débito APROBADA`,
          'CREATE',
          { bodyTransaccionDebito },
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
      console.log({ 'TransaccionesDebito': error })
      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException(
        `Error al generar la transacción de débito`,
      );
    }
  }

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

WHERE v.Id = ${idViaje}
    `
    return await this.viajesRepository.query(query);
  }

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
          montoCalculado = tarifaBase
          controlTransaccion = EnumControlTransacciones.PAGADO
          console.log('Entro a tarifa estacionaria con tarifa base:', tarifaBase)
          break;

        case EnumTipoTarifa.INCREMENTAL:
          if (controlTarifaIncremental === EnumControlTarifaIncremental.FINAL) {
            //Cuando se cierre la tarifa
            //Creamos el arreglo de la posicion enviada por el dispositivo
            const posicionActual = { lat: latitud, lng: longitud };

            //Buscamos el punto mas que se encuentre nuestro recorrido con snapToRoute
            const { index, distanciaMetros } = await snapToRoute(
              posicionActual,
              recorridoInterpolar
            );

            //Calculamos la distancia en metros
            //tomamos el penultimo punto mas cercano a la posicion actual
            const indexSeguro = Math.max(index - 1, 0);

            //Tomamos del inicio de la ruta hasta el penultimo punto mas cercano
            const metrosRecorridos = await calcularDistanciaHastaIndex(
              recorridoInterpolar,
              indexSeguro
            );

            //Creamos el arreglo del penultimo punto a la posicion actual
            const punto = [indexSeguro === 0 ? recorridoInterpolar[index] : recorridoInterpolar[index - 1], posicionActual];
            //Calculamos la distancia del penultimo punto a la posicion actual con la funcion calcularDistanciaReal
            let ultimoIndex = await calcularDistanciaReal(punto);
            //Si la distancia pasa mas de 150 metros solo se queda en 150 metros sino toma la calculada en calcularDistanciaReal
            ultimoIndex = ultimoIndex > 150 ? 150 : ultimoIndex
            //Sumamos para obtener el total de distancia desde el inicio de la ruta hasta la posicion actual
            //Para esos sumamos las distacias del unicio de la ruta al penultimo punto + la distancia del penultimo punto a la posicion actual
            //Redondeamos el valor a enteros
            distanciaInicial = Math.round(metrosRecorridos + ultimoIndex)
            //Obtenemos la distacia restante para verificar el monto que se le hara al monedero
            //Para restamos la distancia obtenida en distanciaInicial y le restamos DistanciaInicialKm que es la distancia que se realizo la primer transaccion
            if (!DistanciaInicialKm) {
              DistanciaInicialKm = 0
            }
            distancia = Math.round(distanciaInicial - DistanciaInicialKm)
            //Convertimos la distanciaBaseKm a metros
            metrosBase = (distanciaBaseKm * 1000)
            //generamos la logica para calcular el monto
            //Si la distancia (que es la distancia restante) es menor a la distanciaBaseKm el monto es la tarifa base
            //Si la distancia (que es la distancia restante) es mayor a la distanciaBaseKm el monto es la distancia (que es la distancia restante) - distanciaBaseKm / incrementoCadaMetros * costoAdicional + tarifaBase
            montoCalculado = distancia <= metrosBase ? tarifaBase : (tarifaBase + (Math.trunc((distancia - metrosBase) / (incrementoCadaMetros))) * costoAdicional);
            controlTransaccion = EnumControlTransacciones.PAGADO
            console.log(`Penultimo punto: ${indexSeguro}, Cordenadas del Penultimo punto: ${recorridoInterpolar[indexSeguro]},
              Punto Mas cercano a la posicion recibida: ${index}, Distancia del punto mas cercano a la posicion recibida: ${distanciaMetros},
              Distacia en metros del inicio de la ruta al penultimo punto: ${metrosRecorridos},
              La distancia en metros del penultimo punto al posicion actual: ${ultimoIndex},
              Distancia desde el inicio de la ruta a la posicion actual: ${distanciaInicial},
              Distancia total de la ruta en metros: ${(distanciaKm * 1000)},
              Distancia de la posicion inicial a la posicion actual: ${distancia},
              Distancia base en km: ${distanciaBaseKm},
              Distancia base en metros: ${metrosBase},
              Distancia en metros para el incremento: ${incrementoCadaMetros},
              Costo adicional por cada incremente: ${costoAdicional},
              Monto con el calculo: ${montoCalculado}
              `);
          } else {
            //Cuando se abre la tarifa

            //Creamos el arreglo de la posicion enviada por el dispositivo
            const posicionActual = { lat: latitud, lng: longitud };

            //Buscamos el punto mas que se encuentre nuestro recorrido con snapToRoute
            const { index, distanciaMetros } = await snapToRoute(
              posicionActual,
              recorridoInterpolar
            );

            //Calculamos la distancia en metros
            //tomamos el penultimo punto mas cercano a la posicion actual
            const indexSeguro = Math.max(index - 1, 0);
            //Tomamos del inicio de la ruta hasta el penultimo punto mas cercano
            const metrosRecorridos = await calcularDistanciaHastaIndex(
              recorridoInterpolar,
              indexSeguro
            );

            //Creamos el arreglo del penultimo punto a la posicion actual
            const punto = [indexSeguro === 0 ? recorridoInterpolar[index] : recorridoInterpolar[index - 1], posicionActual];
            //Calculamos la distancia del penultimo punto a la posicion actual con la funcion calcularDistanciaReal
            let ultimoIndex = await calcularDistanciaReal(punto);
            //Si la distancia pasa mas de 150 metros solo se queda en 150 metros sino toma la calculada en calcularDistanciaReal
            ultimoIndex = ultimoIndex > 150 ? 150 : ultimoIndex
            //Sumamos para obtener el total de distancia desde el inicio de la ruta hasta la posicion actual
            //Para esos sumamos las distacias del unicio de la ruta al penultimo punto + la distancia del penultimo punto a la posicion actual
            //Redondeamos el valor a enteros
            distanciaInicial = Math.round(metrosRecorridos + ultimoIndex)
            //Obtenemos la distacia restante para verificar el monto que maximo que debe tener el monedero
            //Para eso distanciaKm lo convertimos en metros que el total de recorrido que tiene nuestra ruta
            //y le restamos la distanciaInicial anteriormente calculada
            distancia = Math.round((distanciaKm * 1000) - distanciaInicial);
            //Convertimos la distanciaBaseKm a metros
            metrosBase = (distanciaBaseKm * 1000);
            //generamos la logica para calcular el monto
            //Si la distancia (que es la distancia restante) es menor a la distanciaBaseKm el monto es la tarifa base
            //Si la distancia (que es la distancia restante) es mayor a la distanciaBaseKm el monto es la distancia (que es la distancia restante) - distanciaBaseKm / incrementoCadaMetros * costoAdicional + tarifaBase
            montoCalculado = distancia <= metrosBase ? tarifaBase : (tarifaBase + (Math.trunc((distancia - metrosBase) / (incrementoCadaMetros))) * costoAdicional);
            //montoCalculado = tarifaBase;
            controlTransaccion = EnumControlTransacciones.ABIERTA;
            console.log(`Penultimo punto: ${indexSeguro}, Cordenadas del Penultimo punto: ${recorridoInterpolar[indexSeguro]},
              Punto Mas cercano a la posicion recibida: ${index}, Distancia del punto mas cercano a la posicion recibida: ${distanciaMetros},
              Distacia en metros del inicio de la ruta al penultimo punto: ${metrosRecorridos},
              La distancia en metros del penultimo punto al posicion actual: ${ultimoIndex},
              Distancia desde el inicio de la ruta a la posicion actual: ${distanciaInicial},
              Distancia total de la ruta en metros: ${(distanciaKm * 1000)},
              Distancia de la posicion inicial a la posicion actual: ${distancia},
              Distancia base en km: ${distanciaBaseKm},
              Distancia base en metros: ${metrosBase},
              Distancia en metros para el incremento: ${incrementoCadaMetros},
              Costo adicional por cada incremente: ${costoAdicional},
              Monto con el calculo: ${montoCalculado}
              `);
          }
          break;
      }
      return { montoCalculado, controlTransaccion, distanciaInicial, }
    } catch (error) {
      console.log({ 'TransaccionesDebito': error })
      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException(
        `Error al obtener el monto de la tarifa para transacciones debito.`,
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
      console.log('Entro a update transaccion')
      let idUsuario;
      const monedero = await this.monederoRepository.findOne({
        where: {
          numeroSerie: updateTransaccioneDebitoDto.numeroSerieMonedero,
          estatus: 1,
        },
      });
      if (!monedero) {
        throw new BadRequestException('Monedero no encontrado');
      }

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
    m.NumeroSerie = '${updateTransaccioneDebitoDto.numeroSerieMonedero}'
    `
      const pasajero = await this.viajesRepository.query(query);

      console.log('Buscamos si el monedero esta relacionado a un usuario', pasajero[0]);

      if (pasajero.length != 0) {
        const { idUsuarioPasajero } = pasajero[0];
        idUsuario = idUsuarioPasajero
      } else {
        idUsuario = null
      }

      // 3️⃣ Calculamos monto final (aquí se pueden aplicar descuentos si existen)
      //Obtenemos los datos del viajes, obtenemos el derrotero, tarifa
      const viajeData = await this.findTarifa(updateTransaccioneDebitoDto.idViaje)
      const {
        estatusTurno,
        estatusViaje,
        recorridoInterpolar,
        distanciaKm,
        tarifaBase,
        DistanciaBaseKm,
        incrementoCadaMetros,
        costoAdicional,
        tipoTarifa
      } = viajeData[0]
      //console.log(...viajeData)
      if (!estatusTurno || !estatusViaje) {
        throw new BadRequestException(`Transacción realizada fuera del viaje o del turno.`)
      }

      const transaccionFind =
        await this.transaccionesdebitoRepository.findOne({
          where: {
            id: updateTransaccioneDebitoDto.idTransaccionDebito
          }
        });

      if (!transaccionFind) {
        throw new NotFoundException('La transacción no existe');
      }
      console.log(transaccionFind);

      //Creamos las variables para nuesto flujo de montoTarifa
      const controlTarifaIncremental = EnumControlTarifaIncremental.FINAL;

      const { montoCalculado, controlTransaccion, distanciaInicial } = await this.montoTarifa(
        recorridoInterpolar,
        distanciaKm,
        tarifaBase,
        DistanciaBaseKm,
        incrementoCadaMetros,
        costoAdicional,
        tipoTarifa,
        Number(updateTransaccioneDebitoDto.latitud),
        Number(updateTransaccioneDebitoDto.longitud),
        controlTarifaIncremental,
        transaccionFind.distanciaInicialKm || 0,
      );

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

      // 4️⃣ Validación de saldo
      if (montoFinal < 0) {

        // Guardar transacción rechazada
        //Obtenemos la fecha con desfase de 6 horas
        const { fechaDesfasada } = await horaDesfasada();

        // Guardar transacción rechazada
        const updateTransaccion = this.transaccionesdebitoRepository.create(
          {
            idTipoTransaccion: EnumTipoTransaccion.RECHAZO,
            monto: montoConDescuento,
            idControlTransaccion: EnumControlTransacciones.PAGADO,
            latitudFinal: updateTransaccioneDebitoDto.latitud,
            longitudFinal: updateTransaccioneDebitoDto.longitud,
            fechaHoraFinal: fechaDesfasada,
            distanciaInicialKm: distanciaInicial,
            numeroSerieMonedero: updateTransaccioneDebitoDto.numeroSerieMonedero,
            numeroSerieDispositivo: updateTransaccioneDebitoDto.numeroSerieDispositivo,
            idViajes: updateTransaccioneDebitoDto.idViaje,
            idUsuario: idUsuario
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

      //Obtenemos la fecha con desfase de 6 horas
      const { fechaDesfasada } = await horaDesfasada();
      const updateTransaccion =
      {
        idTipoTransaccion: EnumTipoTransaccion.DEBITO,
        monto: montoConDescuento,
        idControlTransaccion: EnumControlTransacciones.PAGADO,
        latitudFinal: updateTransaccioneDebitoDto.latitud,
        longitudFinal: updateTransaccioneDebitoDto.longitud,
        fechaHoraFinal: fechaDesfasada,
        distanciaInicialKm: distanciaInicial,
        numeroSerieMonedero: updateTransaccioneDebitoDto.numeroSerieMonedero,
        numeroSerieDispositivo: updateTransaccioneDebitoDto.numeroSerieDispositivo,
        idViajes: updateTransaccioneDebitoDto.idViaje,
        idUsuario: idUsuario
      }
      await this.transaccionesdebitoRepository.update(
        updateTransaccioneDebitoDto.idTransaccionDebito,
        updateTransaccion
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
        `Se realizo una transaccion de tipo ${updateTransaccioneDebitoDto}`,
        'CREATE',
        querylogger,
        idUser,
        EnumModulos.TRANSACCIONES,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      console.log({ 'TransaccionesDebito': error })
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error generar la transaccion de tipo ${updateTransaccioneDebitoDto.idTransaccionDebito}`,
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
    'DEBITO' AS origenTabla,
    td.Id AS id,
    ctt.Nombre AS tipoTransaccion,
    td.Monto AS monto,
    td.LatitudFinal AS latitudFinal,
    td.LongitudFinal AS longitudFinal,
    td.FechaHoraFinal AS fechaHoraFinal,
    td.FHRegistro AS fhRegistro,
    td.NumeroSerieMonedero AS numeroSerieMonedero,
    td.NumeroSerieDispositivo AS numeroSerieDispositivo,

    -- Estatus de la transacción (solo aplica a débito)
    cte.Nombre AS estatusTransaccion,
    
    -- Método de pago (solo aplica a recarga)
    NULL AS metodoPago,

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
    p.ApellidoMaterno AS apellidoMaternoPasajero,

    -- Usuario que realizó la transacción
    u.Id AS idUsuario,
    u.Nombre AS nombreUsuario,

    -- Viaje asociado (solo aplica a débito)
    td.IdViajes AS idViaje

FROM ${entidadDebito} td
INNER JOIN CatTiposTransacciones ctt 
    ON td.IdTipoTransaccion = ctt.Id
LEFT JOIN CatTransaccionEstatus cte 
    ON td.IdControlTransaccion = cte.Id
LEFT JOIN Dispositivos d 
    ON td.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Monederos m 
    ON td.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
INNER JOIN Clientes c
    ON m.IdCliente = c.Id
LEFT JOIN Usuarios u
    ON td.IdUsuario = u.Id

WHERE td.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'


UNION ALL


SELECT 
    'RECARGA' AS origenTabla,
    tr.Id AS id,
    ctt.Nombre AS tipoTransaccion,
    tr.Monto AS monto,
    tr.LatitudFinal AS latitudFinal,
    tr.LongitudFinal AS longitudFinal,
    tr.FechaHoraFinal AS fechaHoraFinal,
    tr.FHRegistro AS fhRegistro,
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieDispositivo AS numeroSerieDispositivo,

    -- Estatus de la transacción (no aplica a recarga)
    NULL AS estatusTransaccion,
    
    -- Método de pago
    cmp.Nombre AS metodoPago,

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
    p.ApellidoMaterno AS apellidoMaternoPasajero,

    -- Usuario que realizó la transacción
    u.Id AS idUsuario,
    u.Nombre AS nombreUsuario,

    -- Viaje asociado (no aplica a recarga)
    NULL AS idViaje

FROM ${entidadRecarga} tr
INNER JOIN CatTiposTransacciones ctt 
    ON tr.IdTipoTransaccion = ctt.Id
LEFT JOIN CatMetodoPago cmp 
    ON tr.IdMetodoPago = cmp.Id
LEFT JOIN Dispositivos d 
    ON tr.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Monederos m 
    ON tr.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Pasajeros p 
    ON m.IdPasajero = p.Id
INNER JOIN Clientes c
    ON m.IdCliente = c.Id
LEFT JOIN Usuarios u
    ON tr.IdUsuario = u.Id

WHERE tr.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'

ORDER BY fechaHoraFinal DESC
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
INNER JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE td.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'

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
INNER JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE tr.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'
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
    'DEBITO' AS origenTabla,        -- 👈 de qué tabla viene
    td.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- 👈 tipo según el catálogo (RECARGA, DEBITO o RECHAZADO)
    td.Monto AS monto,
    td.LatitudFinal AS latitudFinal,
    td.LongitudFinal AS longitudFinal,
    td.FechaHoraFinal AS fechaHoraFinal,
    td.FHRegistro AS fhRegistro,
    td.NumeroSerieMonedero AS numeroSerieMonedero,
    td.NumeroSerieDispositivo AS numeroSerieDispositivo,

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
WHERE td.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'
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
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieDispositivo AS numeroSerieDispositivo,

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
WHERE tr.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'
AND m.IdCliente = ?

ORDER BY FechaHoraFinal DESC
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
WHERE td.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'
AND m.IdCliente = ?

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
INNER JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE tr.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'
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
    'DEBITO' AS origenTabla,        -- 👈 de qué tabla viene
    td.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- 👈 tipo según el catálogo (RECARGA, DEBITO o RECHAZADO)
    td.Monto AS monto,
    td.LatitudFinal AS latitudFinal,
    td.LongitudFinal AS longitudFinal,
    td.FechaHoraFinal AS fechaHoraFinal,
    td.FHRegistro AS fhRegistro,
    td.NumeroSerieMonedero AS numeroSerieMonedero,
    td.NumeroSerieDispositivo AS numeroSerieDispositivo,

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
WHERE td.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'
AND m.Estatus = 1
AND p.Id = ?


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
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieDispositivo AS numeroSerieDispositivo,

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
WHERE tr.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'
AND m.Estatus = 1
AND p.Id = ?

ORDER BY FechaHoraFinal DESC
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
WHERE td.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'
AND m.Estatus = 1
AND p.Id = ?

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
INNER JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE tr.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'
AND m.Estatus = 1
AND p.Id = ?

) AS todas;

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
SELECT 
    'DEBITO' AS origenTabla,        -- 👈 de qué tabla viene
    td.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- 👈 tipo según el catálogo (RECARGA, DEBITO o RECHAZADO)
    td.Monto AS monto,
    td.LatitudFinal AS latitudFinal,
    td.LongitudFinal AS longitudFinal,
    td.FechaHoraFinal AS fechaHoraFinal,
    td.FHRegistro AS fhRegistro,
    td.NumeroSerieMonedero AS numeroSerieMonedero,
    td.NumeroSerieDispositivo AS numeroSerieDispositivo,

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
WHERE td.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'
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
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieDispositivo AS numeroSerieDispositivo,

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
WHERE tr.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'
AND m.IdCliente IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar

ORDER BY FechaHoraFinal DESC
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
WHERE td.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'
AND m.IdCliente IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar

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
INNER JOIN Clientes c
	ON m.IdCliente = c.Id
    
-- condiciones
WHERE tr.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'
AND m.IdCliente IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar


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
    td.NumeroSerieMonedero AS numeroSerieMonedero,
    td.NumeroSerieDispositivo AS numeroSerieDispositivo,

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
WHERE td.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'


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
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieDispositivo AS numeroSerieDispositivo,

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
WHERE tr.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'

ORDER BY FechaHoraFinal DESC
        `,
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
    td.NumeroSerieMonedero AS numeroSerieMonedero,
    td.NumeroSerieDispositivo AS numeroSerieDispositivo,

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
WHERE td.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'
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
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieDispositivo AS numeroSerieDispositivo,

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
WHERE tr.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'
AND m.IdCliente IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar

ORDER BY FechaHoraFinal DESC

        `,
            [...ids, ...ids],
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
    td.NumeroSerieMonedero AS numeroSerieMonedero,
    td.NumeroSerieDispositivo AS numeroSerieDispositivo,

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
WHERE td.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'
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
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieDispositivo AS numeroSerieDispositivo,

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
WHERE tr.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'
AND m.IdCliente = ?

ORDER BY FechaHoraFinal DESC
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
    'RECARGA' AS origenTabla,       -- 👈 solo indica de qué tabla proviene
    tr.Id AS id,
    ctt.Nombre AS tipoTransaccion,  -- 👈 valor real del tipo
    tr.Monto AS monto,
    tr.LatitudFinal AS latitudFinal,
    tr.LongitudFinal AS longitudFinal,
    tr.FechaHoraFinal AS fechaHoraFinal,
    tr.FHRegistro AS fhRegistro,
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieDispositivo AS numeroSerieDispositivo,

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
    td.NumeroSerieMonedero AS numeroSerieMonedero,
    td.NumeroSerieDispositivo AS numeroSerieDispositivo,

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
        fechaInicio = fechaActual
        fechaFin = fechaActual
        entidadRecarga = 'TransaccionesRecarga';
        console.log(fechaInicio, fechaFin, fechaActual, entidadRecarga, rol);
        transacciones = await this.resolverPorRolRecargas(fechaInicio, fechaFin, idUser, email, cliente, rol, page, limit, entidadRecarga);
      } else {
        //Si fechaInicio y fechaFin no son null arroja las transacciones del dia de la tabla HistoricoTransaccionesRecarga y HistoricoTransaccionesDebito
        //asigna fechaActual solo si el valor de la izquierda es null o undefined
        fechaInicio = fechaInicio?.split("T")[0] ?? fechaActual;
        fechaFin = fechaFin?.split("T")[0] ?? fechaActual;
        entidadRecarga = 'HistoricoTransaccionesRecarga';
        console.log(fechaInicio, fechaFin, fechaActual, entidadRecarga, rol);
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
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieDispositivo AS numeroSerieDispositivo,

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


  AND tr.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z'
                          AND '${fechaFin}T23:59:59Z'

ORDER BY tr.FechaHoraFinal DESC
  LIMIT ? OFFSET ?;
        `,
            [limit, offset],
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


  AND tr.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z'
                          AND '${fechaFin}T23:59:59Z'
  `,
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
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieDispositivo AS numeroSerieDispositivo,

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
  AND tr.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z'
                          AND '${fechaFin}T23:59:59Z'

ORDER BY tr.FechaHoraFinal DESC
LIMIT ? OFFSET ?;

        `,
            [cliente, limit, offset],
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
  AND tr.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z'
                          AND '${fechaFin}T23:59:59Z'
  `, [cliente]
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
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieDispositivo AS numeroSerieDispositivo,

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
WHERE tr.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'
AND m.Estatus = 1
AND p.Id = ?

ORDER BY FechaHoraFinal DESC
LIMIT ? OFFSET ?;

        `,
            [Number(pasajero.id), limit, offset],
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
WHERE tr.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'
AND m.Estatus = 1
AND p.Id = ?

  `,
            [Number(pasajero.id), Number(pasajero.id)], // <-- Aquí debe ir como segundo argumento de query()
          );
          break;

        case 11:
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
    tr.NumeroSerieMonedero AS numeroSerieMonedero,
    tr.NumeroSerieDispositivo AS numeroSerieDispositivo,

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
  AND tr.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z'
                          AND '${fechaFin}T23:59:59Z'

ORDER BY tr.FechaHoraFinal DESC
LIMIT ? OFFSET ?;

        `,
            [idUser, limit, offset],
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
  AND tr.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z'
                          AND '${fechaFin}T23:59:59Z'
  `, [idUser]
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
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({
        message: 'Error al obtener transacciones paginadas por rol',
      });
    }

  }

}
