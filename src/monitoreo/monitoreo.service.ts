import {
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiResponseCommon } from 'src/common/ApiResponse';
import { Clientes } from 'src/entities/Clientes';
import { Variantes } from 'src/entities/Variantes';
import { UsuariosZonas } from 'src/entities/UsuariosZonas';
import { Posiciones } from 'src/entities/Posiciones';
import { Vehiculos } from 'src/entities/Vehiculos';
import { Instalaciones } from 'src/entities/Instalaciones';
import { Validadores } from 'src/entities/Validadores';
import { Operadores } from 'src/entities/Operadores';
import { Usuarios } from 'src/entities/Usuarios';
import { Turnos } from 'src/entities/Turnos';
import { Viajes } from 'src/entities/Viajes';
import { Repository } from 'typeorm';
import { RecorridoMonitoreoDto } from './dto/recorrido-monitoreo.dto';

@Injectable()
export class MonitoreoService {
  constructor(
    @InjectRepository(UsuariosZonas)
    private readonly usuarioszonasRepository: Repository<UsuariosZonas>,
    @InjectRepository(Variantes)
    private readonly variantesRepository: Repository<Variantes>,
    @InjectRepository(Clientes)
    private readonly clienteRepository: Repository<Clientes>,
    @InjectRepository(Posiciones)
    private readonly posicionesRepository: Repository<Posiciones>,
    @InjectRepository(Vehiculos)
    private readonly vehiculosRepository: Repository<Vehiculos>,
    @InjectRepository(Instalaciones)
    private readonly instalacionesRepository: Repository<Instalaciones>,
    @InjectRepository(Validadores)
    private readonly validadoresRepository: Repository<Validadores>,
    @InjectRepository(Operadores)
    private readonly operadoresRepository: Repository<Operadores>,
    @InjectRepository(Usuarios)
    private readonly usuariosRepository: Repository<Usuarios>,
    @InjectRepository(Turnos)
    private readonly turnosRepository: Repository<Turnos>,
    @InjectRepository(Viajes)
    private readonly viajesRepository: Repository<Viajes>,
  ) { }

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

  private async consultarVarianteListado(cliente: number) {
    const query = `
  SELECT 
    -- Datos del variante (datos principales)
    d.Id AS id,
    d.Nombre AS nombreVariante,
    d.PuntoInicio AS puntoInicio,
    d.PuntoFin AS puntoFin,
    d.RecorridoDetallado AS recorridoDetallado,
    d.DistanciaKm AS distanciaKm,
    d.FechaCreacion AS fechaCreacionVariante,
    d.Estatus AS estatusVariante,

    -- Cliente relacionado
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,
    c.Estatus AS estatusCliente

FROM Variantes d
INNER JOIN Rutas ru ON d.IdRuta = ru.Id
INNER JOIN Zonas r ON ru.IdZona = r.Id
LEFT JOIN Zonas rf ON ru.IdZonaFin = rf.Id
INNER JOIN Clientes c ON r.IdCliente = c.Id

WHERE c.Id IN (${cliente})   -- 🔹 aquí colocas el ID del cliente que quieres consultar
  AND c.Estatus = 1
  AND ru.Estatus = 1         -- Solo rutas activas
  AND r.Estatus = 1          -- Solo zonas activas
  AND d.Estatus = 1

ORDER BY d.Id DESC;
    `;
    return this.usuarioszonasRepository.query(query, [cliente]);
  }

  // ========================================
  // 🔹 OBTENER EL MAPA DE MONITOREO
  // ========================================
  async monitoreoListado(idUser: number, cliente: number, rol: number) {
    try {
      let data;
      let ultimaPosicion;
      switch (rol) {
        case 1:
          // Consulta de datos paginados Usuario SuperAdministrador
          data = await this.usuarioszonasRepository.query(
            `
  SELECT 
    -- Datos del variante (datos principales)
    d.Id AS id,
    d.Nombre AS nombreVariante,
    d.PuntoInicio AS puntoInicio,
    d.PuntoFin AS puntoFin,
    d.RecorridoInterpolar AS recorridoInterpolar,
    d.DistanciaKm AS distanciaKm,
    d.Estatus AS estatusVariante,

    -- Cliente relacionado
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,
    c.Estatus AS estatusCliente

FROM Variantes d
INNER JOIN Rutas ru ON d.IdRuta = ru.Id
INNER JOIN Zonas r ON ru.IdZona = r.Id
LEFT JOIN Zonas rf ON ru.IdZonaFin = rf.Id
INNER JOIN Clientes c ON r.IdCliente = c.Id

WHERE ru.Estatus = 1         -- Solo rutas activas
  AND r.Estatus = 1          -- Solo zonas activas
  AND d.Estatus = 1
  AND c.Estatus = 1

ORDER BY d.Id DESC;
      `,
          );
          break;

        case 2:
        case 3:
        case 8:
        case 9:
        case 10:
        case 11:
        case 13:
          // Consulta de datos Usuarios 
          data = await this.consultarVarianteListado(cliente);
          ultimaPosicion = await this.ultimaPosicion(cliente)
          break;

        default:
          // Consulta de datos Usuarios con permiso
          const { ids, placeholders } = await this.clienteHijos(cliente);
          data = await this.usuarioszonasRepository.query(
            `
      SELECT 
  -- Datos del variante (datos principales)
  d.Id AS id,
  d.Nombre AS nombreVariante,
  d.PuntoInicio AS puntoInicio,
  d.PuntoFin AS puntoFin,
  d.RecorridoDetallado AS recorridoDetallado,
  d.DistanciaKm AS distanciaKm,
  d.Estatus AS estatusVariante,

  -- Cliente relacionado
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM Variantes d
INNER JOIN Rutas ru ON d.IdRuta = ru.Id
INNER JOIN Zonas r ON ru.IdZona = r.Id
LEFT JOIN Zonas rf ON ru.IdZonaFin = rf.Id
INNER JOIN Clientes c ON r.IdCliente = c.Id
INNER JOIN UsuariosZonas ur ON ur.IdZona = r.Id

WHERE ur.IdUsuario = ?
  AND ur.Estatus = 1
  AND r.Estatus = 1
  AND ru.Estatus = 1
  AND d.Estatus = 1
  AND c.Estatus = 1
   AND c.Id IN (${cliente})   -- 🔹 aquí colocas el ID del cliente que quieres consultar

ORDER BY d.Id DESC;
      `,
            [idUser], // parámetro seguro
          );
          ultimaPosicion = await this.ultimaPosicion(cliente)
          break;
      }

      const variantes = data.map((item) => ({
        ...item,
        id: Number(item.id),
        idCliente: Number(item.idCliente),
        distanciaKm: Number(item.distanciaKm),
      }));

      const posicion = ultimaPosicion.map(item => ({
        ...item,
        id: Number(item.id),
        idDispositivo: Number(item.idDispositivo),
        idContador: Number(item.idContador),
        idVehiculo: Number(item.idVehiculo),
      }));

      // Transformación de resultados
      const result: ApiResponseCommon = {
        data: variantes,
      };

      return { variantes, posicion };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        message: 'Error al obtener listado variantes',
        error: error.message,
      });
    }
  }

  private async ultimaPosicion(cliente: number) {
    const query = `
SELECT
    up.Id AS id,
    up.Exactitud AS exactitud,
    up.Estado AS estado,
    up.Velocidad AS velocidad,
    up.Direccion AS direccion,
    up.Latitud AS latitud,
    up.Longitud AS longitud,
    up.FechaHora AS fechaHora,
    up.FHRegistro AS fhRegistro,
    up.NumeroSerieValidador AS numeroSerieValidador,
    
    -- Validador
  d.Id AS idDispositivo,
  d.NumeroSerie AS numeroSerieValidador,
  d.Marca AS marcaValidador,
  d.Modelo AS modeloValidador,

  -- Contador
  i.IdContador AS idContador,
  c.NumeroSerie AS numeroSerieContador,
  c.Marca AS marcaContador,
  c.Modelo AS modeloContador,
  
  -- Vehículo
  i.IdVehiculo AS idVehiculo,
  v.Marca AS marcaVehiculo,
  v.Modelo AS modeloVehiculo,
  v.Placa AS placaVehiculo,
  v.NumeroEconomico AS numeroEconomicoVehiculo,
  v.Foto AS foto,

    CONCAT(
        c.Nombre,
        IFNULL(CONCAT(' ', c.ApellidoPaterno), ''),
        IFNULL(CONCAT(' ', c.ApellidoMaterno), '')
    ) AS nombreCompletoCliente

FROM Instalaciones i
INNER JOIN Validadores d ON i.IdValidador = d.Id AND i.IdCliente = d.IdCliente
INNER JOIN Contadores c ON i.IdContador = c.Id AND i.IdCliente = c.IdCliente
INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
INNER JOIN Clientes c ON i.IdCliente = c.Id
INNER JOIN UltimaPosicion up ON d.NumeroSerie = up.NumeroSerieValidador
    
WHERE c.Id IN (${cliente})   -- 🔹 aquí colocas el/los ID(s) del cliente que quieres consultar
AND i.Estatus = 1  -- Solo instalaciones activas
AND c.Estatus = 1

ORDER BY up.Id DESC;

    `;
    return this.usuarioszonasRepository.query(query);
  }


  // ========================================
  // 🔹 OBTENER EL RECORRIDO DE UN DISPOSITIVO
  // ========================================
  async monitoreoRecorrido(recorridoMonitoreoDto: RecorridoMonitoreoDto, cliente: number, rol: number) {
    try {
      function pad(n: number) {
        return n < 10 ? '0' + n : n;
      }
      const ahora = new Date();
      const desfaseMs = -6 * 60 * 60 * 1000; // -6 horas
      const fechaDesfasada = new Date(ahora.getTime() + desfaseMs);
      // Solo la fecha del momento
      const fechaActual = `${fechaDesfasada.getFullYear()}-${pad(fechaDesfasada.getMonth() + 1)}-${pad(fechaDesfasada.getDate())}`;
      let recorridoMonitoreo;
      const { idCliente, NumeroSerieValidador } = recorridoMonitoreoDto
      recorridoMonitoreo = await this.usuarioszonasRepository.query(
        `
SELECT
  up.Id AS id,
    up.Exactitud AS exactitud,
    up.Estado AS estado,
    up.Velocidad AS velocidad,
    up.Direccion AS direccion,
    up.Latitud AS latitud,
    up.Longitud AS longitud,
    up.FechaHora AS fechaHora,
    up.FHRegistro AS fhRegistro,
    up.NumeroSerieValidador AS numeroSerieValidador,
    
    -- Dispositivo
  d.Id AS idDispositivo,
  d.NumeroSerie AS numeroSerieValidador,
  d.Marca AS marcaDispositivo,
  d.Modelo AS modeloDispositivo,

  -- Contador
  i.IdContador AS idContador,
  c.NumeroSerie AS numeroSerieContador,
  c.Marca AS marcaContador,
  c.Modelo AS modeloContador,
  
  -- Vehículo
  i.IdVehiculo AS idVehiculo,
  v.Marca AS marcaVehiculo,
  v.Modelo AS modeloVehiculo,
  v.Placa AS placaVehiculo,
  v.NumeroEconomico AS numeroEconomicoVehiculo,
  v.Foto AS foto,

    CONCAT(
        c.Nombre,
        IFNULL(CONCAT(' ', c.ApellidoPaterno), ''),
        IFNULL(CONCAT(' ', c.ApellidoMaterno), '')
    ) AS nombreCompletoCliente

FROM Instalaciones i
INNER JOIN Validadores d ON i.IdValidador = d.Id AND i.IdCliente = d.IdCliente
INNER JOIN Contadores c ON i.IdContador = c.Id AND i.IdCliente = c.IdCliente
INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
INNER JOIN Clientes c ON i.IdCliente = c.Id
INNER JOIN Posiciones up ON d.NumeroSerie = up.NumeroSerieValidador

WHERE c.Id IN (${idCliente})   -- 🔹 aquí colocas el/los ID(s) del cliente que quieres consultar
AND up.FechaHora >= '${fechaActual}T00:00:00Z'
AND up.FechaHora < '${fechaActual}T23:59:59Z'
AND up.NumeroSerieValidador = '${NumeroSerieValidador}'
  

ORDER BY i.Id DESC
      `,
      );

      const posicion = recorridoMonitoreo.map(item => ({
        ...item,
        id: Number(item.id),
        idDispositivo: Number(item.idDispositivo),
        idContador: Number(item.idContador),
        idVehiculo: Number(item.idVehiculo),
      }));



      // Transformación de resultados
      const result: ApiResponseCommon = {
        data: posicion,
      };

      return { posicion };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        message: 'Error al obtener listado variantes',
        error: error.message,
      });
    }
  }

  // ========================================
  // 🔹 OBTENER UNIDADES DE MONITOREO
  // ========================================
  async obtenerUnidades(cliente: number) {
    try {
      const { ids, placeholders } = await this.clienteHijos(cliente);

      // Consulta para obtener la última posición de cada validador y datos relacionados
      const query = `
SELECT
  -- Vehículo
  v.Id AS idVehiculo,
  v.Placa AS placa,
  v.Modelo AS modelo,
  
  -- Última posición
  p.Id AS idPosicion,
  p.Latitud AS latitud,
  p.Longitud AS longitud,
  p.Velocidad AS velocidad,
  p.FechaHora AS fechaHora,
  p.Estado AS estado,
  
  -- Validador
  val.NumeroSerie AS numeroSerieValidador,
  
  -- Operador/Conductor (del turno activo más reciente)
  CONCAT(
    IFNULL(u.Nombre, ''),
    IFNULL(CONCAT(' ', u.ApellidoPaterno), ''),
    IFNULL(CONCAT(' ', u.ApellidoMaterno), '')
  ) AS conductor,
  
  -- Instalación
  i.Id AS idInstalacion,
  
  -- Turno activo
  t_activo.Id AS idTurno,
  t_activo.Estatus AS turnoEstatus,
  t_activo.Inicio AS turnoInicio,
  t_activo.Fin AS turnoFin,
  
  -- Viaje activo
  viaje.Id AS idViaje,
  viaje.Estatus AS viajeEstatus,
  viaje.Inicio AS viajeInicio,
  viaje.Fin AS viajeFin,
  
  -- Variante del viaje
  var.Id AS idVariante,
  var.Nombre AS nombreVariante,
  
  -- Sumatorias de ConteoPasajeros por idViaje
  COALESCE(SUM(cp.Entradas), 0) AS sumSubidas,
  COALESCE(SUM(cp.Salidas), 0) AS sumBajadas,
  COALESCE(SUM(cp.Entradas), 0) - COALESCE(SUM(cp.Salidas), 0) AS diferencia

FROM Instalaciones i
INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
INNER JOIN Validadores val ON i.IdValidador = val.Id AND i.IdCliente = val.IdCliente
INNER JOIN Clientes c ON i.IdCliente = c.Id

-- Última posición del validador
INNER JOIN (
  SELECT 
    p1.NumeroSerieValidador,
    p1.Id,
    p1.Latitud,
    p1.Longitud,
    p1.Velocidad,
    p1.FechaHora,
    p1.Estado
  FROM Posiciones p1
  INNER JOIN (
    SELECT 
      NumeroSerieValidador,
      MAX(FechaHora) AS MaxFechaHora
    FROM Posiciones
    GROUP BY NumeroSerieValidador
  ) p2 ON p1.NumeroSerieValidador = p2.NumeroSerieValidador 
    AND p1.FechaHora = p2.MaxFechaHora
) p ON val.NumeroSerie = p.NumeroSerieValidador

-- Turno activo más reciente (estatus = 1)
LEFT JOIN (
  SELECT 
    t1.Id,
    t1.IdInstalacion,
    t1.IdOperador,
    t1.Estatus,
    t1.Inicio,
    t1.Fin
  FROM Turnos t1
  WHERE t1.Estatus = 1
    AND t1.Fin IS NULL
    AND t1.Inicio = (
      SELECT MAX(t2.Inicio)
      FROM Turnos t2
      WHERE t2.IdInstalacion = t1.IdInstalacion
        AND t2.Estatus = 1
        AND t2.Fin IS NULL
    )
) t_activo ON i.Id = t_activo.IdInstalacion

-- Viaje activo del turno (si existe)
LEFT JOIN (
  SELECT 
    v1.Id,
    v1.IdTurno,
    v1.IdVariante,
    v1.Estatus,
    v1.Inicio,
    v1.Fin
  FROM Viajes v1
  WHERE v1.Estatus = 1
    AND v1.Fin IS NULL
    AND v1.Inicio = (
      SELECT MAX(v2.Inicio)
      FROM Viajes v2
      WHERE v2.IdTurno = v1.IdTurno
        AND v2.Estatus = 1
        AND v2.Fin IS NULL
    )
) viaje ON t_activo.Id = viaje.IdTurno

-- Variante del viaje
LEFT JOIN Variantes var ON viaje.IdVariante = var.Id

-- Operador del turno
LEFT JOIN Operadores o ON t_activo.IdOperador = o.Id
LEFT JOIN Usuarios u ON o.IdUsuario = u.Id

-- Conteo de pasajeros por viaje
LEFT JOIN ConteoPasajeros cp ON viaje.Id = cp.IdViaje AND cp.Estatus = 1

WHERE c.Id IN (${placeholders})
  AND i.Estatus = 1
  AND v.Estatus = 1
  AND val.Estatus = 1

GROUP BY 
  v.Id, v.Placa, v.Modelo,
  p.Id, p.Latitud, p.Longitud, p.Velocidad, p.FechaHora, p.Estado,
  val.NumeroSerie,
  u.Nombre, u.ApellidoPaterno, u.ApellidoMaterno,
  i.Id,
  t_activo.Id, t_activo.Estatus, t_activo.Inicio, t_activo.Fin,
  viaje.Id, viaje.Estatus, viaje.Inicio, viaje.Fin,
  var.Id, var.Nombre

ORDER BY v.Id ASC;
      `;

      const resultados = await this.clienteRepository.query(query, [...ids]);

      // Formatear la respuesta según la estructura UnidadMapa
      const unidades = resultados.map((item) => {
        // Formatear fechaHora a formato HH:mm
        const fechaHora = item.fechaHora ? new Date(item.fechaHora) : null;
        const ultimoPing = fechaHora 
          ? `${String(fechaHora.getHours()).padStart(2, '0')}:${String(fechaHora.getMinutes()).padStart(2, '0')}`
          : null;

        // Determinar estado basado en turno, viaje y posición
        let estado = 'pausa'; // Por defecto
        const tieneTurno = item.idTurno && item.turnoEstatus === 1;
        const tieneViaje = item.idViaje && item.viajeEstatus === 1;
        
        if (tieneViaje) {
          // Si está en viaje, está en ruta
          estado = 'ruta';
        } else if (tieneTurno) {
          // Si tiene turno pero no viaje, está en pausa
          estado = 'pausa';
        } else {
          // Si no tiene turno, está disponible o fuera de servicio
          estado = 'pausa';
        }

        // Formatear velocidad
        const velocidad = item.velocidad 
          ? `${Math.round(item.velocidad)} km/h`
          : '0 km/h';

        const unidad: any = {
          id: Number(item.idVehiculo),
          codigo: item.placa || `U-${String(item.idVehiculo).padStart(3, '0')}`,
          modelo: item.modelo || '',
          conductor: item.conductor || 'Sin asignar',
          ultimoPing: ultimoPing || '--:--',
          velocidad: velocidad,
          estado: estado,
          posicion: {
            lat: Number(item.latitud) || 0,
            lng: Number(item.longitud) || 0,
          },
          // Información de turno, viaje y variante
          idInstalacion: item.idInstalacion ? Number(item.idInstalacion) : null,
          idTurno: item.idTurno ? Number(item.idTurno) : null,
          turnoEstatus: item.turnoEstatus ? Number(item.turnoEstatus) : null,
          turnoInicio: item.turnoInicio || null,
          turnoFin: item.turnoFin || null,
          idViaje: item.idViaje ? Number(item.idViaje) : null,
          viajeEstatus: item.viajeEstatus ? Number(item.viajeEstatus) : null,
          viajeInicio: item.viajeInicio || null,
          viajeFin: item.viajeFin || null,
          idVariante: item.idVariante ? Number(item.idVariante) : null,
          nombreVariante: item.nombreVariante || null,
          sumSubidas: item.sumSubidas ? Number(item.sumSubidas) : 0,
          sumBajadas: item.sumBajadas ? Number(item.sumBajadas) : 0,
          diferencia: item.diferencia ? Number(item.diferencia) : 0,
        };

        return unidad;
      });

      const result: ApiResponseCommon = {
        data: unidades,
      };

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtener las unidades de monitoreo.',
        error: error.message,
      });
    }
  }
}
