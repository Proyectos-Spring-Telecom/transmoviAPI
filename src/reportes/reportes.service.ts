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
      
      if (clienteIds.length === 0) {
        return {
          data: [],
        };
      }

      // Construir condiciones WHERE para transacciones
      const condiciones: string[] = [];
      const parametros: any[] = [];

      // Filtro de clientes a través de Monederos
      condiciones.push(`m.IdCliente IN (${placeholders})`);
      parametros.push(...clienteIds);

      // Filtro de fecha - SOLO EN TRANSACCIONES
      if (filtros.fechaInicio) {
        const fechaInicio = filtros.fechaInicio.split('T')[0];
        condiciones.push(`DATE(td.FHRegistro) >= ?`);
        parametros.push(fechaInicio);
      }
      if (filtros.fechaFin) {
        const fechaFin = filtros.fechaFin.split('T')[0];
        condiciones.push(`DATE(td.FHRegistro) <= ?`);
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
    DATE(td.FHRegistro) AS fecha,
    reg.Id AS idRegion,
    reg.Nombre AS nombreRegion,
    r.Id AS idRuta,
    r.Nombre AS nombreRuta,
    d.Id AS idDerrotero,
    d.Nombre AS nombreDerrotero,
    COUNT(DISTINCT v.Id) AS viajes,
    COUNT(DISTINCT td.Id) AS validaciones,
    COALESCE(SUM(td.Monto), 0) AS ingresos,
    CASE 
        WHEN COUNT(DISTINCT td.Id) > 0 
        THEN COALESCE(SUM(td.Monto), 0) / COUNT(DISTINCT td.Id)
        ELSE 0 
    END AS ticketPromedio,
    CASE 
        WHEN COUNT(DISTINCT td.Id) > 0
        THEN (COUNT(DISTINCT CASE WHEN td.ControlTransaccion = 1 THEN td.Id END) * 100.0) / COUNT(DISTINCT td.Id)
        ELSE 0
    END AS porcentajeElectronico,
    COALESCE(SUM(vc.Diferencia), 0) AS ascensos,
    GREATEST(COALESCE(SUM(vc.Diferencia), 0) - COUNT(DISTINCT td.Id), 0) AS evasionAbsoluta,
    CASE 
        WHEN COALESCE(SUM(vc.Diferencia), 0) > 0
        THEN (GREATEST(COALESCE(SUM(vc.Diferencia), 0) - COUNT(DISTINCT td.Id), 0) * 100.0) / COALESCE(SUM(vc.Diferencia), 0)
        ELSE 0
    END AS evasionPorcentual
FROM TransaccionesDebito td
INNER JOIN Monederos m ON td.NumeroSerieMonedero = m.NumeroSerie
INNER JOIN Clientes c ON m.IdCliente = c.Id
LEFT JOIN ViajesTransacciones vt ON vt.IdTransaccionDebito = td.Id
LEFT JOIN Viajes v ON vt.IdViaje = v.Id
LEFT JOIN Derroteros d ON v.IdDerrotero = d.Id
LEFT JOIN Rutas r ON d.IdRuta = r.Id
LEFT JOIN Regiones reg ON r.IdRegion = reg.Id
LEFT JOIN ViajesConteos vc_rel ON vc_rel.IdViaje = v.Id
LEFT JOIN ConteoPasajeros vc ON vc_rel.IdConteo = vc.Id
${whereClause}
GROUP BY DATE(td.FHRegistro), reg.Id, reg.Nombre, r.Id, r.Nombre, d.Id, d.Nombre
HAVING COUNT(DISTINCT td.Id) > 0
ORDER BY DATE(td.FHRegistro) DESC, reg.Nombre, r.Nombre, d.Nombre;
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

      // Preparar filtros de fecha - SOLO PARA TRANSACCIONES
      const fechaInicio = filtros.fechaInicio ? filtros.fechaInicio.split('T')[0] : null;
      const fechaFin = filtros.fechaFin ? filtros.fechaFin.split('T')[0] : null;

      // Consulta: empezar desde transacciones y agrupar por operador
      // Las subconsultas de turnos y viajes NO tienen filtro de fecha
      const query = `
SELECT
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
        COUNT(DISTINCT td.Id) AS validaciones,
        COALESCE(SUM(td.Monto), 0) AS ingresos,
        CASE 
            WHEN COUNT(DISTINCT td.Id) > 0 
            THEN COALESCE(SUM(td.Monto), 0) / COUNT(DISTINCT td.Id)
            ELSE 0 
        END AS ticketPromedio,
        CASE 
            WHEN COALESCE(SUM(vc.Diferencia), 0) > 0
            THEN (GREATEST(COALESCE(SUM(vc.Diferencia), 0) - COUNT(DISTINCT td.Id), 0) * 100.0) / COALESCE(SUM(vc.Diferencia), 0)
            ELSE 0
        END AS evasionPorcentual
    FROM TransaccionesDebito td
    INNER JOIN Monederos m ON td.NumeroSerieMonedero = m.NumeroSerie
    INNER JOIN Clientes c ON m.IdCliente = c.Id
    LEFT JOIN ViajesTransacciones vt ON vt.IdTransaccionDebito = td.Id
    LEFT JOIN Viajes v ON vt.IdViaje = v.Id
    LEFT JOIN Operadores o ON v.IdOperador = o.Id
    LEFT JOIN Usuarios u ON o.IdUsuario = u.Id
    LEFT JOIN Licencias l ON l.IdOperador = o.Id
    LEFT JOIN ViajesConteos vc_rel ON vc_rel.IdViaje = v.Id
    LEFT JOIN ConteoPasajeros vc ON vc_rel.IdConteo = vc.Id
    WHERE c.Id IN (${placeholders})
    ${fechaInicio ? `AND DATE(td.FHRegistro) >= ?` : ''}
    ${fechaFin ? `AND DATE(td.FHRegistro) <= ?` : ''}
    ${filtros.idOperador ? 'AND (o.Id = ? OR o.Id IS NULL)' : ''}
    GROUP BY COALESCE(o.Id, 0), u.Nombre, u.ApellidoPaterno, u.ApellidoMaterno
) AS datos
LEFT JOIN (
    SELECT 
        COALESCE(t.IdOperador, 0) AS IdOperador,
        COUNT(DISTINCT t.Id) AS totalTurnos,
        MAX(t.Inicio) AS ultimoTurno
    FROM Turnos t
    GROUP BY COALESCE(t.IdOperador, 0)
) AS turnos_data ON turnos_data.IdOperador = datos.idOperador
LEFT JOIN (
    SELECT 
        COALESCE(v2.IdOperador, 0) AS IdOperador,
        COUNT(DISTINCT v2.Id) AS totalViajes
    FROM Viajes v2
    GROUP BY COALESCE(v2.IdOperador, 0)
) AS viajes_data ON viajes_data.IdOperador = datos.idOperador
ORDER BY datos.ingresos DESC, datos.operador ASC;
      `;

      // Construir parámetros para la consulta principal
      // Orden: clienteIds, fechas WHERE principal (solo transacciones), idOperador
      const parametrosCompletos = [...clienteIds];
      
      // Parámetros de fecha para el WHERE principal (solo transacciones)
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

      // Formatear resultados
      const data = resultados.map((row: any) => {
        const idOperador = Number(row.idOperador);
        return {
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

      // Preparar filtros de fecha - SOLO PARA TRANSACCIONES
      const fechaInicio = filtros.fechaInicio ? filtros.fechaInicio.split('T')[0] : null;
      const fechaFin = filtros.fechaFin ? filtros.fechaFin.split('T')[0] : null;

      // Consulta principal: empezar desde transacciones y agrupar por vehículo
      // Las subconsultas de turnos y viajes NO tienen filtro de fecha
      const query = `
SELECT
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
        veh.Id AS idVehiculo,
        veh.NumeroEconomico AS numeroEconomico,
        veh.Placa AS placa,
        veh.Marca AS marca,
        veh.Modelo AS modelo,
        veh.Ano AS ano,
        COUNT(DISTINCT td.Id) AS validaciones,
        COALESCE(SUM(td.Monto), 0) AS ingresos,
        CASE 
            WHEN COUNT(DISTINCT td.Id) > 0 
            THEN COALESCE(SUM(td.Monto), 0) / COUNT(DISTINCT td.Id)
            ELSE 0 
        END AS ticketPromedio
    FROM TransaccionesDebito td
    INNER JOIN Monederos m ON td.NumeroSerieMonedero = m.NumeroSerie
    INNER JOIN Clientes c ON m.IdCliente = c.Id
    LEFT JOIN ViajesTransacciones vt ON vt.IdTransaccionDebito = td.Id
    LEFT JOIN Viajes v ON vt.IdViaje = v.Id
    LEFT JOIN Turnos t ON v.IdTurno = t.Id
    LEFT JOIN Instalaciones ins ON t.IdInstalacion = ins.Id
    LEFT JOIN Vehiculos veh ON ins.IdVehiculo = veh.Id
    LEFT JOIN Derroteros d ON v.IdDerrotero = d.Id
    LEFT JOIN Rutas r ON d.IdRuta = r.Id
    WHERE c.Id IN (${placeholders})
    ${fechaInicio ? `AND DATE(td.FHRegistro) >= ?` : ''}
    ${fechaFin ? `AND DATE(td.FHRegistro) <= ?` : ''}
    ${filtros.idVehiculo ? 'AND veh.Id = ?' : ''}
    ${filtros.idRuta ? 'AND r.Id = ?' : ''}
    GROUP BY veh.Id, veh.NumeroEconomico, veh.Placa, veh.Marca, veh.Modelo, veh.Ano
) AS datos
LEFT JOIN (
    SELECT 
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
    GROUP BY veh2.Id
) AS turnos_data ON turnos_data.IdVehiculo = datos.idVehiculo
LEFT JOIN (
    SELECT 
        veh3.Id AS IdVehiculo,
        COUNT(DISTINCT v3.Id) AS totalViajes
    FROM Vehiculos veh3
    INNER JOIN Instalaciones ins3 ON ins3.IdVehiculo = veh3.Id
    INNER JOIN Turnos t3 ON t3.IdInstalacion = ins3.Id
    INNER JOIN Viajes v3 ON v3.IdTurno = t3.Id
    GROUP BY veh3.Id
) AS viajes_data ON viajes_data.IdVehiculo = datos.idVehiculo
ORDER BY datos.ingresos DESC, datos.numeroEconomico ASC;
      `;

      // Construir parámetros para la consulta principal
      // Orden: clienteIds, fechas (solo transacciones), idVehiculo, idRuta
      const parametrosCompletos = [...clienteIds];
      
      // Parámetros de fecha (solo para transacciones)
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

      // Formatear resultados
      const data = resultados.map((row: any) => ({
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

      // Preparar filtros de fecha - SOLO PARA TRANSACCIONES
      const fechaInicio = filtros.fechaInicio ? filtros.fechaInicio.split('T')[0] : null;
      const fechaFin = filtros.fechaFin ? filtros.fechaFin.split('T')[0] : null;

      // Consulta principal: empezar desde transacciones y agrupar por instalación/dispositivo
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
        disp.NumeroSerie AS serieDispositivo,
        bv.NumeroSerie AS serieBlueVox,
        veh.NumeroEconomico AS numeroEconomico,
        veh.Placa AS placa,
        CONCAT(veh.NumeroEconomico, ' - ', veh.Placa) AS vehiculo,
        COUNT(DISTINCT td.Id) AS validaciones,
        COALESCE(SUM(td.Monto), 0) AS ingresos,
        disp.EstadoActual AS estadoDispositivo
    FROM TransaccionesDebito td
    INNER JOIN Monederos m ON td.NumeroSerieMonedero = m.NumeroSerie
    INNER JOIN Clientes c ON m.IdCliente = c.Id
    LEFT JOIN ViajesTransacciones vt ON vt.IdTransaccionDebito = td.Id
    LEFT JOIN Viajes v ON vt.IdViaje = v.Id
    LEFT JOIN Turnos t ON v.IdTurno = t.Id
    LEFT JOIN Instalaciones ins ON t.IdInstalacion = ins.Id
    LEFT JOIN Dispositivos disp ON ins.IdDispositivo = disp.Id
    LEFT JOIN BlueVoxs bv ON ins.IdBlueVox = bv.Id
    LEFT JOIN Vehiculos veh ON ins.IdVehiculo = veh.Id
    WHERE c.Id IN (${placeholders})
    ${fechaInicio ? `AND DATE(td.FHRegistro) >= ?` : ''}
    ${fechaFin ? `AND DATE(td.FHRegistro) <= ?` : ''}
    ${filtros.idDispositivo ? 'AND disp.Id = ?' : ''}
    ${filtros.idInstalacion ? 'AND ins.Id = ?' : ''}
    GROUP BY ins.Id, disp.NumeroSerie, bv.NumeroSerie, veh.NumeroEconomico, veh.Placa, disp.EstadoActual
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
      // Orden: clienteIds, fechas (solo transacciones), idDispositivo, idInstalacion
      const parametrosCompletos = [...clienteIds];
      
      // Parámetros de fecha (solo para transacciones)
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
