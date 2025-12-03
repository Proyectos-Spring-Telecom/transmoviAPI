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
  // ========================================
  // 🔹 OBTENER DASHBOARD
  // ========================================
  async dashboardkpi(kpiDto: KpiDto, rol: number, cliente: number) {
    try {
      const { fechaInicio, fechaFin, filtro, idCliente } = kpiDto
      let data;
      if (fechaInicio && fechaFin) {

        data = await this.resolverPorFecha(fechaInicio, fechaFin, idCliente, cliente, rol)
      } else {
        const { fechaIni, fechaFinal } = await this.resolverPorFiltro(filtro || 1);
        data = await this.resolverPorRol(fechaIni, fechaFinal, idCliente, cliente, rol)
      }
      const { grafica1, grafica2, grafica3, grafica4 } = data

      //Forzamos a cambiar el id a number
      const graficaIngresos = grafica1.map((item) => ({
        ...item,
        id: Number(item.id),
        validaciones_exitosas: Number(item.validaciones_exitosas),
        validaciones_fallidas: Number(item.validaciones_fallidas),
      }));

      const graficaDerroteros = grafica2.map((item) => ({
        ...item,
        idRuta: Number(item.idRuta),
        pasajeros: Number(item.pasajeros),
      }));

      const graficaAscensoBoleto = grafica3.map((item) => ({
        ...item,
        ascensos: Number(item.ascensos),
        boletos: Number(item.boletos),
      }));
      return {
        ingresosAlDia: data.kpi1[0].ingresosDelDia,
        pasajerosValidados: Number(data.kpi1[0].pasajerosValidados) || 0,
        ticketPromedio: Number(data.kpi1[0].ticketPromedio),
        validacionesExitosas: Number(data.kpi1[0].validacionesExitosas),
        validacionesFallidas: Number(data.kpi1[0].validacionesFallidas),
        unidadesEnServicio: Number(data.kpi2[0].unidadesEnServicio),
        totalUnidades: Number(data.kpi2[0].totalUnidades),
        cumplimientoTurnos: data.kpi2[0].cumplimientoTurnosPorcentaje,
        ocupacionPromedio: data.kpi2[0].ocupacionPromedioTotal || 0,
        graficaIngresos,
        graficaDerroteros,
        graficaAscensoBoleto,
        grafica4,
      };

    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: `Ocurrió un error al intentar obtener datos del kpi.`,
        error: error.message,
      });
    }
  }

  async resolverPorFecha(
    fechaInicio: string,
    fechaFin: string,
    idCliente: number,
    cliente: number,
    rol: number
  ) {
    try {
      fechaInicio = fechaInicio.split("T")[0];
      fechaFin = fechaFin.split("T")[0];
      return await this.resolverPorRol(fechaInicio, fechaFin, idCliente, cliente, rol)
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: `Ocurrió un error al intentar obtener datos del kpi.`,
        error: error.message,
      });
    }
  }

  async resolverPorFiltro(
    filtro: number,
  ): Promise<any> {
    try {
      function pad(n: number) {
        return n < 10 ? '0' + n : n;
      }
      const ahora = new Date();
      const desfaseMs = -6 * 60 * 60 * 1000; // -6 horas
      const fechaDesfasada = new Date(ahora.getTime() + desfaseMs);
      // Solo la fecha del momento
      const fechaActual = `${fechaDesfasada.getFullYear()}-${pad(fechaDesfasada.getMonth() + 1)}-${pad(fechaDesfasada.getDate())}`;
      let fechaIni;
      let fechaFinal;
      switch (filtro) {
        case EnumFiltros.MES:
          // Restar 1 mes
          const fechaHaceUnMes = new Date(fechaDesfasada);
          fechaHaceUnMes.setMonth(fechaHaceUnMes.getMonth() - 1);

          // Solo fecha YYYY-MM-DD
          const fechaMesAntes = `${fechaHaceUnMes.getFullYear()}-${pad(fechaHaceUnMes.getMonth() + 1)}-${pad(fechaHaceUnMes.getDate())}`;

          //Retornamos las fechas correspondientes
          fechaIni = fechaMesAntes
          fechaFinal = fechaActual
          break;
        case EnumFiltros.SEMANA:
          // Restar 7 días (7 * 24 * 60 * 60 * 1000 ms)
          const hace7Dias = new Date(fechaDesfasada.getTime() - 7 * 24 * 60 * 60 * 1000);

          // Solo la fecha
          const fechaSemanaAntes = `${hace7Dias.getFullYear()}-${pad(hace7Dias.getMonth() + 1)}-${pad(hace7Dias.getDate())}`;

          //Retornamos las fechas correspondientes
          fechaIni = fechaSemanaAntes
          fechaFinal = fechaActual
          break;

        default:

          //Retornamos las fechas correspondientes
          fechaIni = fechaActual
          fechaFinal = fechaActual
          break;
      }
      return { fechaIni, fechaFinal }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: `Ocurrió un error al intentar obtener las fechas del filtro para datos del kpi.`,
        error: error.message,
      });
    }

  }

  async resolverPorRol(
    fechaInicio: string,
    fechaFin: string,
    idCliente: number,
    cliente: number,
    rol: number
  ) {
    try {
      let kpi1;
      let kpi2;
      let grafica1;
      let grafica2;
      let grafica3;
      let grafica4;
      switch (rol) {
        case 1:
          if (idCliente === cliente) {
            kpi1 = await this.kpiSA(fechaInicio, fechaFin, idCliente);
            kpi2 = await this.kpi2SA(fechaInicio, fechaFin, idCliente);
            grafica1 = await this.grafica1SA(fechaInicio, fechaFin, idCliente);
            grafica2 = await this.grafica2SA(fechaInicio, fechaFin, idCliente);
            grafica3 = await this.graficaAsc3SA(fechaInicio, fechaFin, idCliente);
            grafica4 = await this.graficaAsc4SA(fechaInicio, fechaFin, idCliente);
          } else {
            kpi1 = await this.kpiDef(fechaInicio, fechaFin, idCliente);
            kpi2 = await this.kpi2Def(fechaInicio, fechaFin, idCliente);
            grafica1 = await this.grafica1(fechaInicio, fechaFin, idCliente);
            grafica2 = await this.grafica2(fechaInicio, fechaFin, idCliente);
            grafica3 = await this.graficaAsc3(fechaInicio, fechaFin, idCliente);
            grafica4 = await this.graficaAsc4(fechaInicio, fechaFin, idCliente);
          }

          break;
        case 2:
          if (idCliente === cliente) {
            kpi1 = await this.kpiSA(fechaInicio, fechaFin, idCliente);
            kpi2 = await this.kpi2SA(fechaInicio, fechaFin, idCliente);
            grafica1 = await this.grafica1SA(fechaInicio, fechaFin, idCliente);
            grafica2 = await this.grafica2SA(fechaInicio, fechaFin, idCliente);
            grafica3 = await this.graficaAsc3SA(fechaInicio, fechaFin, idCliente);
            grafica4 = await this.graficaAsc4SA(fechaInicio, fechaFin, idCliente);
          } else {
            kpi1 = await this.kpiDef(fechaInicio, fechaFin, idCliente);
            kpi2 = await this.kpi2Def(fechaInicio, fechaFin, idCliente);
            grafica1 = await this.grafica1(fechaInicio, fechaFin, idCliente);
            grafica2 = await this.grafica2(fechaInicio, fechaFin, idCliente);
            grafica3 = await this.graficaAsc3(fechaInicio, fechaFin, idCliente);
            grafica4 = await this.graficaAsc4(fechaInicio, fechaFin, idCliente);
          }
          break;

        default:
          kpi1 = await this.kpiDef(fechaInicio, fechaFin, idCliente);
          kpi2 = await this.kpi2Def(fechaInicio, fechaFin, idCliente);
          grafica1 = await this.grafica1(fechaInicio, fechaFin, idCliente);
          grafica2 = await this.grafica2(fechaInicio, fechaFin, idCliente);
          grafica3 = await this.graficaAsc3(fechaInicio, fechaFin, idCliente);
          grafica4 = await this.graficaAsc4(fechaInicio, fechaFin, idCliente);
          break;
      }
      return { kpi1, kpi2, grafica1, grafica2, grafica3, grafica4 }

    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: `Ocurrió un error al intentar obtener datos por rol del kpi.`,
        error: error.message,
      });
    }
  }


  private async kpiSA(
    fechaInicio: string,
    fechaFin: string,
    idCliente: number
  ) {
    const { ids, placeholders } = await this.clienteHijos(idCliente);
    const query = `
SELECT
    IFNULL(SUM(CASE WHEN td.IdTipoTransaccion = 2 THEN td.Monto ELSE 0 END), 0) AS ingresosDelDia,
    COUNT(DISTINCT CASE WHEN td.IdTipoTransaccion = 2 THEN td.NumeroSerieMonedero END) AS pasajerosValidados,
    ROUND(
        IFNULL(
            SUM(CASE WHEN td.IdTipoTransaccion = 2 THEN td.Monto ELSE 0 END) /
            NULLIF(COUNT(DISTINCT CASE WHEN td.IdTipoTransaccion = 2 THEN td.NumeroSerieMonedero END), 0),
        0), 2) AS ticketPromedio,
    SUM(CASE WHEN td.IdTipoTransaccion = 2 THEN 1 ELSE 0 END) AS validacionesExitosas,
    SUM(CASE WHEN td.IdTipoTransaccion = 3 THEN 1 ELSE 0 END) AS validacionesFallidas,
    COUNT(*) AS totalIntentos,
    ROUND(SUM(CASE WHEN td.IdTipoTransaccion = 2 THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0) * 100, 2) AS porcentajeExitosas,
    ROUND(SUM(CASE WHEN td.IdTipoTransaccion = 3 THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0) * 100, 2) AS porcentajeFallidas
FROM HistoricoTransaccionesDebito td
INNER JOIN Dispositivos d ON td.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Clientes c ON d.IdCliente = c.Id
WHERE td.FechaHoraFinal >= '${fechaInicio}T00:00:00Z'
  AND td.FechaHoraFinal < '${fechaFin}T23:59:59Z'
  AND c.Id IN (${placeholders});`

    return this.clienteRepository.query(query, [...ids]);
  }

  private async kpi2SA(
    fechaInicio: string,
    fechaFin: string,
    idCliente: number
  ) {
    const { ids, placeholders } = await this.clienteHijos(idCliente);
    const query = `
WITH Ocupacion AS (
    SELECT
        t.IdCliente,
        v.Id AS idVehiculo,
        ROUND(
            SUM(cp.Entradas - cp.Salidas) 
            / NULLIF((v.PasajerosSentados + v.PasajerosParados), 0) * 100,
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
      AND cp.FechaHora >= '${fechaInicio}T00:00:00Z'
      AND cp.FechaHora < '${fechaFin}T23:59:59Z'
    GROUP BY t.IdCliente, v.Id
)
SELECT
    COUNT(DISTINCT v.Id) AS totalUnidades,

    COUNT(DISTINCT CASE
        WHEN up.Id IS NOT NULL AND t.Id IS NOT NULL THEN v.Id
    END) AS unidadesEnServicio,

    ROUND(
        COUNT(DISTINCT CASE
            WHEN up.Id IS NOT NULL AND t.Id IS NOT NULL THEN v.Id
        END) / NULLIF(COUNT(DISTINCT v.Id), 0) * 100,
        2
    ) AS porcentajeEnServicio,

    ROUND(
        COUNT(DISTINCT CASE
            WHEN t.Fin IS NOT NULL THEN t.Id END)
        /
        NULLIF(
            COUNT(DISTINCT t.Id),
            0
        ) * 100,
        2
    ) AS cumplimientoTurnosPorcentaje,

    ROUND(AVG(o.ocupacionPromedio), 2) AS ocupacionPromedioTotal

FROM Vehiculos v
LEFT JOIN Instalaciones i ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente AND i.Estatus = 1
LEFT JOIN Dispositivos d ON d.Id = i.IdDispositivo
LEFT JOIN Posiciones up ON up.NumeroSerieDispositivo = d.NumeroSerie
    AND up.FechaHora >= NOW() - INTERVAL 30 MINUTE
LEFT JOIN Turnos t ON t.IdCliente = v.IdCliente
    AND t.Estatus = 1
    AND t.Inicio >= '${fechaInicio}T00:00:00Z'
    AND t.Inicio < '${fechaFin}T23:59:59Z'
LEFT JOIN Ocupacion o ON o.IdCliente = v.IdCliente AND o.idVehiculo = v.Id
WHERE v.Estatus = 1
  AND v.IdCliente IN (${placeholders});`
    return this.clienteRepository.query(query, [...ids]);
  }

  /////////*/*/*/*/*/*//*//////////////////////////////////////////******/////*/*/*/*/*/*/*/*/*/*/*/*/*/*/*//*/*/**/***/*/****
  private async kpiDef(
    fechaInicio: string,
    fechaFin: string,
    idCliente: number
  ) {

    const query = `
SELECT
    IFNULL(SUM(CASE WHEN td.IdTipoTransaccion = 2 THEN td.Monto ELSE 0 END), 0) AS ingresosDelDia,
    COUNT(DISTINCT CASE WHEN td.IdTipoTransaccion = 2 THEN td.NumeroSerieMonedero END) AS pasajerosValidados,
    ROUND(
        IFNULL(
            SUM(CASE WHEN td.IdTipoTransaccion = 2 THEN td.Monto ELSE 0 END) /
            NULLIF(COUNT(DISTINCT CASE WHEN td.IdTipoTransaccion = 2 THEN td.NumeroSerieMonedero END), 0),
        0), 2) AS ticketPromedio,
    SUM(CASE WHEN td.IdTipoTransaccion = 2 THEN 1 ELSE 0 END) AS validacionesExitosas,
    SUM(CASE WHEN td.IdTipoTransaccion = 3 THEN 1 ELSE 0 END) AS validacionesFallidas,
    COUNT(*) AS totalIntentos,
    ROUND(SUM(CASE WHEN td.IdTipoTransaccion = 2 THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0) * 100, 2) AS porcentajeExitosas,
    ROUND(SUM(CASE WHEN td.IdTipoTransaccion = 3 THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0) * 100, 2) AS porcentajeFallidas
FROM HistoricoTransaccionesDebito td
INNER JOIN Dispositivos d ON td.NumeroSerieDispositivo = d.NumeroSerie
INNER JOIN Clientes c ON d.IdCliente = c.Id
WHERE td.FechaHoraFinal >= '${fechaInicio}T00:00:00Z'
  AND td.FechaHoraFinal < '${fechaFin}T23:59:59Z'
  AND c.Id IN (${idCliente});`

    return this.clienteRepository.query(query,);
  }

  private async kpi2Def(
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
            SUM(cp.Entradas - cp.Salidas) 
            / NULLIF((v.PasajerosSentados + v.PasajerosParados), 0) * 100,
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
      AND cp.FechaHora >= '${fechaInicio}T00:00:00Z'
      AND cp.FechaHora < '${fechaFin}T23:59:59Z'
    GROUP BY t.IdCliente, v.Id
)
SELECT
    COUNT(DISTINCT v.Id) AS totalUnidades,

    COUNT(DISTINCT CASE
        WHEN up.Id IS NOT NULL AND t.Id IS NOT NULL THEN v.Id
    END) AS unidadesEnServicio,

    ROUND(
        COUNT(DISTINCT CASE
            WHEN up.Id IS NOT NULL AND t.Id IS NOT NULL THEN v.Id
        END) / NULLIF(COUNT(DISTINCT v.Id), 0) * 100,
        2
    ) AS porcentajeEnServicio,

    ROUND(
        COUNT(DISTINCT CASE
            WHEN t.Fin IS NOT NULL THEN t.Id END)
        /
        NULLIF(
            COUNT(DISTINCT t.Id),
            0
        ) * 100,
        2
    ) AS cumplimientoTurnosPorcentaje,

    ROUND(AVG(o.ocupacionPromedio), 2) AS ocupacionPromedioTotal

FROM Vehiculos v
LEFT JOIN Instalaciones i ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente AND i.Estatus = 1
LEFT JOIN Dispositivos d ON d.Id = i.IdDispositivo
LEFT JOIN Posiciones up ON up.NumeroSerieDispositivo = d.NumeroSerie
    AND up.FechaHora >= NOW() - INTERVAL 30 MINUTE
LEFT JOIN Turnos t ON t.IdCliente = v.IdCliente
    AND t.Estatus = 1
    AND t.Inicio >= '${fechaInicio}T00:00:00Z'
    AND t.Inicio < '${fechaFin}T23:59:59Z'
LEFT JOIN Ocupacion o ON o.IdCliente = v.IdCliente AND o.idVehiculo = v.Id
WHERE v.Estatus = 1
  AND v.IdCliente IN (${idCliente});`
    return this.clienteRepository.query(query);
  }

  /////////*/*/*/*/*/*//*//////////////////////////////////////////******/////*/*/*/*/*/*/*/*/*/*/*/*/*/*/*//*/*/**/***/*/****

  private async grafica1(
    fechaInicio: string,
    fechaFin: string,
    idCliente: number
  ) {
    const query = `
WITH rango AS (
    SELECT DATEDIFF('${fechaFin}T23:59:59Z', '${fechaInicio}T00:00:00Z') AS dias
),
datos AS (
    SELECT 
        /* PERIODO DINÁMICO */
        CASE 
            WHEN dias = 0 THEN DATE_FORMAT(td.FechaHoraFinal, '%Y-%m-%d %H:00')     -- Por hora
            WHEN dias <= 15 THEN DATE(td.FechaHoraFinal)                            -- Por día
            WHEN dias <= 60 THEN CONCAT(DATE_FORMAT(td.FechaHoraFinal, '%Y-%m'),
                                        ' Semana ', WEEK(td.FechaHoraFinal, 1))     -- Por semana
            ELSE DATE_FORMAT(td.FechaHoraFinal, '%Y-%m')                            -- Por mes
        END AS periodo,

        SUM(CASE WHEN td.IdTipoTransaccion = 2 THEN td.Monto ELSE 0 END) AS ingresos,
        COUNT(CASE WHEN td.IdTipoTransaccion = 2 THEN 1 END) AS validaciones_exitosas,
        COUNT(CASE WHEN td.IdTipoTransaccion = 3 THEN 1 END) AS validaciones_fallidas,

        ROUND(
            IFNULL(
                SUM(CASE WHEN td.IdTipoTransaccion = 2 THEN td.Monto ELSE 0 END) /
                NULLIF(COUNT(DISTINCT CASE WHEN td.IdTipoTransaccion = 2 THEN td.NumeroSerieMonedero END), 0)
            , 0), 2
        ) AS ticket_promedio,

        ROUND(
            SUM(CASE WHEN td.IdTipoTransaccion = 2 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) * 100,
            2
        ) AS porcentaje_exitosas,

        ROUND(
            SUM(CASE WHEN td.IdTipoTransaccion = 3 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) * 100,
            2
        ) AS porcentaje_fallidas

    FROM HistoricoTransaccionesDebito td
    INNER JOIN Dispositivos d ON td.NumeroSerieDispositivo = d.NumeroSerie
    INNER JOIN Clientes c ON d.IdCliente = c.Id
    CROSS JOIN rango
    WHERE td.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'
      AND c.Id IN (${idCliente})

    GROUP BY 
        CASE 
            WHEN dias = 0 THEN DATE_FORMAT(td.FechaHoraFinal, '%Y-%m-%d %H:00')
            WHEN dias <= 15 THEN DATE(td.FechaHoraFinal)
            WHEN dias <= 60 THEN CONCAT(DATE_FORMAT(td.FechaHoraFinal, '%Y-%m'),
                                        ' Semana ', WEEK(td.FechaHoraFinal, 1))
            ELSE DATE_FORMAT(td.FechaHoraFinal, '%Y-%m')
        END
)
SELECT 
    ROW_NUMBER() OVER (ORDER BY periodo) AS id,
    periodo,
    ingresos,
    validaciones_exitosas,
    validaciones_fallidas,
    ticket_promedio,
    porcentaje_exitosas,
    porcentaje_fallidas
FROM datos
ORDER BY periodo;

`
    return this.clienteRepository.query(query);
  }

  private async grafica1SA(
    fechaInicio: string,
    fechaFin: string,
    idCliente: number
  ) {
    const { ids, placeholders } = await this.clienteHijos(idCliente);
    const query = `
WITH rango AS (
    SELECT DATEDIFF('${fechaFin}T23:59:59Z', '${fechaInicio}T00:00:00Z') AS dias
),
datos AS (
    SELECT 
        /* PERIODO DINÁMICO */
        CASE 
            WHEN dias = 0 THEN DATE_FORMAT(td.FechaHoraFinal, '%Y-%m-%d %H:00')     -- Por hora
            WHEN dias <= 15 THEN DATE(td.FechaHoraFinal)                            -- Por día
            WHEN dias <= 60 THEN CONCAT(DATE_FORMAT(td.FechaHoraFinal, '%Y-%m'),
                                        ' Semana ', WEEK(td.FechaHoraFinal, 1))     -- Por semana
            ELSE DATE_FORMAT(td.FechaHoraFinal, '%Y-%m')                            -- Por mes
        END AS periodo,

        SUM(CASE WHEN td.IdTipoTransaccion = 2 THEN td.Monto ELSE 0 END) AS ingresos,
        COUNT(CASE WHEN td.IdTipoTransaccion = 2 THEN 1 END) AS validaciones_exitosas,
        COUNT(CASE WHEN td.IdTipoTransaccion = 3 THEN 1 END) AS validaciones_fallidas,

        ROUND(
            IFNULL(
                SUM(CASE WHEN td.IdTipoTransaccion = 2 THEN td.Monto ELSE 0 END) /
                NULLIF(COUNT(DISTINCT CASE WHEN td.IdTipoTransaccion = 2 THEN td.NumeroSerieMonedero END), 0)
            , 0), 2
        ) AS ticket_promedio,

        ROUND(
            SUM(CASE WHEN td.IdTipoTransaccion = 2 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) * 100,
            2
        ) AS porcentaje_exitosas,

        ROUND(
            SUM(CASE WHEN td.IdTipoTransaccion = 3 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) * 100,
            2
        ) AS porcentaje_fallidas

    FROM HistoricoTransaccionesDebito td
    INNER JOIN Dispositivos d ON td.NumeroSerieDispositivo = d.NumeroSerie
    INNER JOIN Clientes c ON d.IdCliente = c.Id
    CROSS JOIN rango
    WHERE td.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'
      AND c.Id IN (${placeholders})

    GROUP BY 
        CASE 
            WHEN dias = 0 THEN DATE_FORMAT(td.FechaHoraFinal, '%Y-%m-%d %H:00')
            WHEN dias <= 15 THEN DATE(td.FechaHoraFinal)
            WHEN dias <= 60 THEN CONCAT(DATE_FORMAT(td.FechaHoraFinal, '%Y-%m'),
                                        ' Semana ', WEEK(td.FechaHoraFinal, 1))
            ELSE DATE_FORMAT(td.FechaHoraFinal, '%Y-%m')
        END
)
SELECT 
    ROW_NUMBER() OVER (ORDER BY periodo) AS id,
    periodo,
    ingresos,
    validaciones_exitosas,
    validaciones_fallidas,
    ticket_promedio,
    porcentaje_exitosas,
    porcentaje_fallidas
FROM datos
ORDER BY periodo;

`
    return this.clienteRepository.query(query, [...ids]);
  }

  /////////*/*/*/*/*/*//*//////////////////////////////////////////******/////*/*/*/*/*/*/*/*/*/*/*/*/*/*/*//*/*/**/***/*/****

  private async grafica2(
    fechaInicio: string,
    fechaFin: string,
    idCliente: number
  ) {
    const query = `
WITH rango AS (
    SELECT DATEDIFF('${fechaFin}T23:59:59', '${fechaInicio}T00:00:00') AS dias
),
Pasajeros AS (
    SELECT
        r.Id AS idRuta,
        r.Nombre AS ruta,

        -- PERIODO dinámico según rango de días
        CASE
            WHEN dias = 0 THEN HOUR(cp.FechaHora)          -- Por hora
            WHEN dias <= 15 THEN DATE(cp.FechaHora)       -- Por día
            WHEN dias <= 60 THEN CONCAT(DATE_FORMAT(cp.FechaHora, '%Y-%m'), ' Semana ', WEEK(cp.FechaHora, 1)) -- Por semana
            ELSE DATE_FORMAT(cp.FechaHora, '%Y-%m')       -- Por mes
        END AS periodo,

        SUM(cp.Entradas - cp.Salidas) AS pasajeros
    FROM ConteoPasajeros cp
    INNER JOIN rango ON 1=1
    INNER JOIN BlueVoxs bv ON cp.NumeroSerieBlueVox = bv.NumeroSerie
    INNER JOIN Instalaciones i ON bv.Id = i.IdBlueVox
    INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id
    INNER JOIN Turnos t ON i.Id = t.IdInstalacion AND t.Estatus = 1
    INNER JOIN Viajes vi ON t.Id = vi.IdTurno AND vi.Estatus = 1
    INNER JOIN Derroteros d ON vi.IdDerrotero = d.Id AND d.Estatus = 1
    INNER JOIN Rutas r ON d.IdRuta = r.Id AND r.Estatus = 1
    INNER JOIN Clientes c ON v.IdCliente = c.Id AND c.Estatus = 1
    WHERE cp.FechaHora BETWEEN '${fechaInicio}T00:00:00' AND '${fechaFin}T23:59:59'
      AND c.Id IN (${idCliente})
      AND v.Estatus = 1
      AND i.Estatus = 1
    GROUP BY r.Id, r.Nombre,
        CASE
            WHEN dias = 0 THEN HOUR(cp.FechaHora)
            WHEN dias <= 15 THEN DATE(cp.FechaHora)
            WHEN dias <= 60 THEN CONCAT(DATE_FORMAT(cp.FechaHora, '%Y-%m'), ' Semana ', WEEK(cp.FechaHora, 1))
            ELSE DATE_FORMAT(cp.FechaHora, '%Y-%m')
        END
)
SELECT *
FROM Pasajeros
ORDER BY periodo, ruta;

`
    return this.clienteRepository.query(query);
  }

  private async grafica2SA(
    fechaInicio: string,
    fechaFin: string,
    idCliente: number
  ) {
    const { ids, placeholders } = await this.clienteHijos(idCliente);
    const query = `
WITH rango AS (
    SELECT DATEDIFF('${fechaFin}T23:59:59', '${fechaInicio}T00:00:00') AS dias
),
Pasajeros AS (
    SELECT
        r.Id AS idRuta,
        r.Nombre AS ruta,

        -- PERIODO dinámico según rango de días
        CASE
            WHEN dias = 0 THEN HOUR(cp.FechaHora)          -- Por hora
            WHEN dias <= 15 THEN DATE(cp.FechaHora)       -- Por día
            WHEN dias <= 60 THEN CONCAT(DATE_FORMAT(cp.FechaHora, '%Y-%m'), ' Semana ', WEEK(cp.FechaHora, 1)) -- Por semana
            ELSE DATE_FORMAT(cp.FechaHora, '%Y-%m')       -- Por mes
        END AS periodo,

        SUM(cp.Entradas - cp.Salidas) AS pasajeros
    FROM ConteoPasajeros cp
    INNER JOIN rango ON 1=1
    INNER JOIN BlueVoxs bv ON cp.NumeroSerieBlueVox = bv.NumeroSerie
    INNER JOIN Instalaciones i ON bv.Id = i.IdBlueVox
    INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id
    INNER JOIN Turnos t ON i.Id = t.IdInstalacion AND t.Estatus = 1
    INNER JOIN Viajes vi ON t.Id = vi.IdTurno AND vi.Estatus = 1
    INNER JOIN Derroteros d ON vi.IdDerrotero = d.Id AND d.Estatus = 1
    INNER JOIN Rutas r ON d.IdRuta = r.Id AND r.Estatus = 1
    INNER JOIN Clientes c ON v.IdCliente = c.Id AND c.Estatus = 1
    WHERE cp.FechaHora BETWEEN '${fechaInicio}T00:00:00' AND '${fechaFin}T23:59:59'
      AND c.Id IN (${placeholders})
      AND v.Estatus = 1
      AND i.Estatus = 1
    GROUP BY r.Id, r.Nombre,
        CASE
            WHEN dias = 0 THEN HOUR(cp.FechaHora)
            WHEN dias <= 15 THEN DATE(cp.FechaHora)
            WHEN dias <= 60 THEN CONCAT(DATE_FORMAT(cp.FechaHora, '%Y-%m'), ' Semana ', WEEK(cp.FechaHora, 1))
            ELSE DATE_FORMAT(cp.FechaHora, '%Y-%m')
        END
)
SELECT *
FROM Pasajeros
ORDER BY periodo, ruta;

`
    return this.clienteRepository.query(query, [...ids]);
  }

  /////////*/*/*/*/*/*//*//////////////////////////////////////////******/////*/*/*/*/*/*/*/*/*/*/*/*/*/*/*//*/*/**/***/*/****

  private async graficaAsc3(
    fechaInicio: string,
    fechaFin: string,
    idCliente: number
  ) {
    const query = `

WITH rango AS (
    SELECT DATEDIFF('${fechaFin}T23:59:59Z', '${fechaInicio}T00:00:00Z') AS dias
),

/* =====================================================
   PERIODOS DINÁMICOS
====================================================== */
periodos AS (
    SELECT DISTINCT
        CASE 
            WHEN dias = 0 THEN DATE_FORMAT(fecha, '%Y-%m-%d %H:00')
            WHEN dias <= 15 THEN DATE(fecha)
            WHEN dias <= 60 THEN CONCAT(DATE_FORMAT(fecha, '%Y-%m'),
                                        ' Semana ', WEEK(fecha, 1))
            ELSE DATE_FORMAT(fecha, '%Y-%m')
        END AS periodo
    FROM (
        SELECT cp.FechaHora AS fecha
        FROM ConteoPasajeros cp
        INNER JOIN BlueVoxs bv ON cp.NumeroSerieBlueVox = bv.NumeroSerie
        WHERE bv.IdCliente IN (${idCliente})
          AND cp.FechaHora BETWEEN '${fechaInicio}T00:00:00Z' 
                               AND '${fechaFin}T23:59:59Z'
        
        UNION
        
        SELECT td.FechaHoraFinal AS fecha
        FROM HistoricoTransaccionesDebito td
        INNER JOIN Dispositivos d ON td.NumeroSerieDispositivo = d.NumeroSerie
        WHERE d.IdCliente IN (${idCliente})
          AND td.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' 
                               AND '${fechaFin}T23:59:59Z'
    ) AS fechas
    CROSS JOIN rango
),

/* =====================================================
   ASCENSOS DEL CLIENTE
====================================================== */
ascensos AS (
    SELECT
        CASE 
            WHEN dias = 0 THEN DATE_FORMAT(cp.FechaHora, '%Y-%m-%d %H:00')
            WHEN dias <= 15 THEN DATE(cp.FechaHora)
            WHEN dias <= 60 THEN CONCAT(DATE_FORMAT(cp.FechaHora, '%Y-%m'),
                                        ' Semana ', WEEK(cp.FechaHora, 1))
            ELSE DATE_FORMAT(cp.FechaHora, '%Y-%m')
        END AS periodo,

        SUM(cp.Entradas - cp.Salidas) AS ascensos
    FROM ConteoPasajeros cp
    INNER JOIN BlueVoxs bv ON cp.NumeroSerieBlueVox = bv.NumeroSerie
    CROSS JOIN rango
    WHERE bv.IdCliente IN (${idCliente})
      AND cp.FechaHora BETWEEN '${fechaInicio}T00:00:00Z' 
                           AND '${fechaFin}T23:59:59Z'
    GROUP BY periodo
),

/* =====================================================
   BOLETOS (TRANSACCIONES EXITOSAS) DEL CLIENTE
====================================================== */
boletos AS (
    SELECT
        CASE 
            WHEN dias = 0 THEN DATE_FORMAT(td.FechaHoraFinal, '%Y-%m-%d %H:00')
            WHEN dias <= 15 THEN DATE(td.FechaHoraFinal)
            WHEN dias <= 60 THEN CONCAT(DATE_FORMAT(td.FechaHoraFinal, '%Y-%m'),
                                        ' Semana ', WEEK(td.FechaHoraFinal, 1))
            ELSE DATE_FORMAT(td.FechaHoraFinal, '%Y-%m')
        END AS periodo,

        COUNT(CASE WHEN td.IdTipoTransaccion = 2 THEN 1 END) AS boletos
    FROM HistoricoTransaccionesDebito td
    INNER JOIN Dispositivos d ON td.NumeroSerieDispositivo = d.NumeroSerie
    CROSS JOIN rango
    WHERE d.IdCliente IN (${idCliente})
      AND td.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' 
                           AND '${fechaFin}T23:59:59Z'
    GROUP BY periodo
)

/* =====================================================
   MERGE FINAL
====================================================== */
SELECT 
    p.periodo,
    COALESCE(a.ascensos, 0) AS ascensos,
    COALESCE(b.boletos, 0) AS boletos
FROM periodos p
LEFT JOIN ascensos a ON a.periodo = p.periodo
LEFT JOIN boletos  b ON b.periodo = p.periodo
ORDER BY p.periodo;

`
    return this.clienteRepository.query(query);
  }

  private async graficaAsc3SA(
    fechaInicio: string,
    fechaFin: string,
    idCliente: number
  ) {
    const { ids, placeholders } = await this.clienteHijos(idCliente);
    const query = `

WITH rango AS (
    SELECT DATEDIFF('${fechaFin}T23:59:59Z', '${fechaInicio}T00:00:00Z') AS dias
),

/* =====================================================
   PERIODOS DINÁMICOS
====================================================== */
periodos AS (
    SELECT DISTINCT
        CASE 
            WHEN dias = 0 THEN DATE_FORMAT(fecha, '%Y-%m-%d %H:00')
            WHEN dias <= 15 THEN DATE(fecha)
            WHEN dias <= 60 THEN CONCAT(DATE_FORMAT(fecha, '%Y-%m'),
                                        ' Semana ', WEEK(fecha, 1))
            ELSE DATE_FORMAT(fecha, '%Y-%m')
        END AS periodo
    FROM (
        SELECT cp.FechaHora AS fecha
        FROM ConteoPasajeros cp
        INNER JOIN BlueVoxs bv ON cp.NumeroSerieBlueVox = bv.NumeroSerie
        WHERE bv.IdCliente IN (${placeholders})
          AND cp.FechaHora BETWEEN '${fechaInicio}T00:00:00Z' 
                               AND '${fechaFin}T23:59:59Z'
        
        UNION
        
        SELECT td.FechaHoraFinal AS fecha
        FROM HistoricoTransaccionesDebito td
        INNER JOIN Dispositivos d ON td.NumeroSerieDispositivo = d.NumeroSerie
        WHERE d.IdCliente IN (${placeholders})
          AND td.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' 
                               AND '${fechaFin}T23:59:59Z'
    ) AS fechas
    CROSS JOIN rango
),

/* =====================================================
   ASCENSOS DEL CLIENTE
====================================================== */
ascensos AS (
    SELECT
        CASE 
            WHEN dias = 0 THEN DATE_FORMAT(cp.FechaHora, '%Y-%m-%d %H:00')
            WHEN dias <= 15 THEN DATE(cp.FechaHora)
            WHEN dias <= 60 THEN CONCAT(DATE_FORMAT(cp.FechaHora, '%Y-%m'),
                                        ' Semana ', WEEK(cp.FechaHora, 1))
            ELSE DATE_FORMAT(cp.FechaHora, '%Y-%m')
        END AS periodo,

        SUM(cp.Entradas - cp.Salidas) AS ascensos
    FROM ConteoPasajeros cp
    INNER JOIN BlueVoxs bv ON cp.NumeroSerieBlueVox = bv.NumeroSerie
    CROSS JOIN rango
    WHERE bv.IdCliente IN (${placeholders})
      AND cp.FechaHora BETWEEN '${fechaInicio}T00:00:00Z' 
                           AND '${fechaFin}T23:59:59Z'
    GROUP BY periodo
),

/* =====================================================
   BOLETOS (TRANSACCIONES EXITOSAS) DEL CLIENTE
====================================================== */
boletos AS (
    SELECT
        CASE 
            WHEN dias = 0 THEN DATE_FORMAT(td.FechaHoraFinal, '%Y-%m-%d %H:00')
            WHEN dias <= 15 THEN DATE(td.FechaHoraFinal)
            WHEN dias <= 60 THEN CONCAT(DATE_FORMAT(td.FechaHoraFinal, '%Y-%m'),
                                        ' Semana ', WEEK(td.FechaHoraFinal, 1))
            ELSE DATE_FORMAT(td.FechaHoraFinal, '%Y-%m')
        END AS periodo,

        COUNT(CASE WHEN td.IdTipoTransaccion = 2 THEN 1 END) AS boletos
    FROM HistoricoTransaccionesDebito td
    INNER JOIN Dispositivos d ON td.NumeroSerieDispositivo = d.NumeroSerie
    CROSS JOIN rango
    WHERE d.IdCliente IN (${placeholders})
      AND td.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' 
                           AND '${fechaFin}T23:59:59Z'
    GROUP BY periodo
)

/* =====================================================
   MERGE FINAL
====================================================== */
SELECT 
    p.periodo,
    COALESCE(a.ascensos, 0) AS ascensos,
    COALESCE(b.boletos, 0) AS boletos
FROM periodos p
LEFT JOIN ascensos a ON a.periodo = p.periodo
LEFT JOIN boletos  b ON b.periodo = p.periodo
ORDER BY p.periodo;

`
    return this.clienteRepository.query(query, [...ids, ...ids, ...ids, ...ids]);
  }

  /////////*/*/*/*/*/*//*//////////////////////////////////////////******/////*/*/*/*/*/*/*/*/*/*/*/*/*/*/*//*/*/**/***/*/****

  private async graficaAsc4(
    fechaInicio: string,
    fechaFin: string,
    idCliente: number
  ) {
    const query = `

WITH rango AS (
    SELECT 
        DATEDIFF('${fechaFin}T23:59:59Z', '${fechaInicio}T00:00:00Z') AS dias
),

transacciones AS (
    SELECT 
        V.Id AS IdViaje,
        H.Monto,
        
        CASE 
            WHEN dias = 0 THEN DATE_FORMAT(H.FechaHoraFinal, '%Y-%m-%d %H:00')     -- Por hora
            WHEN dias <= 15 THEN DATE(H.FechaHoraFinal)                            -- Por día
            WHEN dias <= 60 THEN CONCAT(DATE_FORMAT(H.FechaHoraFinal, '%Y-%m'),
                                        ' Semana ', WEEK(H.FechaHoraFinal, 1))     -- Por semana
            ELSE DATE_FORMAT(H.FechaHoraFinal, '%Y-%m')                            -- Por mes
        END AS periodo

    FROM HistoricoTransaccionesDebito H
    INNER JOIN ViajesTransacciones VT ON VT.IdTransaccionDebito = H.Id
    INNER JOIN Viajes V ON V.Id = VT.IdViaje
    CROSS JOIN rango
    WHERE H.IdTipoTransaccion = 2
      AND H.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'
),

rutas AS (
    SELECT 
        V.Id AS IdViaje,
        R.Id AS IdRuta,
        R.Nombre AS Ruta,

        CASE 
            WHEN dias = 0 THEN DATE_FORMAT(V.Inicio, '%Y-%m-%d %H:00')
            WHEN dias <= 15 THEN DATE(V.Inicio)
            WHEN dias <= 60 THEN CONCAT(DATE_FORMAT(V.Inicio, '%Y-%m'),
                                        ' Semana ', WEEK(V.Inicio, 1))
            ELSE DATE_FORMAT(V.Inicio, '%Y-%m')
        END AS periodo
    FROM Viajes V
    INNER JOIN Derroteros D ON D.Id = V.IdDerrotero
    INNER JOIN Rutas R ON R.Id = D.IdRuta
    CROSS JOIN rango
    WHERE V.Inicio BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'
      AND V.IdCliente IN (${idCliente})
),

ingresos_por_ruta_periodo AS (
    SELECT 
        R.periodo,
        R.Ruta,
        SUM(T.Monto) AS ingresos
    FROM rutas R
    LEFT JOIN transacciones T 
           ON T.IdViaje = R.IdViaje AND T.periodo = R.periodo
    GROUP BY R.periodo, R.Ruta
),

ranked AS (
    SELECT 
        *,
        ROW_NUMBER() OVER (PARTITION BY periodo ORDER BY ingresos DESC) AS rn
    FROM ingresos_por_ruta_periodo
)

SELECT 
    periodo,
    Ruta,
    ROUND(ingresos, 2) AS ingresosTotales
FROM ranked
WHERE rn <= 5
ORDER BY periodo, ingresosTotales DESC;

`
    return this.clienteRepository.query(query);
  }

  private async graficaAsc4SA(
    fechaInicio: string,
    fechaFin: string,
    idCliente: number
  ) {
    const { ids, placeholders } = await this.clienteHijos(idCliente);
    const query = `

WITH rango AS (
    SELECT 
        DATEDIFF('${fechaFin}T23:59:59Z', '${fechaInicio}T00:00:00Z') AS dias
),

transacciones AS (
    SELECT 
        V.Id AS IdViaje,
        H.Monto,
        
        CASE 
            WHEN dias = 0 THEN DATE_FORMAT(H.FechaHoraFinal, '%Y-%m-%d %H:00')     -- Por hora
            WHEN dias <= 15 THEN DATE(H.FechaHoraFinal)                            -- Por día
            WHEN dias <= 60 THEN CONCAT(DATE_FORMAT(H.FechaHoraFinal, '%Y-%m'),
                                        ' Semana ', WEEK(H.FechaHoraFinal, 1))     -- Por semana
            ELSE DATE_FORMAT(H.FechaHoraFinal, '%Y-%m')                            -- Por mes
        END AS periodo

    FROM HistoricoTransaccionesDebito H
    INNER JOIN ViajesTransacciones VT ON VT.IdTransaccionDebito = H.Id
    INNER JOIN Viajes V ON V.Id = VT.IdViaje
    CROSS JOIN rango
    WHERE H.IdTipoTransaccion = 2
      AND H.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'
),

rutas AS (
    SELECT 
        V.Id AS IdViaje,
        R.Id AS IdRuta,
        R.Nombre AS Ruta,

        CASE 
            WHEN dias = 0 THEN DATE_FORMAT(V.Inicio, '%Y-%m-%d %H:00')
            WHEN dias <= 15 THEN DATE(V.Inicio)
            WHEN dias <= 60 THEN CONCAT(DATE_FORMAT(V.Inicio, '%Y-%m'),
                                        ' Semana ', WEEK(V.Inicio, 1))
            ELSE DATE_FORMAT(V.Inicio, '%Y-%m')
        END AS periodo
    FROM Viajes V
    INNER JOIN Derroteros D ON D.Id = V.IdDerrotero
    INNER JOIN Rutas R ON R.Id = D.IdRuta
    CROSS JOIN rango
    WHERE V.Inicio BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'
      AND V.IdCliente IN (${placeholders})
),

ingresos_por_ruta_periodo AS (
    SELECT 
        R.periodo,
        R.Ruta,
        SUM(T.Monto) AS ingresos
    FROM rutas R
    LEFT JOIN transacciones T 
           ON T.IdViaje = R.IdViaje AND T.periodo = R.periodo
    GROUP BY R.periodo, R.Ruta
),

ranked AS (
    SELECT 
        *,
        ROW_NUMBER() OVER (PARTITION BY periodo ORDER BY ingresos DESC) AS rn
    FROM ingresos_por_ruta_periodo
)

SELECT 
    periodo,
    Ruta,
    ROUND(ingresos, 2) AS ingresosTotales
FROM ranked
WHERE rn <= 5
ORDER BY periodo, ingresosTotales DESC;

`
    return this.clienteRepository.query(query, [...ids]);
  }
}
