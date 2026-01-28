import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateViajeDto } from './dto/create-viaje.dto';
import { Viajes } from 'src/entities/Viajes';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { EnumControlTarifaIncremental, EnumControlTransacciones, EnumModulos, EnumTipoTarifa, EstatusEnum } from 'src/common/estatus.enum';
import { Clientes } from 'src/entities/Clientes';
import { UpdateViajeDto } from './dto/update-viaje.dto';
import { ConteoPasajeros } from 'src/entities/ConteoPasajeros';
import { horaDesfasada } from 'src/utils/correccion-hora';
import { TransaccionesDebito } from 'src/entities/TransaccionesDebito';
import { TransaccionesService } from 'src/transacciones/transacciones.service';
import { calcularDistanciaHastaIndex, calcularDistanciaReal, snapToRoute } from 'src/utils/recorrido.utils';

@Injectable()
export class ViajesService {
  constructor(
    @InjectRepository(Viajes)
    private readonly viajesRepository: Repository<Viajes>,
    @InjectRepository(Clientes)
    private readonly clienteRepository: Repository<Clientes>,
    @InjectRepository(ConteoPasajeros)
    private readonly conteoPasajerosRepository: Repository<ConteoPasajeros>,
    @InjectRepository(TransaccionesDebito)
    private readonly transaccionesdebitoRepository: Repository<TransaccionesDebito>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly transaccionesService: TransaccionesService,
  ) { }
  // ========================================
  // 🔹 CREAR UN VIAJE
  // ========================================
  /**
   * Crea un nuevo viaje asociado a un turno, derrotero y operador.
   * 
   * Reglas de negocio:
   * - Solo usuarios con rol operador pueden crear viajes
   * - La fecha de inicio se establece automáticamente con desfase de horario (-6 horas)
   * - El estatus se establece automáticamente como ACTIVO
   * - El cliente y operador se obtienen del token del usuario autenticado
   * - Al crear el viaje, se crean automáticamente registros de ConteoPasajeros para cada
   *   BlueVox asociado a la instalación del turno (solo aquellos con Estatus=1 en InstalacionesBlueVoxs)
   * - Cada ConteoPasajeros se crea con valores iniciales (entradas=0, salidas=0, diferencia=0)
   *   y se asocia al viaje creado con estatus ACTIVO
   * 
   * Flujo de obtención de BlueVoxs:
   * Viajes → Turnos (obtener IdInstalacion) → InstalacionesBlueVoxs (obtener IdBlueVox con Estatus=1)
   * → BlueVoxs (obtener NumeroSerie) → Crear ConteoPasajeros por cada BlueVox
   * 
   * @param idUser ID del usuario que realiza la operación (para bitácora)
   * @param cliente ID del cliente (obtenido del token)
   * @param idOperador ID del operador (obtenido del token, debe existir)
   * @param createViajeDto DTO con los datos del viaje (idTurno, idDerrotero son obligatorios)
   * @returns Respuesta de la operación con el viaje creado
   * @throws UnauthorizedException Si el usuario no tiene rol operador
   * @throws InternalServerErrorException Si ocurre un error al crear el viaje o los conteos de pasajeros
   */
  async create(
    idUser: number,
    cliente: number,
    idOperador: number,
    createViajeDto: CreateViajeDto,
  ): Promise<ApiCrudResponse> {
    try {
      // 🔹 VALIDACIÓN: Solo usuarios con rol operador pueden crear viajes
      // El idOperador debe existir en el token del usuario autenticado
      if (!idOperador) {
        throw new UnauthorizedException(`Usuario no autorizado para la generación de viajes.`)
      }

      // 🔹 FUNCIÓN AUXILIAR: Formatea números menores a 10 con un cero a la izquierda
      // Ejemplo: pad(5) = "05", pad(15) = "15"
  

      // 🔹 CÁLCULO DE FECHA CON DESFASE HORARIO
      // Se aplica un desfase de -6 horas al tiempo actual (ajuste de zona horaria)
      const { fechaDesfasada, fechaActual } = await horaDesfasada();
      // 🔹 PREPARACIÓN DEL DTO: Se establecen valores automáticos
      // - inicio: Fecha actual con desfase de -6 horas
      // - estatus: ACTIVO (1) por defecto
      // - idCliente: Obtenido del token del usuario autenticado
      // - idOperador: Obtenido del token del usuario autenticado
      createViajeDto.inicio = fechaDesfasada;
      createViajeDto.estatus = EstatusEnum.ACTIVO;
      createViajeDto.idCliente = cliente;
      createViajeDto.idOperador = idOperador;

      // 🔹 CREACIÓN DEL VIAJE EN LA BASE DE DATOS
      // 1. Se crea una instancia de Viajes con los datos del DTO
      const newViaje = await this.viajesRepository.create(createViajeDto);
      // 2. Se guarda en la base de datos (genera el ID automático)
      const viajeSave = await this.viajesRepository.save(newViaje);

      // 🔹 CREACIÓN DE CONTEO DE PASAJEROS PARA CADA BLUEVOX ASOCIADO
      // Se obtienen los números de serie de los BlueVoxs asociados a la instalación del turno
      // Utilizando una query SQL optimizada que hace todos los JOINs necesarios en una sola consulta:
      // Viajes → Turnos → Instalaciones → InstalacionesBlueVoxs → BlueVoxs
      const blueVoxsQuery = `
        SELECT DISTINCT bv.NumeroSerie
        FROM Viajes v
        INNER JOIN Turnos t ON v.IdTurno = t.Id
        INNER JOIN InstalacionesBlueVoxs ibv ON t.IdInstalacion = ibv.IdInstalacion AND ibv.Estatus = 1
        INNER JOIN BlueVoxs bv ON ibv.IdBlueVox = bv.Id
        WHERE v.Id = ?
      `;

      const blueVoxsResult = await this.viajesRepository.query(blueVoxsQuery, [viajeSave.id]);
      const numerosSerieBlueVoxs = blueVoxsResult.map((row: any) => row.NumeroSerie);

      // 🔹 CREACIÓN DE REGISTROS DE CONTEO DE PASAJEROS
      // Se crea un registro de ConteoPasajeros por cada BlueVox asociado a la instalación
      // Cada registro se inicializa con valores por defecto (entradas=0, salidas=0, diferencia=0)
      if (numerosSerieBlueVoxs.length > 0) {
        const conteosPasajeros = numerosSerieBlueVoxs.map((numeroSerie: string) => {
          return this.conteoPasajerosRepository.create({
            entradas: 0,
            salidas: 0,
            diferencia: 0,
            fechaHora: fechaDesfasada, // Usa la misma fecha del viaje (con desfase de -6 horas)
            numeroSerieBlueVox: numeroSerie,
            idViaje: viajeSave.id, // Asocia el conteo con el viaje creado
            estatus: EstatusEnum.ACTIVO, // Establece el estatus como ACTIVO
          });
        });

        // 🔹 GUARDADO EN LOTE: Se guardan todos los conteos de una vez para mayor eficiencia
        await this.conteoPasajerosRepository.save(conteosPasajeros);
      }

      // 🔹 REGISTRO EN BITÁCORA: Se registra la operación exitosa
      // Se guarda el DTO completo para auditoría
      const querylogger = { createViajeDto };
      await this.bitacoraLogger.logToBitacora(
        'Viajes',
        `Se creó un viaje con ID: ${viajeSave.id}`,
        'CREATE',
        querylogger,
        idUser,
        EnumModulos.VIAJES,
        EstatusEnumBitcora.SUCCESS,
      );

      // 🔹 RESPUESTA DE LA API: Formato estándar de respuesta exitosa
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Viaje creado correctamente',
        data: {
          id: Number(viajeSave.id),
          nombre: `Cliente ID: ${viajeSave.idCliente}, Turno ID: ${viajeSave.idTurno}, Derrotero ID: ${viajeSave.idDerrotero}, Operador ID: ${viajeSave.idOperador}`,
        },
      };

      return result;
    } catch (error) {
      console.log(error);
      // 🔹 REGISTRO EN BITÁCORA: Se registra el error para auditoría
      // IMPORTANTE: El estatus en bitácora está marcado como SUCCESS, pero incluye error.message
      // Esto debería revisarse para usar EstatusEnumBitcora.ERROR en caso de error
      const querylogger = { createViajeDto };
      await this.bitacoraLogger.logToBitacora(
        'Viajes',
        `Se creó un viaje con client ID: ${createViajeDto.idCliente} Turno ID: ${createViajeDto.idTurno}, Derrotero ID: ${createViajeDto.idDerrotero}, Operador ID: ${createViajeDto.idOperador}`,
        'CREATE',
        querylogger,
        idUser,
        EnumModulos.VIAJES,
        EstatusEnumBitcora.SUCCESS,
        error.message,
      );
      // 🔹 MANEJO DE ERRORES: Si es una excepción HTTP conocida, se relanza
      // Si no, se envuelve en InternalServerErrorException
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al crear un viaje',
        error: error.message,
      });
    }
  }


  async findTarifa(idViaje: number) {

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

WHERE v.Id = ?
    `;
    return await this.viajesRepository.query(query, [idViaje]);
  }

  // ========================================
  // 🔹 ACTUALIZAR UN VIAJE
  // ========================================
  /**
   * Actualiza un viaje existente, generalmente para finalizarlo.
   * 
   * Reglas de negocio:
   * - Solo usuarios con rol operador pueden actualizar viajes
   * - El viaje debe pertenecer al mismo cliente y operador del usuario autenticado
   * - La fecha de fin se establece automáticamente con desfase de horario (-6 horas)
   * - El estatus se cambia automáticamente a INACTIVO (finalización del viaje)
   * - Al finalizar el viaje, todos los registros de ConteoPasajeros asociados al viaje
   *   también se actualizan a estatus INACTIVO para mantener consistencia
   * 
   * @param idUser ID del usuario que realiza la operación (para bitácora)
   * @param cliente ID del cliente (obtenido del token, debe coincidir con el del viaje)
   * @param idOperador ID del operador (obtenido del token, debe coincidir con el del viaje)
   * @param id ID del viaje a actualizar
   * @param updateViajeDto DTO con los campos a actualizar (fin y estatus son opcionales)
   * @returns Respuesta de la operación con el viaje actualizado
   * @throws UnauthorizedException Si el usuario no tiene rol operador
   * @throws NotFoundException Si el viaje no existe
   * @throws BadRequestException Si los datos del viaje no coinciden con los del usuario
   * @throws InternalServerErrorException Si ocurre un error al actualizar el viaje o los conteos de pasajeros
   */
  async update(
    idUser: number,
    cliente: number,
    idOperador: number,
    id: number,
    updateViajeDto: UpdateViajeDto,
  ): Promise<ApiCrudResponse> {
    try {
      console.log('Entro a actualizar un viaje con ID: ', id, ' para cerrar el viaje');
      // 🔹 VALIDACIÓN: Solo usuarios con rol operador pueden actualizar viajes
      if (!idOperador) {
        throw new UnauthorizedException(`Usuario no autorizado para la generación de viajes.`)
      }

      const { fechaDesfasada, fechaActual } = await horaDesfasada();
      // 🔹 BÚSQUEDA DEL VIAJE: Se valida que el viaje exista
      const viaje = await this.viajesRepository.findOne({ where: { id } });
      if (!viaje) {
        throw new NotFoundException(`Viaje con ID ${id} no encontrado`);
      }

      // 🔹 VALIDACIÓN DE PERMISOS: El viaje debe pertenecer al mismo cliente y operador
      // Esto asegura que solo el operador que creó el viaje pueda finalizarlo
      if (cliente != viaje.idCliente || idOperador != viaje.idOperador) {
        throw new BadRequestException(`Los datos del viaje con ID: ${id} no coinciden con los del usuario.`)
      }

      // 🔹 VALIDACIÓN Que no exista transacciones abiertas
      const transacciones = await this.transaccionesdebitoRepository.find({ where: { idViajes: id, idControlTransaccion: EnumControlTransacciones.ABIERTA } });

      //si hay transacciones abiertas procedemos a cerrar las transacciones
      if (transacciones.length > 0) {
        console.log('Hay transacciones abiertas, procedemos a cerrar las transacciones');
        await this.viajeCierre(id);
      }
      // 🔹 PREPARACIÓN DEL DTO: Se establecen valores automáticos para finalizar el viaje
      // - estatus: INACTIVO (0) para indicar que el viaje ha terminado
      // - fin: Fecha actual con desfase de -6 horas
      updateViajeDto.estatus = EstatusEnum.INACTIVO;
      updateViajeDto.fin = fechaDesfasada;

      // 🔹 ACTUALIZACIÓN EN LA BASE DE DATOS: Solo se actualizan los campos enviados
      // Los campos que no se envían en el DTO permanecen sin cambios
      await this.viajesRepository.update(id, updateViajeDto);

      // 🔹 ACTUALIZACIÓN DE CONTEO DE PASAJEROS ASOCIADOS AL VIAJE
      // Al finalizar un viaje (cambiar su estatus a INACTIVO), se actualizan todos los registros
      // de ConteoPasajeros asociados a ese viaje para también marcarlos como INACTIVOS
      // Esto mantiene la consistencia: si el viaje termina, los conteos también deben finalizar
      await this.conteoPasajerosRepository.update(
        { idViaje: id }, // Filtra todos los conteos asociados al viaje
        { estatus: EstatusEnum.INACTIVO } // Cambia su estatus a INACTIVO
      );

      // 🔹 REGISTRO EN BITÁCORA: Se registra la operación exitosa
      const querylogger = { updateViajeDto };
      await this.bitacoraLogger.logToBitacora(
        'Viajes',
        `Se actualizó el viaje con ID: ${viaje.id}`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.VIAJES,
        EstatusEnumBitcora.SUCCESS,
      );

      // 🔹 RESPUESTA DE LA API: Formato estándar de respuesta exitosa
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Viaje actualizado correctamente',
        data: {
          id: Number(viaje.id),
          nombre: `Cliente ID: ${viaje.idCliente}, Turno ID: ${viaje.idTurno}, Derrotero ID: ${viaje.idDerrotero}, Operador ID: ${viaje.idOperador}`,
        },
      };

      return result;
    } catch (error) {
      console.log(error);
      // Registro en la bitácora FAIL
      const querylogger = { updateViajeDto };
      await this.bitacoraLogger.logToBitacora(
        'Viajes',
        `Error al actualizar el viaje con ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.VIAJES,
        EstatusEnumBitcora.ERROR,
        error.message,
      );

      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al actualizar el viaje',
        error: error.message,
      });
    }
  }

  // ========================================
  // 🔹 Cerrar transacciones abiertas de un viaje
  // ========================================

  async viajeCierre(idViaje: number) {
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

      //Proceso en caso de existir transacciones abiertas
      if (transacciones.length > 0) {
        const viajeData = await this.findTarifa(idViaje);
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

        //Como existe transacciones abiertas, se debe calcular el monto de cada transaccion
        for (const i of transacciones) {
          const { latitudInicial, longitudInicial } = i;
          if (latitudInicial && longitudInicial) {
            const posicionActual = { lat: latitudInicial, lng: longitudInicial };

            ///////////////////*********************
            // //////////switch para saber si la tarifa es incremental o estacionaria */
            switch (tipoTarifa) {
              case EnumTipoTarifa.ESTACIONARIA:
                montoCalculado = tarifaBase;
                controlTransaccion = EnumControlTransacciones.PAGADO;

                //Obtenemos los ultimos puntos del derrotero
                const ultimoPunto1 = recorridoInterpolar.length - 1;
                const { lat: latitudFinal1Raw, lng: longitudFinal1Raw } = recorridoInterpolar[ultimoPunto1];
                // Formatear a decimal(10,7) - 7 decimales
                const latitudFinal1 = parseFloat(Number(latitudFinal1Raw).toFixed(7));
                const longitudFinal1 = parseFloat(Number(longitudFinal1Raw).toFixed(7));

                await this.transaccionesService.createTransaccionDebitoByViajes(
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
                  i.id
                )
                break;
              case EnumTipoTarifa.INCREMENTAL:
                //Buscamos el punto mas que se encuentre nuestro recorrido con snapToRoute
                const { index, distanciaMetros } = await snapToRoute(
                  posicionActual,
                  recorridoInterpolar
                );

                //Calculamos la distancia en metros
                //tomamos el penultimo punto mas cercano a la posicion actual
                const indexSeguro = Math.max(index - 1, 0);
                console.log(latitudInicial, longitudInicial, index, indexSeguro, distanciaMetros);
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
                metrosBase = (DistanciaBaseKm * 1000);
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
              Distancia base en km: ${DistanciaBaseKm},
              Distancia base en metros: ${metrosBase},
              Distancia en metros para el incremento: ${incrementoCadaMetros},
              Costo adicional por cada incremente: ${costoAdicional},
              Monto con el calculo: ${montoCalculado}
              `);

                //Obtenemos los ultimos puntos del derrotero
                const ultimoPunto = recorridoInterpolar.length - 1;
                const { lat: latitudFinal, lng:longitudFinal } = recorridoInterpolar[ultimoPunto];
                // Formatear a decimal(10,7) - 7 decimales
                const latitudFinalRaw = parseFloat(Number(latitudFinal).toFixed(7));
                const longitudFinalRaw = parseFloat(Number(longitudFinal).toFixed(7));
                //console.log(latitudFinalRaw,longitudFinalRaw,'///*/*/*/*/*/*/*/*/*/*/*/*/*/*/*/*/*',latitudFinal, longitudFinal);

                await this.transaccionesService.createTransaccionDebitoByViajes(
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
                  i.id
                )

                //fin del proceso
                break;

              default:
                break;
            }
          }
        }

      }

    } catch (error) {
      console.log(error);
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
   * Función auxiliar para obtener los clientes hijos de un cliente padre.
   * 
   * Utiliza el stored procedure spGetClientes para obtener la jerarquía de clientes.
   * Esta función es utilizada por roles Administrador, Reportes y Capturista para
   * filtrar viajes según la jerarquía de clientes.
   * 
   * @param cliente ID del cliente padre del cual se obtendrán los hijos
   * @returns Objeto con arrays de IDs de clientes y placeholders para consultas SQL
   *          Si no hay clientes, retorna { data: [] }
   */
  private async clienteHijos(cliente: number) {
    // 🔹 LLAMADA AL STORED PROCEDURE: Obtiene la jerarquía de clientes
    // El stored procedure retorna los clientes hijos y el cliente mismo
    const clientesFiltrado = await this.clienteRepository.query(
      `CALL spGetClientes(?);`,
      [cliente],
    );

    // 🔹 PROCESAMIENTO DE RESULTADOS: El primer índice contiene los resultados del SP
    const idsFiltrados = clientesFiltrado[0]; // El primer índice contiene los resultados
    // Se convierten los IDs a números y se filtran valores falsy (null, undefined, 0)
    const ids = idsFiltrados
      .map((clientesFiltrado: any) => Number(clientesFiltrado.Id))
      .filter(Boolean);

    // Si no hay clientes, se retorna un objeto vacío
    if (ids.length === 0) {
      return { data: [] }; // No hay clientes que consultar
    }

    // 🔹 CONSTRUCCIÓN DE PLACEHOLDERS: Se crea un string con '?' para cada ID
    // Ejemplo: Si ids = [1, 2, 3], placeholders = "?, ?, ?"
    // Esto se usa para construir consultas SQL dinámicas con IN (?, ?, ?)
    const placeholders = ids.map(() => '?').join(', ');
    return { ids, placeholders };
  }

  /**
   * Parsea y normaliza el array blueVoxs devuelto por las consultas (JSON_ARRAYAGG).
   * Compatible con instalaciones: idBlueVox, numeroSerieBlueVox, marcaBlueVox, modeloBlueVox.
   */
  private parseBlueVoxs(raw: any): any[] {
    if (raw == null) return [];
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return [];
    return arr.map((b: any) => ({
      ...b,
      idBlueVox: b.idBlueVox != null ? Number(b.idBlueVox) : null,
    }));
  }

  /**
   * Consulta SQL privada: Obtiene viajes de un cliente específico (sin jerarquía).
   * 
   * Utilizada por roles Cliente (rol 3) para obtener solo sus propios viajes.
   * No incluye viajes de clientes hijos, solo los viajes del cliente especificado.
   * 
   * @param cliente ID del cliente del cual se obtendrán los viajes
   * @returns Listado de viajes con información completa (sin paginación)
   */
  private async consultarViajesListadoCL(cliente: number) {
    const query = `
SELECT
  -- Viaje
  v.Id AS id,
  v.Inicio AS inicio,
  v.Fin AS fin,
  v.Estatus AS estatus,

  -- Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,

  -- Turno
  t.Id AS idTurno,
  t.Inicio AS inicioTurno,
  t.IdInstalacion AS idInstalacion,

  -- Instalación
  ins.IdDispositivo AS idDispositivo,
  -- Dispositivo
  d.NumeroSerie AS numeroSerieDispositivo,
  COALESCE(
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'idBlueVox', bx.Id,
          'numeroSerieBlueVox', bx.NumeroSerie,
          'marcaBlueVox', bx.Marca,
          'modeloBlueVox', bx.Modelo
        )
      )
      FROM InstalacionesBlueVoxs ibv
      INNER JOIN BlueVoxs bx ON ibv.IdBlueVox = bx.Id
      WHERE ibv.IdInstalacion = ins.Id
        AND ibv.Estatus = 1
        AND bx.IdCliente = ins.IdCliente
    ),
    JSON_ARRAY()
  ) AS blueVoxs,
  ins.IdVehiculo AS idVehiculo,
  -- Vehículo
  vhl.Placa AS placaVehiculo,

  -- Operador
  o.Id AS idOperador,
  o.IdUsuario AS idUsuario,

  -- Usuario del operador
  u.Nombre AS nombreOperador,
  u.ApellidoPaterno AS apellidoPaternoOperador,
  u.ApellidoMaterno AS apellidoMaternoOperador,

  -- Derrotero
  der.Id AS idDerrotero,
  der.Nombre AS nombreDerrotero,
  der.PuntoInicio AS puntoInicioDerrotero,
  der.PuntoFin AS puntoFinDerrotero,
  der.DistanciaKm AS distanciaKmDerrotero,

  -- Ruta
  r.Id AS idRuta,
  r.Nombre AS nombreRuta,
  r.IdRegion AS idRegion,
  regInicio.Nombre AS nombreRegionInicio,
  r.IdRegionFin AS idRegionFin,
  regFin.Nombre AS nombreRegionFin

FROM Viajes v
JOIN Clientes c ON v.IdCliente = c.Id
JOIN Turnos t ON v.IdTurno = t.Id
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id
JOIN Dispositivos d ON ins.IdCliente = d.IdCliente AND ins.IdDispositivo = d.Id
JOIN Vehiculos vhl ON ins.IdCliente = vhl.IdCliente AND ins.IdVehiculo = vhl.Id
JOIN Operadores o ON v.IdOperador = o.Id
JOIN Usuarios u ON o.IdUsuario = u.Id
JOIN Derroteros der ON v.IdDerrotero = der.Id
JOIN Rutas r ON der.IdRuta = r.Id
LEFT JOIN Regiones regInicio ON r.IdRegion = regInicio.Id
LEFT JOIN Regiones regFin ON r.IdRegionFin = regFin.Id
WHERE v.Estatus = 1
  AND c.Id = ?
  AND c.Estatus = 1
ORDER BY v.Id DESC
    `;
    return this.viajesRepository.query(query, [cliente]);
  }

  /**
   * Consulta SQL privada: Obtiene viajes de clientes hijos (con jerarquía).
   * 
   * Utilizada por roles Administrador (rol 2), Reportes (rol 8) y Capturista (rol 10).
   * Incluye viajes del cliente y todos sus clientes hijos (jerarquía completa).
   * 
   * @param cliente ID del cliente padre del cual se obtendrán los viajes (incluyendo hijos)
   * @returns Listado de viajes con información completa (sin paginación)
   */
  private async consultarViajesListado(cliente: number) {
    const hijos = await this.clienteHijos(cliente);
    if ('data' in hijos && !('ids' in hijos)) return [];
    const { ids, placeholders } = hijos;
    const query = `
SELECT
  -- Viaje
  v.Id AS id,
  v.Inicio AS inicio,
  v.Fin AS fin,
  v.Estatus AS estatus,

  -- Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,

  -- Turno
  t.Id AS idTurno,
  t.Inicio AS inicioTurno,
  t.IdInstalacion AS idInstalacion,

  -- Instalación
  ins.IdDispositivo AS idDispositivo,
  d.NumeroSerie AS numeroSerieDispositivo,
  COALESCE(
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'idBlueVox', bx.Id,
          'numeroSerieBlueVox', bx.NumeroSerie,
          'marcaBlueVox', bx.Marca,
          'modeloBlueVox', bx.Modelo
        )
      )
      FROM InstalacionesBlueVoxs ibv
      INNER JOIN BlueVoxs bx ON ibv.IdBlueVox = bx.Id
      WHERE ibv.IdInstalacion = ins.Id
        AND ibv.Estatus = 1
        AND bx.IdCliente = ins.IdCliente
    ),
    JSON_ARRAY()
  ) AS blueVoxs,
  ins.IdVehiculo AS idVehiculo,
  vhl.Placa AS placaVehiculo,

  o.Id AS idOperador,
  o.IdUsuario AS idUsuario,
  u.Nombre AS nombreOperador,
  u.ApellidoPaterno AS apellidoPaternoOperador,
  u.ApellidoMaterno AS apellidoMaternoOperador,

  der.Id AS idDerrotero,
  der.Nombre AS nombreDerrotero,
  der.PuntoInicio AS puntoInicioDerrotero,
  der.PuntoFin AS puntoFinDerrotero,
  der.DistanciaKm AS distanciaKmDerrotero,

  r.Id AS idRuta,
  r.Nombre AS nombreRuta,
  r.IdRegion AS idRegion,
  regInicio.Nombre AS nombreRegionInicio,
  r.IdRegionFin AS idRegionFin,
  regFin.Nombre AS nombreRegionFin

FROM Viajes v
JOIN Clientes c ON v.IdCliente = c.Id
JOIN Turnos t ON v.IdTurno = t.Id
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id
JOIN Dispositivos d ON ins.IdCliente = d.IdCliente AND ins.IdDispositivo = d.Id
JOIN Vehiculos vhl ON ins.IdCliente = vhl.IdCliente AND ins.IdVehiculo = vhl.Id
JOIN Operadores o ON v.IdOperador = o.Id
JOIN Usuarios u ON o.IdUsuario = u.Id
JOIN Derroteros der ON v.IdDerrotero = der.Id
JOIN Rutas r ON der.IdRuta = r.Id
LEFT JOIN Regiones regInicio ON r.IdRegion = regInicio.Id
LEFT JOIN Regiones regFin ON r.IdRegionFin = regFin.Id
WHERE v.Estatus = 1
  AND c.Id IN (${placeholders})
  AND c.Estatus = 1
ORDER BY v.Id DESC
    `;
    return this.viajesRepository.query(query, [...ids]);
  }

  // ========================================
  // 🔹 OBTENER LISTADO DE VIAJES
  // ========================================
  /**
   * Obtiene un listado completo de viajes según el rol del usuario.
   * 
   * Reglas de acceso por rol:
   * - Rol 1 (SuperAdministrador): Obtiene todos los viajes activos del sistema
   * - Rol 2, 8, 10 (Administrador, Reportes, Capturista): Obtiene viajes de clientes hijos
   * - Rol 3 (Cliente): Obtiene solo viajes de su propio cliente
   * 
   * Los viajes incluyen información detallada de:
   * - Turno, Instalación, Dispositivo, BlueVox, Vehículo
   * - Operador (usuario asociado), Derrotero, Ruta y Regiones
   * 
   * @param cliente ID del cliente (obtenido del token)
   * @param rol Rol del usuario (obtenido del token)
   * @returns Listado de viajes con información completa
   * @throws InternalServerErrorException Si ocurre un error al obtener los viajes
   */
  async findAllList(cliente: number, rol: number) {
    try {
      let viajes;
      // 🔹 LÓGICA DE FILTRADO POR ROL: Se determina qué consulta ejecutar según el rol
      switch (rol) {
        case 1:
          // 🔹 ROL 1 (SuperAdministrador): Obtiene TODOS los viajes activos del sistema
          viajes = await this.viajesRepository.query(
            `
SELECT
  v.Id AS id,
  v.Inicio AS inicio,
  v.Fin AS fin,
  v.Estatus AS estatus,
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  t.Id AS idTurno,
  t.Inicio AS inicioTurno,
  t.IdInstalacion AS idInstalacion,
  ins.IdDispositivo AS idDispositivo,
  d.NumeroSerie AS numeroSerieDispositivo,
  COALESCE(
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'idBlueVox', bx.Id,
          'numeroSerieBlueVox', bx.NumeroSerie,
          'marcaBlueVox', bx.Marca,
          'modeloBlueVox', bx.Modelo
        )
      )
      FROM InstalacionesBlueVoxs ibv
      INNER JOIN BlueVoxs bx ON ibv.IdBlueVox = bx.Id
      WHERE ibv.IdInstalacion = ins.Id
        AND ibv.Estatus = 1
        AND bx.IdCliente = ins.IdCliente
    ),
    JSON_ARRAY()
  ) AS blueVoxs,
  ins.IdVehiculo AS idVehiculo,
  vhl.Placa AS placaVehiculo,
  o.Id AS idOperador,
  o.IdUsuario AS idUsuario,
  u.Nombre AS nombreOperador,
  u.ApellidoPaterno AS apellidoPaternoOperador,
  u.ApellidoMaterno AS apellidoMaternoOperador,
  der.Id AS idDerrotero,
  der.Nombre AS nombreDerrotero,
  der.PuntoInicio AS puntoInicioDerrotero,
  der.PuntoFin AS puntoFinDerrotero,
  der.DistanciaKm AS distanciaKmDerrotero,
  r.Id AS idRuta,
  r.Nombre AS nombreRuta,
  r.IdRegion AS idRegion,
  regInicio.Nombre AS nombreRegionInicio,
  r.IdRegionFin AS idRegionFin,
  regFin.Nombre AS nombreRegionFin

FROM Viajes v
JOIN Clientes c ON v.IdCliente = c.Id
JOIN Turnos t ON v.IdTurno = t.Id
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id
JOIN Dispositivos d ON ins.IdCliente = d.IdCliente AND ins.IdDispositivo = d.Id
JOIN Vehiculos vhl ON ins.IdCliente = vhl.IdCliente AND ins.IdVehiculo = vhl.Id
JOIN Operadores o ON v.IdOperador = o.Id
JOIN Usuarios u ON o.IdUsuario = u.Id
JOIN Derroteros der ON v.IdDerrotero = der.Id
JOIN Rutas r ON der.IdRuta = r.Id
LEFT JOIN Regiones regInicio ON r.IdRegion = regInicio.Id
LEFT JOIN Regiones regFin ON r.IdRegionFin = regFin.Id
WHERE v.Estatus = 1 AND c.Estatus = 1
ORDER BY v.Id DESC
            `,
          );
          break;
        case 2:
        case 8:
        case 10:
          // 🔹 ROL 2, 8, 10 (Administrador, Reportes, Capturista): Obtiene viajes de clientes hijos
          // Se incluyen viajes del cliente y todos sus clientes hijos (jerarquía)
          viajes = await this.consultarViajesListado(cliente);
          break;

        case 3:
        default:
          // 🔹 ROL 3 (Cliente) o default: Obtiene solo viajes del cliente específico
          // No se incluyen clientes hijos, solo los viajes del cliente autenticado
          viajes = await this.consultarViajesListadoCL(cliente);
          break;
      }

      // 🔹 TRANSFORMACIÓN DE DATOS: Se convierten todos los IDs a números
      // Esto asegura que los tipos sean consistentes en la respuesta de la API
      const data = viajes.map((item) => ({
        ...item,
        id: Number(item.id),
        idCliente: Number(item.idCliente),
        idTurno: Number(item.idTurno),
        idInstalacion: Number(item.idInstalacion),
        idDispositivo: Number(item.idDispositivo),
        blueVoxs: this.parseBlueVoxs(item.blueVoxs),
        idVehiculo: Number(item.idVehiculo),
        idOperador: Number(item.idOperador),
        idUsuario: Number(item.idUsuario),
        idDerrotero: Number(item.idDerrotero),
        distanciaKmDerrotero:
          item.distanciaKmDerrotero !== null
            ? Number(item.distanciaKmDerrotero)
            : null,
        idRuta: Number(item.idRuta),
        idRegion: Number(item.idRegion),
        idRegionFin:
          item.idRegionFin !== null ? Number(item.idRegionFin) : null,
      }));

      const result: ApiResponseCommon = {
        data,
      };

      return result;
    } catch (error) {
      console.log(error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtener paginado viajes',
        error: error.message,
      });
    }
  }

  /**
   * Consulta SQL privada: Obtiene viajes de clientes hijos (con jerarquía) paginados.
   * 
   * Utilizada por roles Administrador (rol 2), Reportes (rol 8) y Capturista (rol 10).
   * Incluye viajes del cliente y todos sus clientes hijos (jerarquía completa).
   * 
   * @param cliente ID del cliente padre del cual se obtendrán los viajes (incluyendo hijos)
   * @param limit Cantidad de registros por página
   * @param offset Desplazamiento para la paginación (salta N registros)
   * @returns Listado paginado de viajes con información completa
   */
  private async consultarViajesPaginado(
    cliente: number,
    limit: number,
    offset: number,
  ) {
    const hijos = await this.clienteHijos(cliente);
    if ('data' in hijos && !('ids' in hijos)) return [];
    const { ids, placeholders } = hijos;
    const query = `
SELECT
  -- Viaje
  v.Id AS id,
  v.Inicio AS inicio,
  v.Fin AS fin,
  v.Estatus AS estatus,

  -- Cliente
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,

  -- Turno
  t.Id AS idTurno,
  t.Inicio AS inicioTurno,
  t.IdInstalacion AS idInstalacion,

  -- Instalación
  ins.IdDispositivo AS idDispositivo,
  d.NumeroSerie AS numeroSerieDispositivo,
  COALESCE(
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'idBlueVox', bx.Id,
          'numeroSerieBlueVox', bx.NumeroSerie,
          'marcaBlueVox', bx.Marca,
          'modeloBlueVox', bx.Modelo
        )
      )
      FROM InstalacionesBlueVoxs ibv
      INNER JOIN BlueVoxs bx ON ibv.IdBlueVox = bx.Id
      WHERE ibv.IdInstalacion = ins.Id
        AND ibv.Estatus = 1
        AND bx.IdCliente = ins.IdCliente
    ),
    JSON_ARRAY()
  ) AS blueVoxs,
  ins.IdVehiculo AS idVehiculo,
  vhl.Placa AS placaVehiculo,

  o.Id AS idOperador,
  o.IdUsuario AS idUsuario,
  u.Nombre AS nombreOperador,
  u.ApellidoPaterno AS apellidoPaternoOperador,
  u.ApellidoMaterno AS apellidoMaternoOperador,

  der.Id AS idDerrotero,
  der.Nombre AS nombreDerrotero,
  der.PuntoInicio AS puntoInicioDerrotero,
  der.PuntoFin AS puntoFinDerrotero,
  der.DistanciaKm AS distanciaKmDerrotero,

  r.Id AS idRuta,
  r.Nombre AS nombreRuta,
  r.IdRegion AS idRegion,
  regInicio.Nombre AS nombreRegionInicio,
  r.IdRegionFin AS idRegionFin,
  regFin.Nombre AS nombreRegionFin

FROM Viajes v
JOIN Clientes c ON v.IdCliente = c.Id
JOIN Turnos t ON v.IdTurno = t.Id
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id
JOIN Dispositivos d ON ins.IdCliente = d.IdCliente AND ins.IdDispositivo = d.Id
JOIN Vehiculos vhl ON ins.IdCliente = vhl.IdCliente AND ins.IdVehiculo = vhl.Id
JOIN Operadores o ON v.IdOperador = o.Id
JOIN Usuarios u ON o.IdUsuario = u.Id
JOIN Derroteros der ON v.IdDerrotero = der.Id
JOIN Rutas r ON der.IdRuta = r.Id
LEFT JOIN Regiones regInicio ON r.IdRegion = regInicio.Id
LEFT JOIN Regiones regFin ON r.IdRegionFin = regFin.Id
WHERE v.Estatus = 1
  AND c.Estatus = 1
  AND c.Id IN (${placeholders})
ORDER BY v.Id DESC
LIMIT ? OFFSET ?
    `;
    return this.viajesRepository.query(query, [...ids, limit, offset]);
  }

  /**
   * Consulta SQL privada: Cuenta el total de viajes de clientes hijos (con jerarquía).
   * 
   * Utilizada para calcular la paginación en findAll() para roles Administrador,
   * Reportes y Capturista. Cuenta solo los viajes activos.
   * 
   * @param cliente ID del cliente padre del cual se contarán los viajes (incluyendo hijos)
   * @returns Total de viajes (número entero)
   */
  private async consultarTotalRutasPaginados(cliente: number) {
    const hijos = await this.clienteHijos(cliente);
    if ('data' in hijos && !('ids' in hijos)) return [{ total: 0 }];
    const { ids, placeholders } = hijos;
    const query = `
SELECT COUNT(*) AS total
FROM Viajes v
JOIN Clientes c ON v.IdCliente = c.Id
JOIN Turnos t ON v.IdTurno = t.Id
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id
JOIN Dispositivos d ON ins.IdCliente = d.IdCliente AND ins.IdDispositivo = d.Id
JOIN Vehiculos vhl ON ins.IdCliente = vhl.IdCliente AND ins.IdVehiculo = vhl.Id
JOIN Operadores o ON v.IdOperador = o.Id
JOIN Usuarios u ON o.IdUsuario = u.Id
JOIN Derroteros der ON v.IdDerrotero = der.Id
JOIN Rutas r ON der.IdRuta = r.Id
LEFT JOIN Regiones regInicio ON r.IdRegion = regInicio.Id
LEFT JOIN Regiones regFin ON r.IdRegionFin = regFin.Id
WHERE v.Estatus = 1
  AND c.Estatus = 1
  AND c.Id IN (${placeholders})
`;
    return await this.viajesRepository.query(query, [...ids]);
  }



  /**
   * Consulta SQL privada: Obtiene viajes de un cliente específico (sin jerarquía) paginados.
   * 
   * Utilizada por roles Cliente (rol 3) para obtener solo sus propios viajes.
   * No incluye viajes de clientes hijos, solo los viajes del cliente especificado.
   * 
   * @param cliente ID del cliente del cual se obtendrán los viajes
   * @param limit Cantidad de registros por página
   * @param offset Desplazamiento para la paginación (salta N registros)
   * @returns Listado paginado de viajes con información completa
   */
  private async consultarViajesPaginadoCL(
    cliente: number,
    limit: number,
    offset: number,
  ) {
    const query = `
SELECT
  v.Id AS id,
  v.Inicio AS inicio,
  v.Fin AS fin,
  v.Estatus AS estatus,
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  t.Id AS idTurno,
  t.Inicio AS inicioTurno,
  t.IdInstalacion AS idInstalacion,
  ins.IdDispositivo AS idDispositivo,
  d.NumeroSerie AS numeroSerieDispositivo,
  COALESCE(
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'idBlueVox', bx.Id,
          'numeroSerieBlueVox', bx.NumeroSerie,
          'marcaBlueVox', bx.Marca,
          'modeloBlueVox', bx.Modelo
        )
      )
      FROM InstalacionesBlueVoxs ibv
      INNER JOIN BlueVoxs bx ON ibv.IdBlueVox = bx.Id
      WHERE ibv.IdInstalacion = ins.Id
        AND ibv.Estatus = 1
        AND bx.IdCliente = ins.IdCliente
    ),
    JSON_ARRAY()
  ) AS blueVoxs,
  ins.IdVehiculo AS idVehiculo,
  vhl.Placa AS placaVehiculo,
  o.Id AS idOperador,
  o.IdUsuario AS idUsuario,
  u.Nombre AS nombreOperador,
  u.ApellidoPaterno AS apellidoPaternoOperador,
  u.ApellidoMaterno AS apellidoMaternoOperador,
  der.Id AS idDerrotero,
  der.Nombre AS nombreDerrotero,
  der.PuntoInicio AS puntoInicioDerrotero,
  der.PuntoFin AS puntoFinDerrotero,
  der.DistanciaKm AS distanciaKmDerrotero,
  r.Id AS idRuta,
  r.Nombre AS nombreRuta,
  r.IdRegion AS idRegion,
  regInicio.Nombre AS nombreRegionInicio,
  r.IdRegionFin AS idRegionFin,
  regFin.Nombre AS nombreRegionFin

FROM Viajes v
JOIN Clientes c ON v.IdCliente = c.Id
JOIN Turnos t ON v.IdTurno = t.Id
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id
JOIN Dispositivos d ON ins.IdCliente = d.IdCliente AND ins.IdDispositivo = d.Id
JOIN Vehiculos vhl ON ins.IdCliente = vhl.IdCliente AND ins.IdVehiculo = vhl.Id
JOIN Operadores o ON v.IdOperador = o.Id
JOIN Usuarios u ON o.IdUsuario = u.Id
JOIN Derroteros der ON v.IdDerrotero = der.Id
JOIN Rutas r ON der.IdRuta = r.Id
LEFT JOIN Regiones regInicio ON r.IdRegion = regInicio.Id
LEFT JOIN Regiones regFin ON r.IdRegionFin = regFin.Id
WHERE v.Estatus = 1
  AND c.Estatus = 1
  AND c.Id = ?
ORDER BY v.Id DESC
LIMIT ? OFFSET ?
    `;
    return this.viajesRepository.query(query, [cliente, limit, offset]);
  }

  /**
   * Consulta SQL privada: Cuenta el total de viajes de un cliente específico (sin jerarquía).
   * 
   * Utilizada para calcular la paginación en findAll() para roles Cliente.
   * Cuenta solo los viajes activos del cliente especificado.
   * 
   * @param cliente ID del cliente del cual se contarán los viajes
   * @returns Total de viajes (número entero)
   */
  private async consultarTotalRutasPaginadosCL(cliente: number) {
    const query = `
SELECT COUNT(*) AS total
FROM Viajes v
JOIN Clientes c ON v.IdCliente = c.Id
JOIN Turnos t ON v.IdTurno = t.Id
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id
JOIN Dispositivos d ON ins.IdCliente = d.IdCliente AND ins.IdDispositivo = d.Id
JOIN Vehiculos vhl ON ins.IdCliente = vhl.IdCliente AND ins.IdVehiculo = vhl.Id
JOIN Operadores o ON v.IdOperador = o.Id
JOIN Usuarios u ON o.IdUsuario = u.Id
JOIN Derroteros der ON v.IdDerrotero = der.Id
JOIN Rutas r ON der.IdRuta = r.Id
LEFT JOIN Regiones regInicio ON r.IdRegion = regInicio.Id
LEFT JOIN Regiones regFin ON r.IdRegionFin = regFin.Id
WHERE v.Estatus = 1
  AND c.Estatus = 1
  AND c.Id = ?
`;
    return await this.viajesRepository.query(query, [cliente]);
  }

  // ========================================
  // 🔹 OBTENER PAGINADO DE VIAJES
  // ========================================
  /**
   * Obtiene un listado paginado de viajes según el rol del usuario.
   * 
   * Reglas de acceso por rol:
   * - Rol 1 (SuperAdministrador): Obtiene todos los viajes activos del sistema (paginados)
   * - Rol 2, 8, 10 (Administrador, Reportes, Capturista): Obtiene viajes de clientes hijos (paginados)
   * - Rol 3 (Cliente): Obtiene solo viajes del cliente específico (paginados)
   * 
   * Los viajes incluyen información detallada y se retorna información de paginación
   * (total de registros, página actual, última página).
   * 
   * @param cliente ID del cliente (obtenido del token)
   * @param rol Rol del usuario (obtenido del token)
   * @param page Número de página (inicia en 1)
   * @param limit Cantidad de registros por página
   * @returns Listado paginado de viajes con información de paginación
   * @throws InternalServerErrorException Si ocurre un error al obtener los viajes
   */
  async findAll(
    cliente: number,
    rol: number,
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    try {
      // 🔹 CÁLCULO DE OFFSET: Se calcula el desplazamiento para la paginación
      // Ejemplo: page=2, limit=10 → offset=10 (salta los primeros 10 registros)
      const offset = (page - 1) * limit;
      let totalResult;
      let viajes;
      // 🔹 LÓGICA DE FILTRADO POR ROL: Se determina qué consulta ejecutar según el rol
      switch (rol) {
        case 1:
          // 🔹 ROL 1 (SuperAdministrador): Obtiene TODOS los viajes activos (paginados)
          viajes = await this.viajesRepository.query(
            `
SELECT
  v.Id AS id,
  v.Inicio AS inicio,
  v.Fin AS fin,
  v.Estatus AS estatus,
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  t.Id AS idTurno,
  t.Inicio AS inicioTurno,
  t.IdInstalacion AS idInstalacion,
  ins.IdDispositivo AS idDispositivo,
  d.NumeroSerie AS numeroSerieDispositivo,
  COALESCE(
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'idBlueVox', bx.Id,
          'numeroSerieBlueVox', bx.NumeroSerie,
          'marcaBlueVox', bx.Marca,
          'modeloBlueVox', bx.Modelo
        )
      )
      FROM InstalacionesBlueVoxs ibv
      INNER JOIN BlueVoxs bx ON ibv.IdBlueVox = bx.Id
      WHERE ibv.IdInstalacion = ins.Id
        AND ibv.Estatus = 1
        AND bx.IdCliente = ins.IdCliente
    ),
    JSON_ARRAY()
  ) AS blueVoxs,
  ins.IdVehiculo AS idVehiculo,
  vhl.Placa AS placaVehiculo,
  o.Id AS idOperador,
  o.IdUsuario AS idUsuario,
  u.Nombre AS nombreOperador,
  u.ApellidoPaterno AS apellidoPaternoOperador,
  u.ApellidoMaterno AS apellidoMaternoOperador,
  der.Id AS idDerrotero,
  der.Nombre AS nombreDerrotero,
  der.PuntoInicio AS puntoInicioDerrotero,
  der.PuntoFin AS puntoFinDerrotero,
  der.DistanciaKm AS distanciaKmDerrotero,
  r.Id AS idRuta,
  r.Nombre AS nombreRuta,
  r.IdRegion AS idRegion,
  regInicio.Nombre AS nombreRegionInicio,
  r.IdRegionFin AS idRegionFin,
  regFin.Nombre AS nombreRegionFin

FROM Viajes v
JOIN Clientes c ON v.IdCliente = c.Id
JOIN Turnos t ON v.IdTurno = t.Id
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id
JOIN Dispositivos d ON ins.IdCliente = d.IdCliente AND ins.IdDispositivo = d.Id
JOIN Vehiculos vhl ON ins.IdCliente = vhl.IdCliente AND ins.IdVehiculo = vhl.Id
JOIN Operadores o ON v.IdOperador = o.Id
JOIN Usuarios u ON o.IdUsuario = u.Id
JOIN Derroteros der ON v.IdDerrotero = der.Id
JOIN Rutas r ON der.IdRuta = r.Id
LEFT JOIN Regiones regInicio ON r.IdRegion = regInicio.Id
LEFT JOIN Regiones regFin ON r.IdRegionFin = regFin.Id
WHERE v.Estatus = 1 AND c.Estatus = 1
ORDER BY v.Id DESC
LIMIT ? OFFSET ?
            `,
            [limit, offset],
          );

          totalResult = await this.viajesRepository.query(
            `
SELECT COUNT(*) AS total
FROM Viajes v
JOIN Clientes c ON v.IdCliente = c.Id
JOIN Turnos t ON v.IdTurno = t.Id
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id
JOIN Dispositivos d ON ins.IdCliente = d.IdCliente AND ins.IdDispositivo = d.Id
JOIN Vehiculos vhl ON ins.IdCliente = vhl.IdCliente AND ins.IdVehiculo = vhl.Id
JOIN Operadores o ON v.IdOperador = o.Id
JOIN Usuarios u ON o.IdUsuario = u.Id
JOIN Derroteros der ON v.IdDerrotero = der.Id
JOIN Rutas r ON der.IdRuta = r.Id
LEFT JOIN Regiones regInicio ON r.IdRegion = regInicio.Id
LEFT JOIN Regiones regFin ON r.IdRegionFin = regFin.Id
WHERE v.Estatus = 1 AND c.Estatus = 1
            `,
          );
          break;
        case 2: // Administrador
        case 8:  // Reportes
        case 10:  // Capturista
          // 🔹 ROL 2, 8, 10 (Administrador, Reportes, Capturista): Obtiene viajes de clientes hijos (paginados)
          // Se incluyen viajes del cliente y todos sus clientes hijos (jerarquía)
          viajes = await this.consultarViajesPaginado(cliente, limit, offset);
          // Se obtiene el total de viajes para calcular la paginación
          totalResult = await this.consultarTotalRutasPaginados(cliente);
          break;

        case 3:
        default:
          // 🔹 ROL 3 (Cliente) o default: Obtiene solo viajes del cliente específico (paginados)
          // No se incluyen clientes hijos, solo los viajes del cliente autenticado
          viajes = await this.consultarViajesPaginadoCL(cliente, limit, offset);
          // Se obtiene el total de viajes para calcular la paginación
          totalResult = await this.consultarTotalRutasPaginadosCL(cliente);
          break;
      }

      const data = viajes.map((item) => ({
        ...item,
        id: Number(item.id),
        idCliente: Number(item.idCliente),
        idTurno: Number(item.idTurno),
        idInstalacion: Number(item.idInstalacion),
        idDispositivo: Number(item.idDispositivo),
        blueVoxs: this.parseBlueVoxs(item.blueVoxs),
        idVehiculo: Number(item.idVehiculo),
        idOperador: Number(item.idOperador),
        idUsuario: Number(item.idUsuario),
        idDerrotero: Number(item.idDerrotero),
        distanciaKmDerrotero:
          item.distanciaKmDerrotero !== null
            ? Number(item.distanciaKmDerrotero)
            : null,
        idRuta: Number(item.idRuta),
        idRegion: Number(item.idRegion),
        idRegionFin:
          item.idRegionFin !== null ? Number(item.idRegionFin) : null,
      }));

      const total = Number(totalResult[0]?.total || 0);

      const result: ApiResponseCommon = {
        data,
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
      throw new InternalServerErrorException({
        message: 'Error al obtener paginado de viajes',
        error: error.message,
      });
    }
  }

  // ========================================
  // 🔹 OBTENER UN VIAJE
  // ========================================
  /**
   * Obtiene la información detallada de un viaje específico por su ID.
   * 
   * El viaje incluye información completa de:
   * - Turno, Instalación, Dispositivo, BlueVox, Vehículo
   * - Operador (usuario asociado), Derrotero, Ruta y Regiones
   * 
   * @param id ID del viaje a consultar
   * @param cliente ID del cliente (obtenido del token, no se usa en la consulta actual)
   * @param rol Rol del usuario (obtenido del token, no se usa en la consulta actual)
   * @returns Información detallada del viaje solicitado
   * @throws NotFoundException Si el viaje no existe
   * @throws InternalServerErrorException Si ocurre un error al obtener el viaje
   */
  async findOne(id: number, cliente: number, rol: number) {
    try {
      let viajes;
      // 🔹 CONSULTA SQL NATIVA: Se ejecuta una consulta SQL directa para obtener el viaje
      // La consulta incluye múltiples JOINs para obtener información relacionada
      viajes = await this.viajesRepository.query(
        `
SELECT
  v.Id AS id,
  v.Inicio AS inicio,
  v.Fin AS fin,
  v.Estatus AS estatus,
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  t.Id AS idTurno,
  t.Inicio AS inicioTurno,
  t.IdInstalacion AS idInstalacion,
  ins.IdDispositivo AS idDispositivo,
  d.NumeroSerie AS numeroSerieDispositivo,
  COALESCE(
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'idBlueVox', bx.Id,
          'numeroSerieBlueVox', bx.NumeroSerie,
          'marcaBlueVox', bx.Marca,
          'modeloBlueVox', bx.Modelo
        )
      )
      FROM InstalacionesBlueVoxs ibv
      INNER JOIN BlueVoxs bx ON ibv.IdBlueVox = bx.Id
      WHERE ibv.IdInstalacion = ins.Id
        AND ibv.Estatus = 1
        AND bx.IdCliente = ins.IdCliente
    ),
    JSON_ARRAY()
  ) AS blueVoxs,
  ins.IdVehiculo AS idVehiculo,
  vhl.Placa AS placaVehiculo,
  o.Id AS idOperador,
  o.IdUsuario AS idUsuario,
  u.Nombre AS nombreOperador,
  u.ApellidoPaterno AS apellidoPaternoOperador,
  u.ApellidoMaterno AS apellidoMaternoOperador,
  der.Id AS idDerrotero,
  der.Nombre AS nombreDerrotero,
  der.PuntoInicio AS puntoInicioDerrotero,
  der.PuntoFin AS puntoFinDerrotero,
  der.DistanciaKm AS distanciaKmDerrotero,
  r.Id AS idRuta,
  r.Nombre AS nombreRuta,
  r.IdRegion AS idRegion,
  regInicio.Nombre AS nombreRegionInicio,
  r.IdRegionFin AS idRegionFin,
  regFin.Nombre AS nombreRegionFin

FROM Viajes v
JOIN Clientes c ON v.IdCliente = c.Id
JOIN Turnos t ON v.IdTurno = t.Id
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id
JOIN Dispositivos d ON ins.IdCliente = d.IdCliente AND ins.IdDispositivo = d.Id
JOIN Vehiculos vhl ON ins.IdCliente = vhl.IdCliente AND ins.IdVehiculo = vhl.Id
JOIN Operadores o ON v.IdOperador = o.Id
JOIN Usuarios u ON o.IdUsuario = u.Id
JOIN Derroteros der ON v.IdDerrotero = der.Id
JOIN Rutas r ON der.IdRuta = r.Id
LEFT JOIN Regiones regInicio ON r.IdRegion = regInicio.Id
LEFT JOIN Regiones regFin ON r.IdRegionFin = regFin.Id
WHERE v.Id = ?
ORDER BY v.Id DESC
            `,
        [id],
      );

      if (viajes.length === 0) {
        throw new NotFoundException('No se encontraron viajes.');
      }

      const viaje = viajes[0];

      const data = {
        ...viaje,
        id: Number(viaje.id),
        idCliente: Number(viaje.idCliente),
        idTurno: Number(viaje.idTurno),
        idInstalacion: Number(viaje.idInstalacion),
        idDispositivo: Number(viaje.idDispositivo),
        blueVoxs: this.parseBlueVoxs(viaje.blueVoxs),
        idVehiculo: Number(viaje.idVehiculo),
        idOperador: Number(viaje.idOperador),
        idUsuario: Number(viaje.idUsuario),
        idDerrotero: Number(viaje.idDerrotero),
        distanciaKmDerrotero:
          viaje.distanciaKmDerrotero !== null
            ? Number(viaje.distanciaKmDerrotero)
            : null,
        idRuta: Number(viaje.idRuta),
        idRegion: Number(viaje.idRegion),
        idRegionFin:
          viaje.idRegionFin !== null ? Number(viaje.idRegionFin) : null,
      };

      const result: ApiResponseCommon = {
        data,
      };

      return result;
    } catch (error) {
      console.log(error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtener un viaje',
        error: error.message,
      });
    }
  }
}
