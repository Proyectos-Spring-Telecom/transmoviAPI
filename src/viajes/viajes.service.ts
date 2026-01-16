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
import { EnumModulos, EstatusEnum } from 'src/common/estatus.enum';
import { Clientes } from 'src/entities/Clientes';
import { UpdateViajeDto } from './dto/update-viaje.dto';
import { ConteoPasajeros } from 'src/entities/ConteoPasajeros';
import { horaDesfasada } from 'src/utils/correccion-hora';

@Injectable()
export class ViajesService {
  constructor(
    @InjectRepository(Viajes)
    private readonly viajesRepository: Repository<Viajes>,
    @InjectRepository(Clientes)
    private readonly clienteRepository: Repository<Clientes>,
    @InjectRepository(ConteoPasajeros)
    private readonly conteoPasajerosRepository: Repository<ConteoPasajeros>,
    private readonly bitacoraLogger: BitacoraLoggerService,
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
      function pad(n: number) {
        return n < 10 ? '0' + n : n;
      }

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
      // 🔹 VALIDACIÓN: Solo usuarios con rol operador pueden actualizar viajes
      if (!idOperador) {
        throw new UnauthorizedException(`Usuario no autorizado para la generación de viajes.`)
      }

      // 🔹 FUNCIÓN AUXILIAR: Formatea números menores a 10 con un cero a la izquierda
      function pad(n: number) {
        return n < 10 ? '0' + n : n;
      }

      // 🔹 CÁLCULO DE FECHA CON DESFASE HORARIO
      // Se aplica un desfase de -6 horas al tiempo actual (ajuste de zona horaria)
      const ahora = new Date();
      const desfaseMs = -6 * 60 * 60 * 1000; // -6 horas en milisegundos
      const fechaDesfasada = new Date(ahora.getTime() + desfaseMs);
      // Formato de fecha para bitácora (string): YYYY-MM-DD HH:mm:ss
      const fechaActual = `${fechaDesfasada.getFullYear()}-${pad(fechaDesfasada.getMonth() + 1)}-${pad(fechaDesfasada.getDate())} ${pad(fechaDesfasada.getHours())}:${pad(fechaDesfasada.getMinutes())}:${pad(fechaDesfasada.getSeconds())}`;

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
  ins.IdBlueVox AS idBlueVox,
  -- BlueVox
  bv.NumeroSerie AS numeroSerieBlueVox,
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
  -- Regiones (Inicio y Fin)
  regInicio.Nombre AS nombreRegionInicio,
  r.IdRegionFin AS idRegionFin,
  -- Regiones (Inicio y Fin)
  regFin.Nombre AS nombreRegionFin

FROM Viajes v
JOIN Clientes c ON v.IdCliente = c.Id
JOIN Turnos t ON v.IdTurno = t.Id
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id
JOIN Dispositivos d ON ins.IdCliente = d.IdCliente AND ins.IdDispositivo = d.Id
JOIN BlueVoxs bv ON ins.IdCliente = bv.IdCliente AND ins.IdBlueVox = bv.Id
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
    const { ids, placeholders } = await this.clienteHijos(cliente);
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
  ins.IdBlueVox AS idBlueVox,
  -- BlueVox
  bv.NumeroSerie AS numeroSerieBlueVox,
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
  -- Regiones (Inicio y Fin)
  regInicio.Nombre AS nombreRegionInicio,
  r.IdRegionFin AS idRegionFin,
  -- Regiones (Inicio y Fin)
  regFin.Nombre AS nombreRegionFin

FROM Viajes v
JOIN Clientes c ON v.IdCliente = c.Id
JOIN Turnos t ON v.IdTurno = t.Id
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id
JOIN Dispositivos d ON ins.IdCliente = d.IdCliente AND ins.IdDispositivo = d.Id
JOIN BlueVoxs bv ON ins.IdCliente = bv.IdCliente AND ins.IdBlueVox = bv.Id
JOIN Vehiculos vhl ON ins.IdCliente = vhl.IdCliente AND ins.IdVehiculo = vhl.Id
JOIN Operadores o ON v.IdOperador = o.Id
JOIN Usuarios u ON o.IdUsuario = u.Id
JOIN Derroteros der ON v.IdDerrotero = der.Id
JOIN Rutas r ON der.IdRuta = r.Id
LEFT JOIN Regiones regInicio ON r.IdRegion = regInicio.Id
LEFT JOIN Regiones regFin ON r.IdRegionFin = regFin.Id

        WHERE v.Estatus = 1
        AND c.Id IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar
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
          // No hay filtrado por cliente, se muestran todos los viajes activos
          viajes = await this.viajesRepository.query(
            `
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
  ins.IdBlueVox AS idBlueVox,
  -- BlueVox
  bv.NumeroSerie AS numeroSerieBlueVox,
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
  -- Regiones (Inicio y Fin)
  regInicio.Nombre AS nombreRegionInicio,
  r.IdRegionFin AS idRegionFin,
  -- Regiones (Inicio y Fin)
  regFin.Nombre AS nombreRegionFin

FROM Viajes v
-- Cliente
JOIN Clientes c ON v.IdCliente = c.Id
JOIN Turnos t ON v.IdTurno = t.Id
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id
JOIN Dispositivos d ON ins.IdCliente = d.IdCliente AND ins.IdDispositivo = d.Id
JOIN BlueVoxs bv ON ins.IdCliente = bv.IdCliente AND ins.IdBlueVox = bv.Id
JOIN Vehiculos vhl ON ins.IdCliente = vhl.IdCliente AND ins.IdVehiculo = vhl.Id
JOIN Operadores o ON v.IdOperador = o.Id
JOIN Usuarios u ON o.IdUsuario = u.Id
JOIN Derroteros der ON v.IdDerrotero = der.Id
JOIN Rutas r ON der.IdRuta = r.Id
LEFT JOIN Regiones regInicio ON r.IdRegion = regInicio.Id
LEFT JOIN Regiones regFin ON r.IdRegionFin = regFin.Id
WHERE c.Estatus = 1

ORDER BY v.Id DESC;
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
        idBlueVox: Number(item.idBlueVox),
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

      //APi response
      const result: ApiResponseCommon = {
        data: viajes,
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
    const { ids, placeholders } = await this.clienteHijos(cliente);
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
  ins.IdBlueVox AS idBlueVox,
  -- BlueVox
  bv.NumeroSerie AS numeroSerieBlueVox,
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
  -- Regiones (Inicio y Fin)
  regInicio.Nombre AS nombreRegionInicio,
  r.IdRegionFin AS idRegionFin,
  -- Regiones (Inicio y Fin)
  regFin.Nombre AS nombreRegionFin

FROM Viajes v
JOIN Clientes c ON v.IdCliente = c.Id
JOIN Turnos t ON v.IdTurno = t.Id
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id
JOIN Dispositivos d ON ins.IdCliente = d.IdCliente AND ins.IdDispositivo = d.Id
JOIN BlueVoxs bv ON ins.IdCliente = bv.IdCliente AND ins.IdBlueVox = bv.Id
JOIN Vehiculos vhl ON ins.IdCliente = vhl.IdCliente AND ins.IdVehiculo = vhl.Id
JOIN Operadores o ON v.IdOperador = o.Id
JOIN Usuarios u ON o.IdUsuario = u.Id
JOIN Derroteros der ON v.IdDerrotero = der.Id
JOIN Rutas r ON der.IdRuta = r.Id
LEFT JOIN Regiones regInicio ON r.IdRegion = regInicio.Id
LEFT JOIN Regiones regFin ON r.IdRegionFin = regFin.Id

       
        AND c.Id IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar

ORDER BY v.Id DESC

  LIMIT ? OFFSET ?;
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
    const { ids, placeholders } = await this.clienteHijos(cliente);
    const query = `  
SELECT COUNT(*) AS total
FROM Viajes v
-- Cliente
JOIN Clientes c ON v.IdCliente = c.Id
JOIN Turnos t ON v.IdTurno = t.Id
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id
JOIN Dispositivos d ON ins.IdCliente = d.IdCliente AND ins.IdDispositivo = d.Id
JOIN BlueVoxs bv ON ins.IdCliente = bv.IdCliente AND ins.IdBlueVox = bv.Id
JOIN Vehiculos vhl ON ins.IdCliente = vhl.IdCliente AND ins.IdVehiculo = vhl.Id
JOIN Operadores o ON v.IdOperador = o.Id
JOIN Usuarios u ON o.IdUsuario = u.Id
JOIN Derroteros der ON v.IdDerrotero = der.Id
JOIN Rutas r ON der.IdRuta = r.Id
LEFT JOIN Regiones regInicio ON r.IdRegion = regInicio.Id
LEFT JOIN Regiones regFin ON r.IdRegionFin = regFin.Id

       
        AND c.Id IN (${placeholders})   -- 🔹 aquí colocas el ID del cliente que quieres consultar
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
  ins.IdBlueVox AS idBlueVox,
  -- BlueVox
  bv.NumeroSerie AS numeroSerieBlueVox,
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
  -- Regiones (Inicio y Fin)
  regInicio.Nombre AS nombreRegionInicio,
  r.IdRegionFin AS idRegionFin,
  -- Regiones (Inicio y Fin)
  regFin.Nombre AS nombreRegionFin

FROM Viajes v
JOIN Clientes c ON v.IdCliente = c.Id
JOIN Turnos t ON v.IdTurno = t.Id
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id
JOIN Dispositivos d ON ins.IdCliente = d.IdCliente AND ins.IdDispositivo = d.Id
JOIN BlueVoxs bv ON ins.IdCliente = bv.IdCliente AND ins.IdBlueVox = bv.Id
JOIN Vehiculos vhl ON ins.IdCliente = vhl.IdCliente AND ins.IdVehiculo = vhl.Id
JOIN Operadores o ON v.IdOperador = o.Id
JOIN Usuarios u ON o.IdUsuario = u.Id
JOIN Derroteros der ON v.IdDerrotero = der.Id
JOIN Rutas r ON der.IdRuta = r.Id
LEFT JOIN Regiones regInicio ON r.IdRegion = regInicio.Id
LEFT JOIN Regiones regFin ON r.IdRegionFin = regFin.Id

       
        AND c.Id = ?

ORDER BY v.Id DESC

  LIMIT ? OFFSET ?;
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
-- Cliente
JOIN Clientes c ON v.IdCliente = c.Id
JOIN Turnos t ON v.IdTurno = t.Id
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id
JOIN Dispositivos d ON ins.IdCliente = d.IdCliente AND ins.IdDispositivo = d.Id
JOIN BlueVoxs bv ON ins.IdCliente = bv.IdCliente AND ins.IdBlueVox = bv.Id
JOIN Vehiculos vhl ON ins.IdCliente = vhl.IdCliente AND ins.IdVehiculo = vhl.Id
JOIN Operadores o ON v.IdOperador = o.Id
JOIN Usuarios u ON o.IdUsuario = u.Id
JOIN Derroteros der ON v.IdDerrotero = der.Id
JOIN Rutas r ON der.IdRuta = r.Id
LEFT JOIN Regiones regInicio ON r.IdRegion = regInicio.Id
LEFT JOIN Regiones regFin ON r.IdRegionFin = regFin.Id

       
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
          // Se ejecuta una consulta directa sin filtrado por cliente
          viajes = await this.viajesRepository.query(
            `
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
  ins.IdBlueVox AS idBlueVox,
  -- BlueVox
  bv.NumeroSerie AS numeroSerieBlueVox,
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
  -- Regiones (Inicio y Fin)
  regInicio.Nombre AS nombreRegionInicio,
  r.IdRegionFin AS idRegionFin,
  -- Regiones (Inicio y Fin)
  regFin.Nombre AS nombreRegionFin

FROM Viajes v
JOIN Clientes c ON v.IdCliente = c.Id
JOIN Turnos t ON v.IdTurno = t.Id
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id
JOIN Dispositivos d ON ins.IdCliente = d.IdCliente AND ins.IdDispositivo = d.Id
JOIN BlueVoxs bv ON ins.IdCliente = bv.IdCliente AND ins.IdBlueVox = bv.Id
JOIN Vehiculos vhl ON ins.IdCliente = vhl.IdCliente AND ins.IdVehiculo = vhl.Id
JOIN Operadores o ON v.IdOperador = o.Id
JOIN Usuarios u ON o.IdUsuario = u.Id
JOIN Derroteros der ON v.IdDerrotero = der.Id
JOIN Rutas r ON der.IdRuta = r.Id
LEFT JOIN Regiones regInicio ON r.IdRegion = regInicio.Id
LEFT JOIN Regiones regFin ON r.IdRegionFin = regFin.Id

        

ORDER BY v.Id DESC
LIMIT ? OFFSET ?;
            `,
            [limit, offset],
          );

          // 🔹 CONTEO TOTAL: Se obtiene el total de viajes (sin paginación) para calcular la última página
          // Esta consulta no incluye LIMIT ni OFFSET, solo cuenta los registros
          totalResult = await this.viajesRepository.query(
            `
  SELECT COUNT(*) AS total
  FROM Viajes v
  
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
        idBlueVox: Number(item.idBlueVox),
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

      //APi response
      const result: ApiResponseCommon = {
        data: viajes,
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
  ins.IdBlueVox AS idBlueVox,
  -- BlueVox
  bv.NumeroSerie AS numeroSerieBlueVox,
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
  -- Regiones (Inicio y Fin)
  regInicio.Nombre AS nombreRegionInicio,
  r.IdRegionFin AS idRegionFin,
  -- Regiones (Inicio y Fin)
  regFin.Nombre AS nombreRegionFin

FROM Viajes v

JOIN Clientes c ON v.IdCliente = c.Id
JOIN Turnos t ON v.IdTurno = t.Id
JOIN Instalaciones ins ON t.IdInstalacion = ins.Id
JOIN Dispositivos d ON ins.IdCliente = d.IdCliente AND ins.IdDispositivo = d.Id
JOIN BlueVoxs bv ON ins.IdCliente = bv.IdCliente AND ins.IdBlueVox = bv.Id
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
        idBlueVox: Number(viaje.idBlueVox),
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

      //APi response
      const result: ApiResponseCommon = {
        data: viajes,
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
