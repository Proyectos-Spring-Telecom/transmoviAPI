import {
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiResponseCommon } from 'src/common/ApiResponse';
import { Derroteros } from 'src/entities/Derroteros';
import { UsuariosRegiones } from 'src/entities/UsuariosRegiones';
import { Repository } from 'typeorm';
import { RecorridoMonitoreoDto } from './dto/recorrido-monitoreo.dto';
import { ClientesJerarquiaService } from 'src/clientes-jerarquia/clientes-jerarquia.service';

@Injectable()
export class MonitoreoService {
  constructor(
    @InjectRepository(UsuariosRegiones)
    private readonly usuariosregionesRepository: Repository<UsuariosRegiones>,
    @InjectRepository(Derroteros)
    private readonly derroterosRepository: Repository<Derroteros>,
    private readonly clientesJerarquia: ClientesJerarquiaService,
  ) {}

  private parseBlueVoxs(raw: any): any[] {
    if (raw == null) return [];
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return [];
    return arr.map((b: any) => ({
      ...b,
      idBlueVox: b.idBlueVox != null ? Number(b.idBlueVox) : null,
    }));
  }

  private async consultarDerroteroListadoRoot() {
    const query = `
SELECT
  d.Id AS id,
  d.Nombre AS nombreDerrotero,
  d.PuntoInicio AS puntoInicio,
  d.PuntoFin AS puntoFin,
  d.RecorridoDetallado AS recorridoDetallado,
  d.DistanciaKm AS distanciaKm,
  d.FechaCreacion AS fechaCreacionDerrotero,
  d.Estatus AS estatusDerrotero,
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
WHERE c.Estatus = 1
  AND ru.Estatus = 1
  AND r.Estatus = 1
  AND d.Estatus = 1
ORDER BY d.Id DESC
    `;
    return this.usuariosregionesRepository.query(query);
  }

  private async consultarDerroteroListado(cliente: number) {
    const query = `
SELECT
  d.Id AS id,
  d.Nombre AS nombreDerrotero,
  d.PuntoInicio AS puntoInicio,
  d.PuntoFin AS puntoFin,
  d.RecorridoDetallado AS recorridoDetallado,
  d.DistanciaKm AS distanciaKm,
  d.FechaCreacion AS fechaCreacionDerrotero,
  d.Estatus AS estatusDerrotero,
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
WHERE c.Id = ?
  AND c.Estatus = 1
  AND ru.Estatus = 1
  AND r.Estatus = 1
  AND d.Estatus = 1
ORDER BY d.Id DESC
    `;
    return this.usuariosregionesRepository.query(query, [cliente]);
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
          derroterosList = await this.consultarDerroteroListadoRoot();
          ultimaPosicion = await this.ultimaPosicionRoot();
          break;
        case 3:
        case 8:
        case 9:
        case 10:
        case 11:
          derroterosList = await this.consultarDerroteroListado(cliente);
          ultimaPosicion = await this.ultimaPosicion(cliente);
          break;

        default: {
          const hijos = await this.clientesJerarquia.obtenerJerarquia(cliente);
          if (hijos.ids.length === 0) {
            derroterosList = [];
            ultimaPosicion = [];
            break;
          }
          const { ids, placeholders } = hijos;
          derroterosList = await this.usuariosregionesRepository.query(
            `
SELECT
  d.Id AS id,
  d.Nombre AS nombreDerrotero,
  d.PuntoInicio AS puntoInicio,
  d.PuntoFin AS puntoFin,
  d.RecorridoDetallado AS recorridoDetallado,
  d.DistanciaKm AS distanciaKm,
  d.Estatus AS estatusDerrotero,
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
  AND c.Id IN (${placeholders})
ORDER BY d.Id DESC
            `,
            [idUser, ...ids],
          );
          ultimaPosicion = await this.ultimaPosicion(cliente);
          break;
        }
      }

      const derroteros = derroterosList.map((item) => ({
        ...item,
        id: Number(item.id),
        idCliente: Number(item.idCliente),
        distanciaKm: Number(item.distanciaKm),
      }));

      const posicion = ultimaPosicion.map((item: any) => ({
        ...item,
        id: item.id != null ? Number(item.id) : null,
        idDispositivo:
          item.idDispositivo != null ? Number(item.idDispositivo) : null,
        blueVoxs: this.parseBlueVoxs(item.blueVoxs),
        idVehiculo: item.idVehiculo != null ? Number(item.idVehiculo) : null,
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

  private async ultimaPosicionRoot() {
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
  d.Id AS idDispositivo,
  d.NumeroSerie AS numeroSerieDispositivo,
  d.Marca AS marcaDispositivo,
  d.Modelo AS modeloDispositivo,
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
      WHERE ibv.IdInstalacion = i.Id
        AND ibv.Estatus = 1
        AND bx.IdCliente = i.IdCliente
    ),
    JSON_ARRAY()
  ) AS blueVoxs,
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
LEFT JOIN InstalacionesDispositivos id_disp
  ON id_disp.IdInstalacion = i.Id
  AND id_disp.Estatus = 1
  AND id_disp.Principal = 1
LEFT JOIN Dispositivos d
  ON d.Id = id_disp.IdDispositivo
  AND d.IdCliente = i.IdCliente
INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
INNER JOIN Clientes c ON i.IdCliente = c.Id
LEFT JOIN UltimaPosicion up ON d.NumeroSerie = up.NumeroSerieDispositivo
WHERE i.Estatus = 1
  AND c.Estatus = 1
ORDER BY up.Id DESC
    `;
    return this.usuariosregionesRepository.query(query);
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
  d.Id AS idDispositivo,
  d.NumeroSerie AS numeroSerieDispositivo,
  d.Marca AS marcaDispositivo,
  d.Modelo AS modeloDispositivo,
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
      WHERE ibv.IdInstalacion = i.Id
        AND ibv.Estatus = 1
        AND bx.IdCliente = i.IdCliente
    ),
    JSON_ARRAY()
  ) AS blueVoxs,
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
LEFT JOIN InstalacionesDispositivos id_disp
  ON id_disp.IdInstalacion = i.Id
  AND id_disp.Estatus = 1
  AND id_disp.Principal = 1
LEFT JOIN Dispositivos d
  ON d.Id = id_disp.IdDispositivo
  AND d.IdCliente = i.IdCliente
INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
INNER JOIN Clientes c ON i.IdCliente = c.Id
LEFT JOIN UltimaPosicion up ON d.NumeroSerie = up.NumeroSerieDispositivo
WHERE c.Id = ?
  AND i.Estatus = 1
  AND c.Estatus = 1
ORDER BY up.Id DESC
    `;
    return this.usuariosregionesRepository.query(query, [cliente]);
  }

  // ========================================
  // 🔹 OBTENER EL RECORRIDO DE UN DISPOSITIVO
  // ========================================
  async monitoreoRecorrido(
    recorridoMonitoreoDto: RecorridoMonitoreoDto,
    cliente: number,
    rol: number,
  ) {
    try {
      function pad(n: number) {
        return n < 10 ? '0' + n : n;
      }
      const ahora = new Date();
      const desfaseMs = -6 * 60 * 60 * 1000; // -6 horas
      const fechaDesfasada = new Date(ahora.getTime() + desfaseMs);
      const fechaActual = `${fechaDesfasada.getFullYear()}-${pad(fechaDesfasada.getMonth() + 1)}-${pad(fechaDesfasada.getDate())}`;

      const { idCliente, NumeroSerieDispositivo } = recorridoMonitoreoDto;

      let fechaInicio: string;
      let fechaFin: string;
      if (
        recorridoMonitoreoDto.fechaInicio == null &&
        recorridoMonitoreoDto.fechaFin == null
      ) {
        fechaInicio = fechaActual;
        fechaFin = fechaActual;
      } else {
        fechaInicio =
          recorridoMonitoreoDto.fechaInicio?.split('T')[0] ?? fechaActual;
        fechaFin = recorridoMonitoreoDto.fechaFin?.split('T')[0] ?? fechaActual;
      }

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
  d.Id AS idDispositivo,
  d.NumeroSerie AS numeroSerieDispositivo,
  d.Marca AS marcaDispositivo,
  d.Modelo AS modeloDispositivo,
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
      WHERE ibv.IdInstalacion = i.Id
        AND ibv.Estatus = 1
        AND bx.IdCliente = i.IdCliente
    ),
    JSON_ARRAY()
  ) AS blueVoxs,
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
INNER JOIN InstalacionesDispositivos id_disp
  ON id_disp.IdInstalacion = i.Id
  AND id_disp.Estatus = 1
  AND id_disp.Principal = 1
INNER JOIN Dispositivos d
  ON d.Id = id_disp.IdDispositivo
  AND d.IdCliente = i.IdCliente
INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente
INNER JOIN Clientes c ON i.IdCliente = c.Id
INNER JOIN Posiciones up ON d.NumeroSerie = up.NumeroSerieDispositivo
WHERE c.Id = ?
  AND up.FechaHora >= '${fechaInicio}T00:00:00Z'
  AND up.FechaHora < '${fechaFin}T23:59:59Z'
  AND up.NumeroSerieDispositivo = ?
ORDER BY up.FechaHora ASC
      `;

      const recorridoMonitoreo = await this.usuariosregionesRepository.query(
        query,
        [idCliente, NumeroSerieDispositivo],
      );

      const posicion = recorridoMonitoreo.map((item: any) => ({
        ...item,
        id: Number(item.id),
        idDispositivo: Number(item.idDispositivo),
        blueVoxs: this.parseBlueVoxs(item.blueVoxs),
        idVehiculo: item.idVehiculo != null ? Number(item.idVehiculo) : null,
      }));

      // Transformación de resultados
      const result: ApiResponseCommon = {
        data: posicion,
      };

      return { posicion };
    } catch (error) {
      console.log(error);
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        message: 'Error al obtener recorrido de monitoreo',
        error: error.message,
      });
    }
  }
}
