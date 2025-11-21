import { HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { KpiDto } from './dto/kpi.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Clientes } from 'src/entities/Clientes';
import { Repository } from 'typeorm';
import { EnumFiltros } from 'src/common/estatus.enum';

@Injectable()
export class DashboardService {
  constructor(
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


  private async kpi1(
    fechaInicio: string,
    fechaFin: string,
    idCliente: number
  ) {
    const query = `
      SELECT
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,

    -- Ingresos y ticket promedio
    IFNULL(SUM(CASE WHEN td.IdTipoTransaccion = 2 THEN td.Monto ELSE 0 END), 0) AS ingresosDelDia,  				-- Ingresos del dia 1.1
    COUNT(DISTINCT CASE WHEN td.IdTipoTransaccion = 2 THEN td.NumeroSerieMonedero END) AS pasajerosValidados, 		-- Pasajeros Validados 1.2
    ROUND(
        IFNULL(
            SUM(CASE WHEN td.IdTipoTransaccion = 2 THEN td.Monto ELSE 0 END) /
            NULLIF(COUNT(DISTINCT CASE WHEN td.IdTipoTransaccion = 2 THEN td.NumeroSerieMonedero END), 0),
        0), 2) AS ticketPromedio,																					-- Ticket Promedio 1.3

    -- Validaciones exitosas y fallidas
    SUM(CASE WHEN td.IdTipoTransaccion = 2 THEN 1 ELSE 0 END) AS validacionesExitosas,								-- Validaciones exitosas / fallidas
    SUM(CASE WHEN td.IdTipoTransaccion = 3 THEN 1 ELSE 0 END) AS validacionesFallidas,								-- 1.5
    COUNT(*) AS totalIntentos,																						-- 1.5
    ROUND(SUM(CASE WHEN td.IdTipoTransaccion = 2 THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0) * 100, 2) AS porcentajeExitosas,  -- 1.5
    ROUND(SUM(CASE WHEN td.IdTipoTransaccion = 3 THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0) * 100, 2) AS porcentajeFallidas   -- 1.5

FROM HistoricoTransaccionesDebito td
INNER JOIN Dispositivos d ON td.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Clientes c ON d.IdCliente = c.Id
WHERE td.FechaHora >= '${fechaInicio}'                 -- inicio del día
  AND td.FechaHora < CURDATE() + INTERVAL 1 DAY -- fin del día
  AND c.Id IN (${idCliente})              -- IDs de cliente a filtrar
GROUP BY c.Id, c.Nombre, c.ApellidoPaterno, c.ApellidoMaterno
ORDER BY ingresosDelDia DESC;`

    return this.clienteRepository.query(query);
  }

  private async kp2(
    fechaInicio: string,
    fechaFin: string,
    idCliente: number
  ) {
    const query = `
WITH Ocupacion AS (
    SELECT
        t.IdCliente,
        v.Id AS idVehiculo,
        ROUND(
            SUM(cp.Entradas - cp.Salidas) / NULLIF((v.PasajerosSentados + v.PasajerosParados), 0) * 100,
            2
        ) AS ocupacionPromedio
    FROM Turnos t
    INNER JOIN Instalaciones i ON t.IdInstalacion = i.Id
    INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id
    INNER JOIN Viajes vi ON vi.IdTurno = t.Id
    INNER JOIN ViajesConteos vc ON vc.IdViaje = vi.Id
    INNER JOIN ConteoPasajeros cp ON cp.Id = vc.IdConteo
    WHERE t.Estatus = 1
      AND v.Estatus = 1
      AND cp.FechaHora >= '${fechaInicio}'
      AND cp.FechaHora < '${fechaFin}'
    GROUP BY t.IdCliente, v.Id
)
SELECT
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    COUNT(DISTINCT v.Id) AS totalUnidades,
    COUNT(DISTINCT CASE
        WHEN up.Id IS NOT NULL AND t.Id IS NOT NULL THEN v.Id
    END) AS unidadesEnServicio,
    ROUND(
        COUNT(DISTINCT CASE
            WHEN up.Id IS NOT NULL AND t.Id IS NOT NULL THEN v.Id
        END) / NULLIF(COUNT(DISTINCT v.Id),0) * 100, 2
    ) AS porcentajeEnServicio,
    ROUND(
        COUNT(DISTINCT CASE
            WHEN t.Fin IS NOT NULL AND t.Inicio >= '${fechaInicio}' AND t.Inicio < '${fechaFin}' THEN t.Id
        END) / NULLIF(COUNT(DISTINCT CASE
            WHEN t.Inicio >= '${fechaInicio}' AND t.Inicio < '${fechaFin}' THEN t.Id
        END), 0) * 100, 2
    ) AS cumplimientoTurnosPorcentaje,
    ROUND(AVG(o.ocupacionPromedio), 2) AS ocupacionPromedioCliente
FROM Vehiculos v
INNER JOIN Clientes c ON v.IdCliente = c.Id
LEFT JOIN Instalaciones i ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente AND i.Estatus = 1
LEFT JOIN Dispositivos d ON d.Id = i.IdDispositivo
LEFT JOIN Posiciones up ON up.NumeroSerieDispositivo = d.NumeroSerie
    AND up.FechaHora >= NOW() - INTERVAL 30 MINUTE
LEFT JOIN Turnos t ON t.IdCliente = v.IdCliente
    AND t.Estatus = 1
    AND t.Inicio >= '${fechaInicio}'
    AND t.Inicio <= '${fechaFin}'
LEFT JOIN Ocupacion o ON o.IdCliente = c.Id AND o.idVehiculo = v.Id
WHERE v.Estatus = 1
  AND c.Id IN (${idCliente})
GROUP BY c.Id, c.Nombre
ORDER BY porcentajeEnServicio DESC;`
    return this.clienteRepository.query(query);
  }

  async dashboardkpi(kpiDto: KpiDto, rol: number) {
    try {
      const { fechaInicio, fechaFin, filtro, idCliente } = kpiDto
      let kpi1;
      let query1;
      let kpi2;
      let query2;
      if (fechaInicio && fechaFin) {
        kpi1 = await this.kpi1(fechaInicio, fechaFin, idCliente)
        kpi2 = await this.kp2(fechaInicio, fechaFin, idCliente)
        return { kpi1, kpi2 };
      }
      switch (filtro) {
        case EnumFiltros.SEMANA:

          break;

        case EnumFiltros.MES:
          break;

        default:
          query1 = `
      SELECT
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    c.ApellidoPaterno AS apellidoPaternoCliente,
    c.ApellidoMaterno AS apellidoMaternoCliente,

    -- Ingresos y ticket promedio
    IFNULL(SUM(CASE WHEN td.IdTipoTransaccion = 2 THEN td.Monto ELSE 0 END), 0) AS ingresosDelDia,  				-- Ingresos del dia 1.1
    COUNT(DISTINCT CASE WHEN td.IdTipoTransaccion = 2 THEN td.NumeroSerieMonedero END) AS pasajerosValidados, 		-- Pasajeros Validados 1.2
    ROUND(
        IFNULL(
            SUM(CASE WHEN td.IdTipoTransaccion = 2 THEN td.Monto ELSE 0 END) /
            NULLIF(COUNT(DISTINCT CASE WHEN td.IdTipoTransaccion = 2 THEN td.NumeroSerieMonedero END), 0),
        0), 2) AS ticketPromedio,																					-- Ticket Promedio 1.3

    -- Validaciones exitosas y fallidas
    SUM(CASE WHEN td.IdTipoTransaccion = 2 THEN 1 ELSE 0 END) AS validacionesExitosas,								-- Validaciones exitosas / fallidas
    SUM(CASE WHEN td.IdTipoTransaccion = 3 THEN 1 ELSE 0 END) AS validacionesFallidas,								-- 1.5
    COUNT(*) AS totalIntentos,																						-- 1.5
    ROUND(SUM(CASE WHEN td.IdTipoTransaccion = 2 THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0) * 100, 2) AS porcentajeExitosas,  -- 1.5
    ROUND(SUM(CASE WHEN td.IdTipoTransaccion = 3 THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0) * 100, 2) AS porcentajeFallidas   -- 1.5

FROM TransaccionesDebito td
INNER JOIN Dispositivos d ON td.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Clientes c ON d.IdCliente = c.Id
WHERE td.FechaHora >= CURDATE()                 -- inicio del día
  AND td.FechaHora < CURDATE() + INTERVAL 1 DAY -- fin del día
  AND c.Id IN (${idCliente})              -- IDs de cliente a filtrar
GROUP BY c.Id, c.Nombre, c.ApellidoPaterno, c.ApellidoMaterno
ORDER BY ingresosDelDia DESC;`
          kpi1 = await this.clienteRepository.query(query1);


          query2 = `
WITH Ocupacion AS (
    SELECT
        t.IdCliente,
        v.Id AS idVehiculo,
        ROUND(
            SUM(cp.Entradas - cp.Salidas) / NULLIF((v.PasajerosSentados + v.PasajerosParados), 0) * 100,
            2
        ) AS ocupacionPromedio
    FROM Turnos t
    INNER JOIN Instalaciones i ON t.IdInstalacion = i.Id
    INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id
    INNER JOIN Viajes vi ON vi.IdTurno = t.Id
    INNER JOIN ViajesConteos vc ON vc.IdViaje = vi.Id
    INNER JOIN ConteoPasajeros cp ON cp.Id = vc.IdConteo
    WHERE t.Estatus = 1
      AND v.Estatus = 1
      AND cp.FechaHora >= CURDATE()
      AND cp.FechaHora < CURDATE() + INTERVAL 1 DAY
    GROUP BY t.IdCliente, v.Id
)
SELECT
    c.Id AS idCliente,
    c.Nombre AS nombreCliente,
    COUNT(DISTINCT v.Id) AS totalUnidades,
    COUNT(DISTINCT CASE
        WHEN up.Id IS NOT NULL AND t.Id IS NOT NULL THEN v.Id
    END) AS unidadesEnServicio,
    ROUND(
        COUNT(DISTINCT CASE
            WHEN up.Id IS NOT NULL AND t.Id IS NOT NULL THEN v.Id
        END) / NULLIF(COUNT(DISTINCT v.Id),0) * 100, 2
    ) AS porcentajeEnServicio,
    ROUND(
        COUNT(DISTINCT CASE
            WHEN t.Fin IS NOT NULL AND t.Inicio >= CURDATE() AND t.Inicio < CURDATE() + INTERVAL 1 DAY THEN t.Id
        END) / NULLIF(COUNT(DISTINCT CASE
            WHEN t.Inicio >= CURDATE() AND t.Inicio < CURDATE() + INTERVAL 1 DAY THEN t.Id
        END), 0) * 100, 2
    ) AS cumplimientoTurnosPorcentaje,
    ROUND(AVG(o.ocupacionPromedio), 2) AS ocupacionPromedioCliente
FROM Vehiculos v
INNER JOIN Clientes c ON v.IdCliente = c.Id
LEFT JOIN Instalaciones i ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente AND i.Estatus = 1
LEFT JOIN Dispositivos d ON d.Id = i.IdDispositivo
LEFT JOIN UltimaPosicion up ON up.NumeroSerieDispositivo = d.NumeroSerie
    AND up.FechaHora >= NOW() - INTERVAL 30 MINUTE
LEFT JOIN Turnos t ON t.IdCliente = v.IdCliente
    AND t.Estatus = 1
    AND t.Inicio <= NOW()
LEFT JOIN Ocupacion o ON o.IdCliente = c.Id AND o.idVehiculo = v.Id
WHERE v.Estatus = 1
  AND c.Id IN (${idCliente})
GROUP BY c.Id, c.Nombre
ORDER BY porcentajeEnServicio DESC;`
          kpi2 = await this.clienteRepository.query(query2);
          break;
      }



      return { kpi1, kpi2 }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Ocurrió un error al intentar obtener datos del kpi.',
        error: error.message,
      });
    }
  }


}
