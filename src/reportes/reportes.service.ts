import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clientes } from 'src/entities/Clientes';
import { RecaudacionDiariaRutaDto } from './dto/recaudacion-diaria-ruta.dto';
import { RecaudacionPorOperadorDto } from './dto/recaudacion-por-operador.dto';
import { RecaudacionPorVehiculoDto } from './dto/recaudacion-por-vehiculo.dto';
import { RecaudacionPorDispositivoDto } from './dto/recaudacion-por-dispositivo.dto';
import { ApiResponseCommon } from 'src/common/ApiResponse';

@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(Clientes)
    private readonly clienteRepository: Repository<Clientes>,
  ) {}

  private async clienteHijos(cliente: number) {
    const clientesFiltrado = await this.clienteRepository.query(
      `CALL spGetClientes(?);`,
      [cliente],
    );

    const idsFiltrados = clientesFiltrado[0];
    const ids = idsFiltrados
      .map((clientesFiltrado: any) => Number(clientesFiltrado.Id))
      .filter(Boolean);
    if (ids.length === 0) {
      return { ids: [], placeholders: '' };
    }

    const placeholders = ids.map(() => '?').join(', ');
    return { ids, placeholders };
  }

  async recaudacionDiariaPorRuta(
    filtros: RecaudacionDiariaRutaDto,
    cliente: number,
  ): Promise<ApiResponseCommon> {
    try {
      // Obtener jerarquía de clientes
      const { ids: clienteIds, placeholders } = await this.clienteHijos(cliente);

      console.log('clienteIds', clienteIds);
      if (clienteIds.length === 0) {
        return {
          data: [],
        };
      }

      // Construir condiciones WHERE (HistoricoTransaccionesDebito + Monederos + ruta vía Viajes)
      const condiciones: string[] = [];
      const parametros: any[] = [];

      // Filtro de clientes a través de Monederos
      condiciones.push(`m.IdCliente IN (${placeholders})`);
      parametros.push(...clienteIds);

      // Filtro de fecha — FHRegistro en HistoricoTransaccionesDebito
      if (filtros.fechaInicio) {
        const fechaInicio = filtros.fechaInicio.split('T')[0];
        condiciones.push(`DATE(htd.FHRegistro) >= ?`);
        parametros.push(fechaInicio);
      }
      if (filtros.fechaFin) {
        const fechaFin = filtros.fechaFin.split('T')[0];
        condiciones.push(`DATE(htd.FHRegistro) <= ?`);
        parametros.push(fechaFin);
      }

      // Filtro de región
      if (filtros.idRegion) {
        condiciones.push(`reg.Id = ?`);
        parametros.push(filtros.idRegion);
      }

      // Filtro de ruta
      if (filtros.idRuta) {
        condiciones.push(`r.Id = ?`);
        parametros.push(filtros.idRuta);
      }

      // Filtro de derrotero
      if (filtros.idDerrotero) {
        condiciones.push(`d.Id = ?`);
        parametros.push(filtros.idDerrotero);
      }

      const whereClause = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

      const query = `
SELECT
    DATE(htd.FHRegistro) AS fecha,
    reg.Id AS idRegion,
    reg.Nombre AS nombreRegion,
    r.Id AS idRuta,
    r.Nombre AS nombreRuta,
    d.Id AS idDerrotero,
    d.Nombre AS nombreDerrotero,
    COUNT(DISTINCT v.Id) AS viajes,
    COUNT(DISTINCT htd.Id) AS validaciones,
    COALESCE(SUM(htd.Monto), 0) AS ingresos,
    CASE 
        WHEN COUNT(DISTINCT htd.Id) > 0 
        THEN COALESCE(SUM(htd.Monto), 0) / COUNT(DISTINCT htd.Id)
        ELSE 0 
    END AS ticketPromedio,
    CASE 
        WHEN COUNT(DISTINCT htd.Id) > 0
        THEN (COUNT(DISTINCT CASE WHEN htd.IdControlTransaccion = 1 THEN htd.Id END) * 100.0) / COUNT(DISTINCT htd.Id)
        ELSE 0
    END AS porcentajeElectronico,
    COALESCE(SUM(vc.Diferencia), 0) AS ascensos,
    GREATEST(COALESCE(SUM(vc.Diferencia), 0) - COUNT(DISTINCT htd.Id), 0) AS evasionAbsoluta,
    CASE 
        WHEN COALESCE(SUM(vc.Diferencia), 0) > 0
        THEN (GREATEST(COALESCE(SUM(vc.Diferencia), 0) - COUNT(DISTINCT htd.Id), 0) * 100.0) / COALESCE(SUM(vc.Diferencia), 0)
        ELSE 0
    END AS evasionPorcentual
FROM HistoricoTransaccionesDebito htd
INNER JOIN Monederos m ON htd.NumeroSerieMonedero = m.NumeroSerie
LEFT JOIN Viajes v ON htd.IdViajes = v.Id
LEFT JOIN Derroteros d ON v.IdDerrotero = d.Id
LEFT JOIN Rutas r ON d.IdRuta = r.Id
LEFT JOIN Regiones reg ON r.IdRegion = reg.Id
LEFT JOIN ConteoPasajeros vc ON vc.IdViaje = v.Id
${whereClause}
GROUP BY DATE(htd.FHRegistro), reg.Id, reg.Nombre, r.Id, r.Nombre, d.Id, d.Nombre
HAVING COUNT(DISTINCT htd.Id) > 0
ORDER BY DATE(htd.FHRegistro) DESC, reg.Nombre, r.Nombre, d.Nombre;
      `;

      console.log('=== DEBUG REPORTE RECAUDACIÓN DIARIA POR RUTA ===');
      console.log('Filtros recibidos:', filtros);
      console.log('Cliente IDs:', clienteIds);
      console.log('Parámetros:', parametros);
      
      const resultados = await this.clienteRepository.query(query, parametros);
      
      console.log('Resultados obtenidos:', resultados.length);
      console.log('=== FIN DEBUG ===');

      // Formatear resultados
      const data = resultados.map((row: any) => ({
        fecha: row.fecha || null,
        idRegion: row.idRegion ? Number(row.idRegion) : null,
        nombreRegion: row.nombreRegion || null,
        idRuta: row.idRuta ? Number(row.idRuta) : null,
        nombreRuta: row.nombreRuta || null,
        idDerrotero: row.idDerrotero ? Number(row.idDerrotero) : null,
        nombreDerrotero: row.nombreDerrotero || null,
        viajes: row.viajes ? Number(row.viajes) : 0,
        validaciones: row.validaciones ? Number(row.validaciones) : 0,
        ingresos: row.ingresos ? Number(parseFloat(String(row.ingresos)).toFixed(2)) : 0,
        ticketPromedio: row.ticketPromedio ? Number(parseFloat(String(row.ticketPromedio)).toFixed(2)) : 0,
        porcentajeElectronico: row.porcentajeElectronico ? Number(parseFloat(String(row.porcentajeElectronico)).toFixed(2)) : 0,
        ascensos: row.ascensos ? Number(row.ascensos) : 0,
        evasionAbsoluta: row.evasionAbsoluta !== null && row.evasionAbsoluta !== undefined ? Number(row.evasionAbsoluta) : 0,
        evasionPorcentual: row.evasionPorcentual ? Number(parseFloat(String(row.evasionPorcentual)).toFixed(2)) : 0,
      }));

      return {
        data,
      };
    } catch (error) {
      console.log(error);
      console.error('Error en recaudacionDiariaPorRuta:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al generar el reporte de recaudación diaria por ruta',
        error: error.message,
        stack: error.stack,
      });
    }
  }

  async recaudacionPorOperador(
    filtros: RecaudacionPorOperadorDto,
    cliente: number,
  ): Promise<ApiResponseCommon> {
    try {
      // Obtener jerarquía de clientes
      const { ids: clienteIds, placeholders } = await this.clienteHijos(cliente);
      
      if (clienteIds.length === 0) {
        return {
          data: [],
        };
      }

      // Preparar filtros de fecha — FHRegistro en HistoricoTransaccionesDebito
      const fechaInicio = filtros.fechaInicio ? filtros.fechaInicio.split('T')[0] : null;
      const fechaFin = filtros.fechaFin ? filtros.fechaFin.split('T')[0] : null;

      // HistoricoTransaccionesDebito → Viajes (IdViajes) → Operador; agrupado por día + operador
      // Turnos/viajes: mismos criterios de fecha (día calendario de Inicio) para alinear con datos
      const query = `
SELECT
    datos.fecha,
    datos.idOperador,
    datos.operador,
    datos.licencia,
    COALESCE(turnos_data.totalTurnos, 0) AS turnos,
    COALESCE(viajes_data.totalViajes, 0) AS viajes,
    datos.validaciones,
    datos.ingresos,
    datos.ticketPromedio,
    datos.evasionPorcentual,
    turnos_data.ultimoTurno AS ultimoTurno
FROM (
    SELECT
        DATE(htd.FHRegistro) AS fecha,
        COALESCE(o.Id, 0) AS idOperador,
        COALESCE(
            CONCAT(
                u.Nombre,
                ' ',
                u.ApellidoPaterno,
                IFNULL(CONCAT(' ', u.ApellidoMaterno), '')
            ),
            'Sin operador asignado'
        ) AS operador,
        GROUP_CONCAT(DISTINCT l.NumeroLicencia SEPARATOR ', ') AS licencia,
        COUNT(DISTINCT htd.Id) AS validaciones,
        COALESCE(SUM(htd.Monto), 0) AS ingresos,
        CASE 
            WHEN COUNT(DISTINCT htd.Id) > 0 
            THEN COALESCE(SUM(htd.Monto), 0) / COUNT(DISTINCT htd.Id)
            ELSE 0 
        END AS ticketPromedio,
        CASE 
            WHEN COALESCE(SUM(vc.Diferencia), 0) > 0
            THEN (GREATEST(COALESCE(SUM(vc.Diferencia), 0) - COUNT(DISTINCT htd.Id), 0) * 100.0) / COALESCE(SUM(vc.Diferencia), 0)
            ELSE 0
        END AS evasionPorcentual
    FROM HistoricoTransaccionesDebito htd
    INNER JOIN Monederos m ON htd.NumeroSerieMonedero = m.NumeroSerie
    LEFT JOIN Viajes v ON htd.IdViajes = v.Id
    LEFT JOIN Operadores o ON v.IdOperador = o.Id
    LEFT JOIN Usuarios u ON o.IdUsuario = u.Id
    LEFT JOIN Licencias l ON l.IdOperador = o.Id
    LEFT JOIN ConteoPasajeros vc ON vc.IdViaje = v.Id
    WHERE m.IdCliente IN (${placeholders})
    ${fechaInicio ? `AND DATE(htd.FHRegistro) >= ?` : ''}
    ${fechaFin ? `AND DATE(htd.FHRegistro) <= ?` : ''}
    ${filtros.idOperador ? 'AND (o.Id = ? OR o.Id IS NULL)' : ''}
    GROUP BY DATE(htd.FHRegistro), COALESCE(o.Id, 0), u.Nombre, u.ApellidoPaterno, u.ApellidoMaterno
) AS datos
LEFT JOIN (
    SELECT 
        DATE(t.Inicio) AS fecha,
        COALESCE(t.IdOperador, 0) AS IdOperador,
        COUNT(DISTINCT t.Id) AS totalTurnos,
        MAX(t.Inicio) AS ultimoTurno
    FROM Turnos t
    GROUP BY DATE(t.Inicio), COALESCE(t.IdOperador, 0)
) AS turnos_data ON turnos_data.IdOperador = datos.idOperador AND turnos_data.fecha = datos.fecha
LEFT JOIN (
    SELECT 
        DATE(v2.Inicio) AS fecha,
        COALESCE(v2.IdOperador, 0) AS IdOperador,
        COUNT(DISTINCT v2.Id) AS totalViajes
    FROM Viajes v2
    GROUP BY DATE(v2.Inicio), COALESCE(v2.IdOperador, 0)
) AS viajes_data ON viajes_data.IdOperador = datos.idOperador AND viajes_data.fecha = datos.fecha
ORDER BY datos.fecha DESC, datos.ingresos DESC, datos.operador ASC;
      `;

      // Construir parámetros para la consulta principal
      // Orden: clienteIds, fechas WHERE principal (histórico débito), idOperador
      const parametrosCompletos = [...clienteIds];
      
      // Parámetros de fecha para el WHERE principal (HistoricoTransaccionesDebito.FHRegistro)
      if (fechaInicio) {
        parametrosCompletos.push(fechaInicio);
      }
      if (fechaFin) {
        parametrosCompletos.push(fechaFin);
      }
      
      // Parámetro de operador si existe
      if (filtros.idOperador) {
        parametrosCompletos.push(filtros.idOperador);
      }

      console.log('=== DEBUG RECAUDACIÓN POR OPERADOR ===');
      console.log('Filtros:', filtros);
      console.log('Cliente IDs:', clienteIds);
      console.log('Parámetros completos:', parametrosCompletos);
      
      const resultados = await this.clienteRepository.query(query, parametrosCompletos);
      
      console.log('Resultados obtenidos:', resultados.length);
      console.log('=== FIN DEBUG ===');

      // Formatear resultados (una fila por día y operador según agrupación del query)
      const data = resultados.map((row: any) => {
        const idOperador = Number(row.idOperador);
        return {
          fecha: row.fecha || null,
          idOperador: idOperador === 0 ? null : idOperador,
          operador: row.operador || 'Sin operador asignado',
          licencia: row.licencia || null,
          turnos: Number(row.turnos) || 0,
          viajes: Number(row.viajes) || 0,
          validaciones: Number(row.validaciones) || 0,
          ingresos: Number(parseFloat(String(row.ingresos)).toFixed(2)) || 0,
          ticketPromedio: Number(parseFloat(String(row.ticketPromedio)).toFixed(2)) || 0,
          evasionPorcentual: Number(parseFloat(String(row.evasionPorcentual)).toFixed(2)) || 0,
          ultimoTurno: row.ultimoTurno || null,
        };
      });

      return {
        data,
      };
    } catch (error) {
      console.log(error);
      console.error('Error en recaudacionPorOperador:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al generar el reporte de recaudación por operador',
        error: error.message,
        stack: error.stack,
      });
    }
  }

  async recaudacionPorVehiculo(
    filtros: RecaudacionPorVehiculoDto,
    cliente: number,
  ): Promise<ApiResponseCommon> {
    try {
      // Obtener jerarquía de clientes
      const { ids: clienteIds, placeholders } = await this.clienteHijos(cliente);
      
      if (clienteIds.length === 0) {
        return {
          data: [],
        };
      }

      // Preparar filtros de fecha — FHRegistro en HistoricoTransaccionesDebito
      const fechaInicio = filtros.fechaInicio ? filtros.fechaInicio.split('T')[0] : null;
      const fechaFin = filtros.fechaFin ? filtros.fechaFin.split('T')[0] : null;

      // HistoricoTransaccionesDebito → Viajes (IdViajes) → Turnos → Instalaciones → Vehículo; ruta: Viajes → Derroteros → Rutas
      // Agrupación por día + vehículo; turnos/viajes alineados por DATE(Inicio) y mismo vehículo (vía instalación)
      const query = `
SELECT
    datos.fecha,
    datos.idVehiculo,
    datos.numeroEconomico,
    datos.placa,
    datos.marca,
    datos.modelo,
    datos.ano,
    COALESCE(turnos_data.totalTurnos, 0) AS turnos,
    COALESCE(viajes_data.totalViajes, 0) AS viajes,
    datos.validaciones,
    datos.ingresos,
    datos.ticketPromedio,
    COALESCE(turnos_data.horasServicio, 0) AS horasServicio
FROM (
    SELECT
        DATE(htd.FHRegistro) AS fecha,
        veh.Id AS idVehiculo,
        veh.NumeroEconomico AS numeroEconomico,
        veh.Placa AS placa,
        veh.Marca AS marca,
        veh.Modelo AS modelo,
        veh.Ano AS ano,
        COUNT(DISTINCT htd.Id) AS validaciones,
        COALESCE(SUM(htd.Monto), 0) AS ingresos,
        CASE 
            WHEN COUNT(DISTINCT htd.Id) > 0 
            THEN COALESCE(SUM(htd.Monto), 0) / COUNT(DISTINCT htd.Id)
            ELSE 0 
        END AS ticketPromedio
    FROM HistoricoTransaccionesDebito htd
    INNER JOIN Monederos m ON htd.NumeroSerieMonedero = m.NumeroSerie
    LEFT JOIN Viajes v ON htd.IdViajes = v.Id
    LEFT JOIN Turnos t ON v.IdTurno = t.Id
    LEFT JOIN Instalaciones ins ON t.IdInstalacion = ins.Id
    LEFT JOIN Vehiculos veh ON ins.IdVehiculo = veh.Id
    LEFT JOIN Derroteros d ON v.IdDerrotero = d.Id
    LEFT JOIN Rutas r ON d.IdRuta = r.Id
    WHERE m.IdCliente IN (${placeholders})
    ${fechaInicio ? `AND DATE(htd.FHRegistro) >= ?` : ''}
    ${fechaFin ? `AND DATE(htd.FHRegistro) <= ?` : ''}
    ${filtros.idVehiculo ? 'AND veh.Id = ?' : ''}
    ${filtros.idRuta ? 'AND r.Id = ?' : ''}
    GROUP BY DATE(htd.FHRegistro), veh.Id, veh.NumeroEconomico, veh.Placa, veh.Marca, veh.Modelo, veh.Ano
) AS datos
LEFT JOIN (
    SELECT 
        DATE(t2.Inicio) AS fecha,
        veh2.Id AS IdVehiculo,
        COUNT(DISTINCT t2.Id) AS totalTurnos,
        COALESCE(SUM(
            CASE 
                WHEN t2.Fin IS NOT NULL 
                THEN TIMESTAMPDIFF(HOUR, t2.Inicio, t2.Fin)
                ELSE 0
            END
        ), 0) AS horasServicio
    FROM Vehiculos veh2
    INNER JOIN Instalaciones ins2 ON ins2.IdVehiculo = veh2.Id
    INNER JOIN Turnos t2 ON t2.IdInstalacion = ins2.Id
    GROUP BY DATE(t2.Inicio), veh2.Id
) AS turnos_data ON turnos_data.IdVehiculo = datos.idVehiculo AND turnos_data.fecha = datos.fecha
LEFT JOIN (
    SELECT 
        DATE(v3.Inicio) AS fecha,
        veh3.Id AS IdVehiculo,
        COUNT(DISTINCT v3.Id) AS totalViajes
    FROM Vehiculos veh3
    INNER JOIN Instalaciones ins3 ON ins3.IdVehiculo = veh3.Id
    INNER JOIN Turnos t3 ON t3.IdInstalacion = ins3.Id
    INNER JOIN Viajes v3 ON v3.IdTurno = t3.Id
    GROUP BY DATE(v3.Inicio), veh3.Id
) AS viajes_data ON viajes_data.IdVehiculo = datos.idVehiculo AND viajes_data.fecha = datos.fecha
ORDER BY datos.fecha DESC, datos.ingresos DESC, datos.numeroEconomico ASC;
      `;

      // Construir parámetros para la consulta principal
      // Orden: clienteIds, fechas (HistoricoTransaccionesDebito), idVehiculo, idRuta
      const parametrosCompletos = [...clienteIds];
      
      // Parámetros de fecha (HistoricoTransaccionesDebito.FHRegistro)
      if (fechaInicio) {
        parametrosCompletos.push(fechaInicio);
      }
      if (fechaFin) {
        parametrosCompletos.push(fechaFin);
      }
      
      // Parámetro de vehículo si existe
      if (filtros.idVehiculo) {
        parametrosCompletos.push(filtros.idVehiculo);
      }
      
      // Parámetro de ruta si existe
      if (filtros.idRuta) {
        parametrosCompletos.push(filtros.idRuta);
      }

      console.log('=== DEBUG RECAUDACIÓN POR VEHÍCULO ===');
      console.log('Filtros:', filtros);
      console.log('Cliente IDs:', clienteIds);
      console.log('Parámetros completos:', parametrosCompletos);
      
      const resultados = await this.clienteRepository.query(query, parametrosCompletos);
      
      console.log('Resultados obtenidos:', resultados.length);
      console.log('=== FIN DEBUG ===');

      // Formatear resultados (una fila por día y vehículo)
      const data = resultados.map((row: any) => ({
        fecha: row.fecha || null,
        idVehiculo: row.idVehiculo ? Number(row.idVehiculo) : null,
        numeroEconomico: row.numeroEconomico || null,
        placa: row.placa || null,
        marca: row.marca || null,
        modelo: row.modelo || null,
        ano: row.ano ? Number(row.ano) : null,
        marcaModeloAno: `${row.marca || ''} ${row.modelo || ''} ${row.ano || ''}`.trim(),
        turnos: Number(row.turnos) || 0,
        viajes: Number(row.viajes) || 0,
        validaciones: Number(row.validaciones) || 0,
        ingresos: Number(parseFloat(String(row.ingresos)).toFixed(2)) || 0,
        ticketPromedio: Number(parseFloat(String(row.ticketPromedio)).toFixed(2)) || 0,
        horasServicio: Number(parseFloat(String(row.horasServicio)).toFixed(2)) || 0,
      }));

      return {
        data,
      };
    } catch (error) {
      console.log(error);
      console.error('Error en recaudacionPorVehiculo:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al generar el reporte de recaudación por vehículo',
        error: error.message,
        stack: error.stack,
      });
    }
  }

  async recaudacionPorDispositivo(
    filtros: RecaudacionPorDispositivoDto,
    cliente: number,
  ): Promise<ApiResponseCommon> {
    try {
      // Obtener jerarquía de clientes
      const { ids: clienteIds, placeholders } = await this.clienteHijos(cliente);
      
      if (clienteIds.length === 0) {
        return {
          data: [],
        };
      }

      // Preparar filtros de fecha — FHRegistro en HistoricoTransaccionesDebito
      const fechaInicio = filtros.fechaInicio ? filtros.fechaInicio.split('T')[0] : null;
      const fechaFin = filtros.fechaFin ? filtros.fechaFin.split('T')[0] : null;

      // HistoricoTransaccionesDebito → Viajes (IdViajes) → Turnos → Instalación/vehículo; dispositivo validador vía NumeroSerieDispositivo
      // BlueVox: InstalacionesBlueVoxs (cuando hay instalación por turno)
      const query = `
SELECT
    datos.idInstalacion,
    datos.serieDispositivo,
    datos.serieBlueVox,
    datos.numeroEconomico,
    datos.placa,
    datos.vehiculo,
    datos.validaciones,
    datos.ingresos,
    datos.estadoDispositivo,
    pos.latitud AS ultimaPosicionLatitud,
    pos.longitud AS ultimaPosicionLongitud,
    pos.fechaHora AS ultimaPosicionFecha
FROM (
    SELECT
        ins.Id AS idInstalacion,
        dispTxn.NumeroSerie AS serieDispositivo,
        COALESCE(
            (SELECT GROUP_CONCAT(bv.NumeroSerie SEPARATOR ', ')
             FROM InstalacionesBlueVoxs ibv
             INNER JOIN BlueVoxs bv ON ibv.IdBlueVox = bv.Id
             WHERE ibv.IdInstalacion = ins.Id
               AND ibv.Estatus = 1
               AND bv.IdCliente = ins.IdCliente),
            NULL
        ) AS serieBlueVox,
        veh.NumeroEconomico AS numeroEconomico,
        veh.Placa AS placa,
        CONCAT(veh.NumeroEconomico, ' - ', veh.Placa) AS vehiculo,
        COUNT(DISTINCT htd.Id) AS validaciones,
        COALESCE(SUM(htd.Monto), 0) AS ingresos,
        dispTxn.EstadoActual AS estadoDispositivo
    FROM HistoricoTransaccionesDebito htd
    INNER JOIN Monederos m ON htd.NumeroSerieMonedero = m.NumeroSerie
    INNER JOIN Dispositivos dispTxn ON dispTxn.NumeroSerie = htd.NumeroSerieDispositivo
    LEFT JOIN Viajes v ON htd.IdViajes = v.Id
    LEFT JOIN Turnos t ON v.IdTurno = t.Id
    LEFT JOIN Instalaciones ins ON t.IdInstalacion = ins.Id
    LEFT JOIN Vehiculos veh ON ins.IdVehiculo = veh.Id
    WHERE m.IdCliente IN (${placeholders})
    ${fechaInicio ? `AND DATE(htd.FHRegistro) >= ?` : ''}
    ${fechaFin ? `AND DATE(htd.FHRegistro) <= ?` : ''}
    ${filtros.idDispositivo ? 'AND dispTxn.Id = ?' : ''}
    ${filtros.idInstalacion ? 'AND ins.Id = ?' : ''}
    GROUP BY ins.Id, dispTxn.NumeroSerie, veh.NumeroEconomico, veh.Placa, dispTxn.EstadoActual
) AS datos
LEFT JOIN (
    SELECT 
        p1.NumeroSerieDispositivo,
        p1.Latitud,
        p1.Longitud,
        p1.FechaHora
    FROM Posiciones p1
    INNER JOIN (
        SELECT 
            NumeroSerieDispositivo,
            MAX(FechaHora) AS MaxFechaHora
        FROM Posiciones
        GROUP BY NumeroSerieDispositivo
    ) p2 ON p1.NumeroSerieDispositivo = p2.NumeroSerieDispositivo 
        AND p1.FechaHora = p2.MaxFechaHora
) AS pos ON pos.NumeroSerieDispositivo = datos.serieDispositivo
ORDER BY datos.ingresos DESC, datos.serieDispositivo ASC;
      `;

      // Construir parámetros para la consulta principal
      // Orden: clienteIds, fechas (HistoricoTransaccionesDebito), idDispositivo, idInstalacion
      const parametrosCompletos = [...clienteIds];
      
      // Parámetros de fecha (HistoricoTransaccionesDebito.FHRegistro)
      if (fechaInicio) {
        parametrosCompletos.push(fechaInicio);
      }
      if (fechaFin) {
        parametrosCompletos.push(fechaFin);
      }
      
      // Parámetro de dispositivo si existe
      if (filtros.idDispositivo) {
        parametrosCompletos.push(filtros.idDispositivo);
      }
      
      // Parámetro de instalación si existe
      if (filtros.idInstalacion) {
        parametrosCompletos.push(filtros.idInstalacion);
      }

      console.log('=== DEBUG RECAUDACIÓN POR DISPOSITIVO ===');
      console.log('Filtros:', filtros);
      console.log('Cliente IDs:', clienteIds);
      console.log('Parámetros completos:', parametrosCompletos);
      
      const resultados = await this.clienteRepository.query(query, parametrosCompletos);
      
      console.log('Resultados obtenidos:', resultados.length);
      console.log('=== FIN DEBUG ===');

      // Formatear resultados
      const data = resultados.map((row: any) => ({
        idInstalacion: row.idInstalacion ? Number(row.idInstalacion) : null,
        serieDispositivo: row.serieDispositivo || null,
        serieBlueVox: row.serieBlueVox || null,
        numeroEconomico: row.numeroEconomico || null,
        placa: row.placa || null,
        vehiculo: row.vehiculo || null,
        validaciones: Number(row.validaciones) || 0,
        ingresos: Number(parseFloat(String(row.ingresos)).toFixed(2)) || 0,
        estadoDispositivo: row.estadoDispositivo !== null ? Number(row.estadoDispositivo) : null,
        ultimaPosicion: row.ultimaPosicionLatitud && row.ultimaPosicionLongitud ? {
          latitud: Number(parseFloat(String(row.ultimaPosicionLatitud)).toFixed(7)),
          longitud: Number(parseFloat(String(row.ultimaPosicionLongitud)).toFixed(7)),
          fecha: row.ultimaPosicionFecha || null,
        } : null,
      }));

      return {
        data,
      };
    } catch (error) {
      console.log(error);
      console.error('Error en recaudacionPorDispositivo:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al generar el reporte de recaudación por dispositivo',
        error: error.message,
        stack: error.stack,
      });
    }
  }
}
