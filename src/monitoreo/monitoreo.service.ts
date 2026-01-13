import {
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiResponseCommon } from 'src/common/ApiResponse';
import { Clientes } from 'src/entities/Clientes';
import { Derroteros } from 'src/entities/Derroteros';
import { UsuariosRegiones } from 'src/entities/UsuariosRegiones';
import { Repository } from 'typeorm';
import { RecorridoMonitoreoDto } from './dto/recorrido-monitoreo.dto';

@Injectable()
export class MonitoreoService {
  constructor(
    @InjectRepository(UsuariosRegiones)
    private readonly usuariosregionesRepository: Repository<UsuariosRegiones>,
    @InjectRepository(Derroteros)
    private readonly derroterosRepository: Repository<Derroteros>,
    @InjectRepository(Clientes)
    private readonly clienteRepository: Repository<Clientes>,
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

  private async consultarDerroteroListado(cliente: number) {
    const query = `
  SELECT 
    -- Datos del derrotero (datos principales)
    d.Id AS id,
    d.Nombre AS nombreDerrotero,
    d.PuntoInicio AS puntoInicio,
    d.PuntoFin AS puntoFin,
    d.RecorridoDetallado AS recorridoDetallado,
    d.DistanciaKm AS distanciaKm,
    d.FechaCreacion AS fechaCreacionDerrotero,
    d.Estatus AS estatusDerrotero,

    -- Cliente relacionado
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,
    c.Estatus AS estatusCliente

FROM Derroteros d
INNER JOIN Rutas ru ON d.IdRuta = ru.Id
INNER JOIN Regiones r ON ru.IdRegion = r.Id
LEFT JOIN Regiones rf ON ru.IdRegionFin = rf.Id
INNER JOIN Clientes c ON r.IdCliente = c.Id

WHERE c.Id IN (${cliente})   -- 🔹 aquí colocas el ID del cliente que quieres consultar
  AND c.Estatus = 1
  AND ru.Estatus = 1         -- Solo rutas activas
  AND r.Estatus = 1          -- Solo regiones activas
  AND d.Estatus = 1

ORDER BY d.Id DESC;
    `;
    return this.usuariosregionesRepository.query(query);
  }

  // ========================================
  // 🔹 OBTENER EL MAPA DE MONITOREO
  // ========================================
  async monitoreoListado(idUser: number, cliente: number, rol: number) {
    try {
      let derroterosList;
      let ultimaPosicion;
      switch (rol) {
        case 1:
        case 2:
        case 3:
        case 8:
        case 9:
        case 10:
        case 11:
        case 13:
          // Consulta de datos Usuarios 
          derroterosList = await this.consultarDerroteroListado(cliente);
          ultimaPosicion = await this.ultimaPosicion(cliente)
          break;

        default:
          // Consulta de datos Usuarios con permiso
          const { ids, placeholders } = await this.clienteHijos(cliente);
          derroterosList = await this.usuariosregionesRepository.query(
            `
      SELECT 
  -- Datos del derrotero (datos principales)
  d.Id AS id,
  d.Nombre AS nombreDerrotero,
  d.PuntoInicio AS puntoInicio,
  d.PuntoFin AS puntoFin,
  d.RecorridoDetallado AS recorridoDetallado,
  d.DistanciaKm AS distanciaKm,
  d.Estatus AS estatusDerrotero,

  -- Cliente relacionado
  c.Id AS idCliente,
  c.Nombre AS nombreCliente,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente

FROM Derroteros d
INNER JOIN Rutas ru ON d.IdRuta = ru.Id
INNER JOIN Regiones r ON ru.IdRegion = r.Id
LEFT JOIN Regiones rf ON ru.IdRegionFin = rf.Id
INNER JOIN Clientes c ON r.IdCliente = c.Id
INNER JOIN UsuariosRegiones ur ON ur.IdRegion = r.Id

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

      const derroteros = derroterosList.map((item) => ({
        ...item,
        id: Number(item.id),
        idCliente: Number(item.idCliente),
        distanciaKm: Number(item.distanciaKm),
      }));

      const posicion = ultimaPosicion.map(item => ({
        ...item,
        id: Number(item.id),
        idDispositivo: Number(item.idDispositivo),
        idBlueVox: Number(item.idBlueVox),
        idVehiculo: Number(item.idVehiculo),
      }));

      // Transformación de resultados
      const result: ApiResponseCommon = {
        data: derroteros + posicion,
      };

      return { derroteros, posicion };
    } catch (error) {
      console.log(error);
      //console.log(error)
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        message: 'Error al obtener listado derroteros',
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
    up.NumeroSerieDispositivo AS numeroSerieDispositivo,
    
    -- Dispositivo
  d.Id AS idDispositivo,
  d.NumeroSerie AS numeroSerieDispositivo,
  d.Marca AS marcaDispositivo,
  d.Modelo AS modeloDispositivo,

  -- BlueVox
  i.IdBlueVox AS idBlueVox,
  b.NumeroSerie AS numeroSerieBlueVox,
  b.Marca AS marcaBlueVox,
  b.Modelo AS modeloBlueVox,
  
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
INNER JOIN Dispositivos d ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
INNER JOIN BlueVoxs b ON i.IdBlueVox = b.Id AND i.IdCliente = b.IdCliente
INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
INNER JOIN Clientes c ON i.IdCliente = c.Id
INNER JOIN UltimaPosicion up ON d.NumeroSerie = up.NumeroSerieDispositivo
    
WHERE c.Id IN (${cliente})   -- 🔹 aquí colocas el/los ID(s) del cliente que quieres consultar
AND i.Estatus = 1  -- Solo instalaciones activas
AND c.Estatus = 1

ORDER BY up.Id DESC;

    `;
    return this.usuariosregionesRepository.query(query);
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
      const { idCliente, NumeroSerieDispositivo } = recorridoMonitoreoDto
      recorridoMonitoreo = await this.usuariosregionesRepository.query(
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
    up.NumeroSerieDispositivo AS numeroSerieDispositivo,
    
    -- Dispositivo
  d.Id AS idDispositivo,
  d.NumeroSerie AS numeroSerieDispositivo,
  d.Marca AS marcaDispositivo,
  d.Modelo AS modeloDispositivo,

  -- BlueVox
  i.IdBlueVox AS idBlueVox,
  b.NumeroSerie AS numeroSerieBlueVox,
  b.Marca AS marcaBlueVox,
  b.Modelo AS modeloBlueVox,
  
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
INNER JOIN Dispositivos d ON i.IdDispositivo = d.Id AND i.IdCliente = d.IdCliente
INNER JOIN BlueVoxs b ON i.IdBlueVox = b.Id AND i.IdCliente = b.IdCliente
INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
INNER JOIN Clientes c ON i.IdCliente = c.Id
INNER JOIN Posiciones up ON d.NumeroSerie = up.NumeroSerieDispositivo

WHERE c.Id IN (${idCliente})   -- 🔹 aquí colocas el/los ID(s) del cliente que quieres consultar
AND up.FechaHora >= '${fechaActual}T00:00:00Z'
AND up.FechaHora < '${fechaActual}T23:59:59Z'
AND up.NumeroSerieDispositivo = '${NumeroSerieDispositivo}'
  

ORDER BY i.Id DESC
      `,
      );

      const posicion = recorridoMonitoreo.map(item => ({
        ...item,
        id: Number(item.id),
        idDispositivo: Number(item.idDispositivo),
        idBlueVox: Number(item.idBlueVox),
        idVehiculo: Number(item.idVehiculo),
      }));



      // Transformación de resultados
      const result: ApiResponseCommon = {
        data: posicion,
      };

      return { posicion };
    } catch (error) {
      console.log(error);
      console.log(error)
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        message: 'Error al obtener listado derroteros',
        error: error.message,
      });
    }
  }
}
