import { HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { KpiDto } from './dto/kpi.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Clientes } from 'src/entities/Clientes';
import { TransaccionesDebito } from 'src/entities/TransaccionesDebito';
import { Viajes } from 'src/entities/Viajes';
import { Validadores } from 'src/entities/Validadores';
import { Monederos } from 'src/entities/Monederos';
import { Rutas } from 'src/entities/Rutas';
import { Variantes } from 'src/entities/Variantes';
import { CatTiposPasajeros } from 'src/entities/CatTiposPasajeros';
import { Repository } from 'typeorm';
import { EnumFiltros } from 'src/common/estatus.enum';
import { error, log } from 'console';


@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Clientes)
    private readonly clienteRepository: Repository<Clientes>,
    @InjectRepository(TransaccionesDebito)
    private readonly transaccionesDebitoRepository: Repository<TransaccionesDebito>,
    @InjectRepository(Viajes)
    private readonly viajesRepository: Repository<Viajes>,
    @InjectRepository(Validadores)
    private readonly validadoresRepository: Repository<Validadores>,
    @InjectRepository(Monederos)
    private readonly monederosRepository: Repository<Monederos>,
    @InjectRepository(Rutas)
    private readonly rutasRepository: Repository<Rutas>,
    @InjectRepository(Variantes)
    private readonly variantesRepository: Repository<Variantes>,
    @InjectRepository(CatTiposPasajeros)
    private readonly catTiposPasajerosRepository: Repository<CatTiposPasajeros>,
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
      const { graficaIngresosTotales, graficaPasajerosPorRuta, graficaAscensosVsBoleto, dataGripTop5RutasPorIngresos, velocidadPromedioRuta } = data

      //Forzamos a cambiar el id a number
      const graficaIngresos = graficaIngresosTotales.map((item) => ({
        ...item,
        id: Number(item.id),
        validaciones_exitosas: Number(item.validaciones_exitosas),
        validaciones_fallidas: Number(item.validaciones_fallidas),
      }));

      const graficaPasajerosPorRutas = graficaPasajerosPorRuta.map((item) => ({
        ...item,
        idRuta: Number(item.idRuta),
        pasajeros: Number(item.pasajeros),
      }));

      const graficaAscensoBoleto = graficaAscensosVsBoleto.map((item) => ({
        ...item,
        ascensos: Number(item.ascensos),
        boletos: Number(item.boletos),
      }));

      const velocidadPromedioPorRuta = velocidadPromedioRuta.map((item) => ({
        ...item,
        idRuta: Number(item.idRuta),
      }));

      const dataGripTop5RutasPorIngreso = dataGripTop5RutasPorIngresos.map((item) => ({
        ...item,
        idRuta: Number(item.idRuta),
        totalViajes: Number(item.totalViajes),
      }));

      const kpi1 = data.kpi1?.[0] ?? {};
      const kpi2 = data.kpi2?.[0] ?? {};

      return {
        ingresosAlDia: Number(kpi1.ingresosDelDia ?? 0),
        totalMovimientos: Number(kpi1.totalIntentos ?? 0),
        pasajerosValidados: Number(kpi1.pasajerosValidados ?? 0),
        totalMonederosUnicos: Number(kpi1.monederosActivos ?? 0),
        ticketPromedio: Number(kpi1.ticketPromedio ?? 0),
        pasajerosAfiliados: Number(kpi1.monederosConPasajero ?? 0),
        validacionesExitosas: Number(kpi1.validacionesExitosas ?? 0),
        validacionesFallidas: Number(kpi1.validacionesFallidas ?? 0),

        // KPI 2
        unidadesEnServicio: Number(kpi2.unidadesEnServicio ?? 0),
        totalUnidades: Number(kpi2.totalUnidades ?? 0),
        cumplimientoTurnos: Number(kpi2.cumplimientoTurnosPorcentaje ?? 0),
        totalTurnos: Number(kpi2.totalTurnos ?? 0),
        totalTurnosCerrado: Number(kpi2.turnosCerrados ?? 0),
        ocupacionPromedio: Number(kpi2.ocupacionPromedioTotal ?? 0),
        capacidadTeorica: Number(kpi2.capacidadTotalTeorica ?? 0),

        graficaIngresos,
        graficaPasajerosPorRutas,
        graficaAscensoBoleto,
        velocidadPromedioPorRuta,
        dataGripTop5RutasPorIngreso,
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
      let graficaIngresosTotales;
      let graficaPasajerosPorRuta;
      let graficaAscensosVsBoleto;
      let dataGripTop5RutasPorIngresos;
      let velocidadPromedioRuta;
      switch (rol) {
        case 1:
          if (idCliente === cliente) {
            kpi1 = await this.kpiParte1ClientePadre(fechaInicio, fechaFin, idCliente);
            kpi2 = await this.kpiParte2ClientePadre(fechaInicio, fechaFin, idCliente);
            graficaIngresosTotales = await this.graficaIngresosTotalesSA(fechaInicio, fechaFin, idCliente);
            graficaPasajerosPorRuta = await this.graficaPasajerosPorRutaSA(fechaInicio, fechaFin, idCliente);
            graficaAscensosVsBoleto = await this.graficaAscensosVsBoletoSA(fechaInicio, fechaFin, idCliente);
            velocidadPromedioRuta = await this.velocidadPromedioRutaSA(fechaInicio, fechaFin, idCliente);
            dataGripTop5RutasPorIngresos = await this.dataGripTop5RutasPorIngresosSA(fechaInicio, fechaFin, idCliente);
          } else {
            kpi1 = await this.kpiParte1(fechaInicio, fechaFin, idCliente);
            kpi2 = await this.kpi2Parte2(fechaInicio, fechaFin, idCliente);
            graficaIngresosTotales = await this.graficaIngresosTotales(fechaInicio, fechaFin, idCliente);
            graficaPasajerosPorRuta = await this.graficaPasajerosPorRuta(fechaInicio, fechaFin, idCliente);
            graficaAscensosVsBoleto = await this.graficaAscensosVsBoleto(fechaInicio, fechaFin, idCliente);
            velocidadPromedioRuta = await this.velocidadPromedioRuta(fechaInicio, fechaFin, idCliente);
            dataGripTop5RutasPorIngresos = await this.dataGripTop5RutasPorIngresos(fechaInicio, fechaFin, idCliente);
          }

          break;
        case 2:
          if (idCliente === cliente) {
            kpi1 = await this.kpiParte1ClientePadre(fechaInicio, fechaFin, idCliente);
            kpi2 = await this.kpiParte2ClientePadre(fechaInicio, fechaFin, idCliente);
            graficaIngresosTotales = await this.graficaIngresosTotalesSA(fechaInicio, fechaFin, idCliente);
            graficaPasajerosPorRuta = await this.graficaPasajerosPorRutaSA(fechaInicio, fechaFin, idCliente);
            graficaAscensosVsBoleto = await this.graficaAscensosVsBoletoSA(fechaInicio, fechaFin, idCliente);
            velocidadPromedioRuta = await this.velocidadPromedioRutaSA(fechaInicio, fechaFin, idCliente);
            dataGripTop5RutasPorIngresos = await this.dataGripTop5RutasPorIngresosSA(fechaInicio, fechaFin, idCliente);
          } else {
            kpi1 = await this.kpiParte1(fechaInicio, fechaFin, idCliente);
            kpi2 = await this.kpi2Parte2(fechaInicio, fechaFin, idCliente);
            graficaIngresosTotales = await this.graficaIngresosTotales(fechaInicio, fechaFin, idCliente);
            graficaPasajerosPorRuta = await this.graficaPasajerosPorRuta(fechaInicio, fechaFin, idCliente);
            graficaAscensosVsBoleto = await this.graficaAscensosVsBoleto(fechaInicio, fechaFin, idCliente);
            velocidadPromedioRuta = await this.velocidadPromedioRuta(fechaInicio, fechaFin, idCliente);
            dataGripTop5RutasPorIngresos = await this.dataGripTop5RutasPorIngresos(fechaInicio, fechaFin, idCliente);
          }
          break;

        default:
          kpi1 = await this.kpiParte1(fechaInicio, fechaFin, idCliente);
          kpi2 = await this.kpi2Parte2(fechaInicio, fechaFin, idCliente);
          graficaIngresosTotales = await this.graficaIngresosTotales(fechaInicio, fechaFin, idCliente);
          graficaPasajerosPorRuta = await this.graficaPasajerosPorRuta(fechaInicio, fechaFin, idCliente);
          graficaAscensosVsBoleto = await this.graficaAscensosVsBoleto(fechaInicio, fechaFin, idCliente);
          velocidadPromedioRuta = await this.velocidadPromedioRuta(fechaInicio, fechaFin, idCliente);
          dataGripTop5RutasPorIngresos = await this.dataGripTop5RutasPorIngresos(fechaInicio, fechaFin, idCliente);
          break;
      }
      return { kpi1, kpi2, graficaIngresosTotales, graficaPasajerosPorRuta, graficaAscensosVsBoleto, dataGripTop5RutasPorIngresos, velocidadPromedioRuta }

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


  private async kpiParte1ClientePadre(
    fechaInicio: string,
    fechaFin: string,
    idCliente: number
  ) {
    const { ids, placeholders } = await this.clienteHijos(idCliente);
    const query = `
    -- kpi parte 1 para usuarios super administrador y administrador
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
    ROUND(SUM(CASE WHEN td.IdTipoTransaccion = 3 THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0) * 100, 2) AS porcentajeFallidas,
    (
        SELECT COUNT(*)
        FROM Monederos m
        WHERE m.IdCliente = c.Id
          AND m.Estatus = 1
          AND m.FechaCreacion <= '${fechaFin}T23:59:59Z'
    ) AS monederosActivos,
     (
    SELECT COUNT(*)
    FROM Monederos m
    WHERE m.IdCliente = c.Id
      AND m.Estatus = 1
      AND m.FechaCreacion <= '2025-12-05T23:59:59Z'
      AND m.IdPasajero IS NOT NULL
) AS monederosConPasajero
FROM HistoricoTransaccionesDebito td
INNER JOIN Validadores d ON td.NumeroSerieValidador = d.NumeroSerie
INNER JOIN Clientes c ON d.IdCliente = c.Id
WHERE td.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'
  AND c.Id IN (${placeholders})
  GROUP BY c.Id;`

    return this.clienteRepository.query(query, [...ids]);
  }

  private async kpiParte2ClientePadre(
    fechaInicio: string,
    fechaFin: string,
    idCliente: number
  ) {
    const { ids, placeholders } = await this.clienteHijos(idCliente);
    const query = `
    -- Kpi parte 2
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
	COUNT(DISTINCT t.Id) AS totalTurnos,
    COUNT(DISTINCT CASE WHEN t.Fin IS NOT NULL THEN t.Id END) AS turnosCerrados,
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

    ROUND(AVG(o.ocupacionPromedio), 2) AS ocupacionPromedioTotal,
    ROUND(AVG(v.PasajerosSentados + v.PasajerosParados)) AS capacidadTotalTeorica

FROM Vehiculos v
LEFT JOIN Instalaciones i ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente AND i.Estatus = 1
LEFT JOIN Validadores d ON d.Id = i.idValidador
LEFT JOIN Posiciones up ON up.NumeroSerieValidador = d.NumeroSerie

    AND up.FechaHora >= NOW() - INTERVAL 15 MINUTE
LEFT JOIN Turnos t ON t.IdCliente = v.IdCliente
    AND t.Estatus = 1
    AND t.Inicio >= '${fechaInicio}T00:00:00Z'
    AND t.Inicio < '${fechaFin}T23:59:59Z'
LEFT JOIN Ocupacion o ON o.IdCliente = v.IdCliente AND o.idVehiculo = v.Id
WHERE v.Estatus = 1
  AND v.IdCliente IN (${placeholders});
`
    return this.clienteRepository.query(query, [...ids]);
  }

  /////////*/*/*/*/*/*//*//////////////////////////////////////////******/////*/*/*/*/*/*/*/*/*/*/*/*/*/*/*//*/*/**/***/*/****
  private async kpiParte1(
    fechaInicio: string,
    fechaFin: string,
    idCliente: number
  ) {

    const query = `
    -- kpi parte 1
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
    ROUND(SUM(CASE WHEN td.IdTipoTransaccion = 3 THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0) * 100, 2) AS porcentajeFallidas,
    (
        SELECT COUNT(*)
        FROM Monederos m
        WHERE m.IdCliente = c.Id
          AND m.Estatus = 1
          AND m.FechaCreacion <= '${fechaFin}T23:59:59Z'
    ) AS monederosActivos,
     (
    SELECT COUNT(*)
    FROM Monederos m
    WHERE m.IdCliente = c.Id
      AND m.Estatus = 1
      AND m.FechaCreacion <= '2025-12-05T23:59:59Z'
      AND m.IdPasajero IS NOT NULL
) AS monederosConPasajero
FROM HistoricoTransaccionesDebito td
INNER JOIN Validadores d ON td.NumeroSerieValidador = d.NumeroSerie
INNER JOIN Clientes c ON d.IdCliente = c.Id
WHERE td.FechaHoraFinal BETWEEN '${fechaInicio}T00:00:00Z' AND '${fechaFin}T23:59:59Z'
  AND c.Id IN (${idCliente})
  
  GROUP BY c.Id;
`

    return this.clienteRepository.query(query,);
  }

  private async kpi2Parte2(
    fechaInicio: string,
    fechaFin: string,
    idCliente: number
  ) {
    const query = `

    -- Kpi parte 2
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
	COUNT(DISTINCT t.Id) AS totalTurnos,
    COUNT(DISTINCT CASE WHEN t.Fin IS NOT NULL THEN t.Id END) AS turnosCerrados,
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

    ROUND(AVG(o.ocupacionPromedio), 2) AS ocupacionPromedioTotal,
    ROUND(AVG(v.PasajerosSentados + v.PasajerosParados)) AS capacidadTotalTeorica

FROM Vehiculos v
LEFT JOIN Instalaciones i ON i.IdVehiculo = v.Id AND i.IdCliente = v.IdCliente AND i.Estatus = 1
LEFT JOIN Validadores d ON d.Id = i.idValidador
LEFT JOIN Posiciones up ON up.NumeroSerieValidador = d.NumeroSerie

    AND up.FechaHora >= NOW() - INTERVAL 15 MINUTE
LEFT JOIN Turnos t ON t.IdCliente = v.IdCliente
    AND t.Estatus = 1
    AND t.Inicio >= '${fechaInicio}T00:00:00Z'
    AND t.Inicio < '${fechaFin}T23:59:59Z'
LEFT JOIN Ocupacion o ON o.IdCliente = v.IdCliente AND o.idVehiculo = v.Id
WHERE v.Estatus = 1
  AND v.IdCliente IN (${idCliente});
`
    return this.clienteRepository.query(query);
  }

  /////////*/*/*/*/*/*//*//////////////////////////////////////////******/////*/*/*/*/*/*/*/*/*/*/*/*/*/*/*//*/*/**/***/*/****

  private async graficaIngresosTotales(
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
    INNER JOIN Validadores d ON td.NumeroSerieValidador = d.NumeroSerie
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

  private async graficaIngresosTotalesSA(
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
    INNER JOIN Validadores d ON td. = d.NumeroSerie
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

  private async graficaPasajerosPorRuta(
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
            WHEN dias = 0 THEN DATE_FORMAT(cp.FechaHora, '%Y-%m-%d %H:00')          -- Por hora
            WHEN dias <= 15 THEN DATE(cp.FechaHora)       -- Por día
            WHEN dias <= 60 THEN CONCAT(DATE_FORMAT(cp.FechaHora, '%Y-%m'), ' Semana ', WEEK(cp.FechaHora, 1)) -- Por semana
            ELSE DATE_FORMAT(cp.FechaHora, '%Y-%m')       -- Por mes
        END AS periodo,

        SUM(cp.Entradas - cp.Salidas) AS pasajeros
    FROM ConteoPasajeros cp
    INNER JOIN rango ON 1=1
    INNER JOIN Contadores c ON cp.NumeroSerieContador = c.NumeroSerie
    INNER JOIN Instalaciones i ON c.Id = i.IdContador
    INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id
    INNER JOIN Turnos t ON i.Id = t.IdInstalacion AND t.Estatus = 1
    INNER JOIN Viajes vi ON t.Id = vi.IdTurno AND vi.Estatus = 1
    INNER JOIN Variantes d ON vi.IdVariante = d.Id AND d.Estatus = 1
    INNER JOIN Rutas r ON d.IdRuta = r.Id AND r.Estatus = 1
    INNER JOIN Clientes c ON v.IdCliente = c.Id AND c.Estatus = 1
    WHERE cp.FechaHora BETWEEN '${fechaInicio}T00:00:00' AND '${fechaFin}T23:59:59'
      AND c.Id IN (${idCliente})
      AND v.Estatus = 1
      AND i.Estatus = 1
    GROUP BY r.Id, r.Nombre,
        CASE
            WHEN dias = 0 THEN DATE_FORMAT(cp.FechaHora, '%Y-%m-%d %H:00')
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

  private async graficaPasajerosPorRutaSA(
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
            WHEN dias = 0 THEN DATE_FORMAT(cp.FechaHora, '%Y-%m-%d %H:00')          -- Por hora
            WHEN dias <= 15 THEN DATE(cp.FechaHora)       -- Por día
            WHEN dias <= 60 THEN CONCAT(DATE_FORMAT(cp.FechaHora, '%Y-%m'), ' Semana ', WEEK(cp.FechaHora, 1)) -- Por semana
            ELSE DATE_FORMAT(cp.FechaHora, '%Y-%m')       -- Por mes
        END AS periodo,

        SUM(cp.Entradas - cp.Salidas) AS pasajeros
    FROM ConteoPasajeros cp
    INNER JOIN rango ON 1=1
    INNER JOIN Contadores c ON cp.NumeroSerieContador = c.NumeroSerie
    INNER JOIN Instalaciones i ON c.Id = i.IdContador
    INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id
    INNER JOIN Turnos t ON i.Id = t.IdInstalacion AND t.Estatus = 1
    INNER JOIN Viajes vi ON t.Id = vi.IdTurno AND vi.Estatus = 1
    INNER JOIN Variantes d ON vi.IdVariante = d.Id AND d.Estatus = 1
    INNER JOIN Rutas r ON d.IdRuta = r.Id AND r.Estatus = 1
    INNER JOIN Clientes c ON v.IdCliente = c.Id AND c.Estatus = 1
    WHERE cp.FechaHora BETWEEN '${fechaInicio}T00:00:00' AND '${fechaFin}T23:59:59'
      AND c.Id IN (${placeholders})
      AND v.Estatus = 1
      AND i.Estatus = 1
    GROUP BY r.Id, r.Nombre,
        CASE
            WHEN dias = 0 THEN DATE_FORMAT(cp.FechaHora, '%Y-%m-%d %H:00')
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

  private async graficaAscensosVsBoleto(
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
        INNER JOIN Contadores c ON cp.NumeroSerieContador = c.NumeroSerie
        WHERE bv.IdCliente IN (${idCliente})
          AND cp.FechaHora BETWEEN '${fechaInicio}T00:00:00Z' 
                               AND '${fechaFin}T23:59:59Z'
        
        UNION
        
        SELECT td.FechaHoraFinal AS fecha
        FROM HistoricoTransaccionesDebito td
        INNER JOIN Validadores d ON td.NumeroSerieValidador = d.NumeroSerie
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
    INNER JOIN Contadores c ON cp.NumeroSerieContador = c.NumeroSerie
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
    INNER JOIN Validadores d ON td.NumeroSerieValidador = d.NumeroSerie
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

  private async graficaAscensosVsBoletoSA(
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
        INNER JOIN Contadores c ON cp.NumeroSerieContador = c.NumeroSerie
        WHERE bv.IdCliente IN (${placeholders})
          AND cp.FechaHora BETWEEN '${fechaInicio}T00:00:00Z' 
                               AND '${fechaFin}T23:59:59Z'
        
        UNION
        
        SELECT td.FechaHoraFinal AS fecha
        FROM HistoricoTransaccionesDebito td
        INNER JOIN Validadores d ON td.NumeroSerieValidador = d.NumeroSerie
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
    INNER JOIN Contadores c ON cp.NumeroSerieContador = c.NumeroSerie
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
    INNER JOIN Validadores d ON td.NumeroSerieValidador = d.NumeroSerie
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

  private async dataGripTop5RutasPorIngresos(
    fechaInicio: string,
    fechaFin: string,
    idCliente: number
  ) {
    const query = `

WITH ingresos AS (
    SELECT 
        r.Id AS idRuta,
        r.Nombre AS ruta,
        COUNT(DISTINCT v.Id) AS totalViajes,
        SUM(td.Monto) AS ingresosTotales
    FROM HistoricoTransaccionesDebito td
    JOIN ViajesTransacciones vt 
            ON vt.IdTransaccionDebito = td.Id
    JOIN Viajes v 
            ON v.Id = vt.IdViaje
    JOIN Variantes d 
            ON d.Id = v.IdVariante
    JOIN Rutas r 
            ON r.Id = d.IdRuta
    JOIN Regiones reg 
            ON reg.Id = r.IdRegion
    WHERE td.IdTipoTransaccion = 2
      AND td.FechaHoraFinal BETWEEN '${fechaInicio} 00:00:00' AND '${fechaFin} 23:59:59'
      AND reg.IdCliente IN (${idCliente})     -- DISCRIMINACIÓN POR CLIENTE
    GROUP BY r.Id, r.Nombre
)

SELECT *
FROM ingresos
ORDER BY ingresosTotales DESC
LIMIT 5;

`
    return await this.clienteRepository.query(query);
  }

  private async dataGripTop5RutasPorIngresosSA(
    fechaInicio: string,
    fechaFin: string,
    idCliente: number
  ) {
    const { ids, placeholders } = await this.clienteHijos(idCliente);
    const query = `
WITH ingresos AS (
    SELECT 
        r.Id AS idRuta,
        r.Nombre AS ruta,
        COUNT(DISTINCT v.Id) AS totalViajes,
        SUM(td.Monto) AS ingresosTotales
    FROM HistoricoTransaccionesDebito td
    JOIN ViajesTransacciones vt 
            ON vt.IdTransaccionDebito = td.Id
    JOIN Viajes v 
            ON v.Id = vt.IdViaje
    JOIN Variantes d 
            ON d.Id = v.IdVariante
    JOIN Rutas r 
            ON r.Id = d.IdRuta
    JOIN Regiones reg 
            ON reg.Id = r.IdRegion
    WHERE td.IdTipoTransaccion = 2
      AND td.FechaHoraFinal BETWEEN '${fechaInicio} 00:00:00' AND '${fechaFin} 23:59:59'
      AND reg.IdCliente IN (${placeholders})     -- DISCRIMINACIÓN POR CLIENTE
    GROUP BY r.Id, r.Nombre
)

SELECT *
FROM ingresos
ORDER BY ingresosTotales DESC
LIMIT 5;

`
    return await this.clienteRepository.query(query, [...ids]);
  }

  /////////*/*/*/*/*/*//*//////////////////////////////////////////******/////*/*/*/*/*/*/*/*/*/*/*/*/*/*/*//*/*/**/***/*/****

  private async velocidadPromedioRuta(
    fechaInicio: string,
    fechaFin: string,
    idCliente: number
  ) {
    const query = `

WITH rango AS (
    SELECT DATEDIFF('${fechaFin}T23:59:59', '${fechaInicio}T00:00:00') AS dias
),

VelocidadRuta AS (
    SELECT
        r.Id AS idRuta,
        r.Nombre AS ruta,

        /* PERIODO DINÁMICO */
        CASE
            WHEN dias = 0 THEN DATE_FORMAT(p.FechaHora, '%Y-%m-%d %H:00')          -- Por hora
            WHEN dias <= 15 THEN DATE(p.FechaHora)                                 -- Por día
            WHEN dias <= 60 THEN CONCAT(DATE_FORMAT(p.FechaHora, '%Y-%m'), ' Semana ', WEEK(p.FechaHora, 1))
            ELSE DATE_FORMAT(p.FechaHora, '%Y-%m')                                  -- Por mes
        END AS periodo,

        ROUND(AVG(p.Velocidad), 2) AS velocidad_promedio

    FROM Posiciones p
    INNER JOIN rango ON 1=1
    INNER JOIN Validadores d ON p.NumeroSerieValidador = d.NumeroSerie
    INNER JOIN Instalaciones i ON d.Id = i.idValidador AND d.IdCliente = i.IdCliente
    INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id AND v.IdCliente = d.IdCliente
    INNER JOIN Turnos t ON i.Id = t.IdInstalacion AND t.Estatus = 1
    INNER JOIN Viajes vi ON t.Id = vi.IdTurno AND vi.Estatus = 1
    INNER JOIN Variantes drr ON vi.IdVariante = drr.Id AND drr.Estatus = 1
    INNER JOIN Rutas r ON drr.IdRuta = r.Id AND r.Estatus = 1
    INNER JOIN Clientes c ON c.Id = d.IdCliente AND c.Estatus = 1

    WHERE p.FechaHora BETWEEN '${fechaInicio}T00:00:00' AND '${fechaFin}T23:59:59'
      AND c.Id IN (${idCliente})
      AND v.Estatus = 1
      AND i.Estatus = 1
      AND d.Estatus = 1

    GROUP BY 
        r.Id, r.Nombre,
        CASE
            WHEN dias = 0 THEN DATE_FORMAT(p.FechaHora, '%Y-%m-%d %H:00')
            WHEN dias <= 15 THEN DATE(p.FechaHora)
            WHEN dias <= 60 THEN CONCAT(DATE_FORMAT(p.FechaHora, '%Y-%m'), ' Semana ', WEEK(p.FechaHora, 1))
            ELSE DATE_FORMAT(p.FechaHora, '%Y-%m')
        END
)

SELECT *
FROM VelocidadRuta
ORDER BY periodo, ruta;

`
    return this.clienteRepository.query(query);
  }

  private async velocidadPromedioRutaSA(
    fechaInicio: string,
    fechaFin: string,
    idCliente: number
  ) {
    const { ids, placeholders } = await this.clienteHijos(idCliente);
    const query = `

WITH rango AS (
    SELECT DATEDIFF('${fechaFin}T23:59:59', '${fechaInicio}T00:00:00') AS dias
),

VelocidadRuta AS (
    SELECT
        r.Id AS idRuta,
        r.Nombre AS ruta,

        /* PERIODO DINÁMICO */
        CASE
            WHEN dias = 0 THEN DATE_FORMAT(p.FechaHora, '%Y-%m-%d %H:00')          -- Por hora
            WHEN dias <= 15 THEN DATE(p.FechaHora)                                 -- Por día
            WHEN dias <= 60 THEN CONCAT(DATE_FORMAT(p.FechaHora, '%Y-%m'), ' Semana ', WEEK(p.FechaHora, 1))
            ELSE DATE_FORMAT(p.FechaHora, '%Y-%m')                                  -- Por mes
        END AS periodo,

        ROUND(AVG(p.Velocidad), 2) AS velocidad_promedio

    FROM Posiciones p
    INNER JOIN rango ON 1=1
    INNER JOIN Validadores d ON p.NumeroSerieValidador = d.NumeroSerie
    INNER JOIN Instalaciones i ON d.Id = i.idValidador AND d.IdCliente = i.IdCliente
    INNER JOIN Vehiculos v ON i.IdVehiculo = v.Id AND v.IdCliente = d.IdCliente
    INNER JOIN Turnos t ON i.Id = t.IdInstalacion AND t.Estatus = 1
    INNER JOIN Viajes vi ON t.Id = vi.IdTurno AND vi.Estatus = 1
    INNER JOIN Variantes drr ON vi.IdVariante = drr.Id AND drr.Estatus = 1
    INNER JOIN Rutas r ON drr.IdRuta = r.Id AND r.Estatus = 1
    INNER JOIN Clientes c ON c.Id = d.IdCliente AND c.Estatus = 1

    WHERE p.FechaHora BETWEEN '${fechaInicio}T00:00:00' AND '${fechaFin}T23:59:59'
      AND c.Id IN (${placeholders})
      AND v.Estatus = 1
      AND i.Estatus = 1
      AND d.Estatus = 1

    GROUP BY 
        r.Id, r.Nombre,
        CASE
            WHEN dias = 0 THEN DATE_FORMAT(p.FechaHora, '%Y-%m-%d %H:00')
            WHEN dias <= 15 THEN DATE(p.FechaHora)
            WHEN dias <= 60 THEN CONCAT(DATE_FORMAT(p.FechaHora, '%Y-%m'), ' Semana ', WEEK(p.FechaHora, 1))
            ELSE DATE_FORMAT(p.FechaHora, '%Y-%m')
        END
)

SELECT *
FROM VelocidadRuta
ORDER BY periodo, ruta;

`
    return this.clienteRepository.query(query, [...ids, ...ids, ...ids, ...ids]);
  }

  // ========================================
  // 🔹 OBTENER MÉTRICAS DEL DASHBOARD
  // ========================================
  async getDashboardMetrics(
    idUser: number,
    cliente: number,
    rol: number,
    filtro: string = 'hoy',
  ) {
    try {
      // Calcular fechas según el filtro
      const { fechaInicio, fechaFin } = this.calcularFechasPorFiltro(filtro);

      let clienteFilter = '';
      let clienteFilter2 = ''; // Para la segunda parte del UNION ALL
      let clienteParams: any[] = [];

      // Para rol 2 en adelante, filtrar por idCliente
      if (rol !== 1) {
        const { ids, placeholders } = await this.clienteHijos(cliente);
        if (ids && ids.length > 0) {
          clienteFilter = `AND c.Id IN (${placeholders})`;
          clienteFilter2 = `AND c2.Id IN (${placeholders})`;
          clienteParams = [...ids];
        } else {
          // Si no hay clientes hijos, retornar datos vacíos
          return {
            ticketPromedio: { ticketPromedio: 0, totalTransacciones: 0, ingresosTotales: 0 },
            porcentajeMonederoVirtual: { totalDebitos: 0, debitosVirtuales: 0, porcentajeVirtual: 0 },
            viajesAbiertos: { viajesAbiertos: 0, totalValidadores: 0, porcentajeViajesActivos: 0 },
            top5Rutas: [],
            pasajerosPorRutaTipo: [],
          };
        }
      }

      // 1. Costo del ticket promedio (de TransaccionesDebito)
      const ticketPromedio = await this.getTicketPromedio(clienteFilter, clienteFilter2, clienteParams, fechaInicio, fechaFin);

      // 2. Porcentaje de débitos con monedero virtual (EsQR = 1)
      const porcentajeMonederoVirtual = await this.getPorcentajeMonederoVirtual(clienteFilter, clienteFilter2, clienteParams, fechaInicio, fechaFin);

      // 3. Viajes abiertos en últimos 15 minutos vs posibles según número de validadores
      const viajesAbiertos = await this.getViajesAbiertos(clienteFilter, clienteParams);

      // 4. Top 5 rutas con más ingresos
      const top5Rutas = await this.getTop5RutasIngresos(clienteFilter, clienteFilter2, clienteParams, fechaInicio, fechaFin);

      // 5. Pasajeros por ruta según tipo de pasajero (gráfica apilada)
      const pasajerosPorRutaTipo = await this.getPasajerosPorRutaTipo(clienteFilter, clienteFilter2, clienteParams, fechaInicio, fechaFin);

      return {
        ticketPromedio,
        porcentajeMonederoVirtual,
        viajesAbiertos,
        top5Rutas,
        pasajerosPorRutaTipo,
      };
    } catch (error) {
      console.error('Error en getDashboardMetrics:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Ocurrió un error al obtener las métricas del dashboard.',
        error: error.message,
      });
    }
  }

  // Calcular fechas según el filtro
  private calcularFechasPorFiltro(filtro: string): { fechaInicio: string; fechaFin: string } {
    function pad(n: number) {
      return n < 10 ? '0' + n : n;
    }
    
    const ahora = new Date();
    const desfaseMs = -6 * 60 * 60 * 1000; // -6 horas
    const fechaDesfasada = new Date(ahora.getTime() + desfaseMs);
    
    let fechaInicio: string;
    let fechaFin: string;

    switch (filtro) {
      case 'ultimos7dias':
        // Últimos 7 días
        const hace7Dias = new Date(fechaDesfasada.getTime() - 7 * 24 * 60 * 60 * 1000);
        fechaInicio = `${hace7Dias.getFullYear()}-${pad(hace7Dias.getMonth() + 1)}-${pad(hace7Dias.getDate())}`;
        fechaFin = `${fechaDesfasada.getFullYear()}-${pad(fechaDesfasada.getMonth() + 1)}-${pad(fechaDesfasada.getDate())}`;
        break;
      
      case 'mesActual':
        // Mes actual
        fechaInicio = `${fechaDesfasada.getFullYear()}-${pad(fechaDesfasada.getMonth() + 1)}-01`;
        fechaFin = `${fechaDesfasada.getFullYear()}-${pad(fechaDesfasada.getMonth() + 1)}-${pad(fechaDesfasada.getDate())}`;
        break;
      
      case 'añoActual':
        // Año actual
        fechaInicio = `${fechaDesfasada.getFullYear()}-01-01`;
        fechaFin = `${fechaDesfasada.getFullYear()}-${pad(fechaDesfasada.getMonth() + 1)}-${pad(fechaDesfasada.getDate())}`;
        break;
      
      default: // 'hoy'
        // Hoy
        fechaInicio = `${fechaDesfasada.getFullYear()}-${pad(fechaDesfasada.getMonth() + 1)}-${pad(fechaDesfasada.getDate())}`;
        fechaFin = `${fechaDesfasada.getFullYear()}-${pad(fechaDesfasada.getMonth() + 1)}-${pad(fechaDesfasada.getDate())}`;
        break;
    }

    return { fechaInicio, fechaFin };
  }

  // 1. Costo del ticket promedio
  private async getTicketPromedio(
    clienteFilter: string, 
    clienteFilter2: string, 
    clienteParams: any[],
    fechaInicio: string,
    fechaFin: string,
  ) {
    const query = `
      SELECT 
        ROUND(AVG(monto), 2) AS ticketPromedio,
        COUNT(*) AS totalTransacciones,
        SUM(monto) AS ingresosTotales
      FROM (
        SELECT td.Monto AS monto
        FROM TransaccionesDebito td
        INNER JOIN Validadores v ON td.NumeroSerieValidador = v.NumeroSerie
        INNER JOIN Clientes c ON v.IdCliente = c.Id
        WHERE td.IdTipoTransaccion = 2
          AND DATE(td.FechaHoraFinal) BETWEEN '${fechaInicio}' AND '${fechaFin}'
          ${clienteFilter}
        UNION ALL
        SELECT htd.Monto AS monto
        FROM HistoricoTransaccionesDebito htd
        INNER JOIN Validadores v2 ON htd.NumeroSerieValidador = v2.NumeroSerie
        INNER JOIN Clientes c2 ON v2.IdCliente = c2.Id
        WHERE htd.IdTipoTransaccion = 2
          AND DATE(htd.FechaHoraFinal) BETWEEN '${fechaInicio}' AND '${fechaFin}'
          ${clienteFilter2}
      ) AS todas_transacciones
    `;
    const params = clienteParams.length > 0 ? [...clienteParams, ...clienteParams] : [];
    const result = await this.clienteRepository.query(query, params);
    return result[0] || { ticketPromedio: 0, totalTransacciones: 0, ingresosTotales: 0 };
  }

  // 2. Porcentaje de débitos con monedero virtual (EsQR = 1)
  private async getPorcentajeMonederoVirtual(
    clienteFilter: string, 
    clienteFilter2: string, 
    clienteParams: any[],
    fechaInicio: string,
    fechaFin: string,
  ) {
    const query = `
      SELECT 
        COUNT(*) AS totalDebitos,
        SUM(CASE WHEN esQR = 1 THEN 1 ELSE 0 END) AS debitosVirtuales,
        ROUND(
          SUM(CASE WHEN esQR = 1 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) * 100,
          2
        ) AS porcentajeVirtual
      FROM (
        SELECT td.EsQR AS esQR
        FROM TransaccionesDebito td
        INNER JOIN Validadores v ON td.NumeroSerieValidador = v.NumeroSerie
        INNER JOIN Clientes c ON v.IdCliente = c.Id
        WHERE td.IdTipoTransaccion = 2
          AND DATE(td.FechaHoraFinal) BETWEEN '${fechaInicio}' AND '${fechaFin}'
          ${clienteFilter}
        UNION ALL
        SELECT htd.EsQR AS esQR
        FROM HistoricoTransaccionesDebito htd
        INNER JOIN Validadores v2 ON htd.NumeroSerieValidador = v2.NumeroSerie
        INNER JOIN Clientes c2 ON v2.IdCliente = c2.Id
        WHERE htd.IdTipoTransaccion = 2
          AND DATE(htd.FechaHoraFinal) BETWEEN '${fechaInicio}' AND '${fechaFin}'
          ${clienteFilter2}
      ) AS todas_transacciones
    `;
    const params = clienteParams.length > 0 ? [...clienteParams, ...clienteParams] : [];
    const result = await this.clienteRepository.query(query, params);
    return result[0] || { totalDebitos: 0, debitosVirtuales: 0, porcentajeVirtual: 0 };
  }

  // 3. Viajes abiertos en últimos 15 minutos vs posibles según número de validadores
  private async getViajesAbiertos(clienteFilter: string, clienteParams: any[]) {
    // Primero obtener el total de validadores
    const validadoresQuery = `
      SELECT COUNT(DISTINCT val.Id) AS total
      FROM Validadores val
      INNER JOIN Clientes c ON val.IdCliente = c.Id
      WHERE val.Estatus = 1
        ${clienteFilter}
    `;
    const validadoresResult = await this.clienteRepository.query(validadoresQuery, clienteParams);
    const totalValidadores = Number(validadoresResult[0]?.total) || 0;

    // Luego obtener los viajes abiertos
    const viajesQuery = `
      SELECT COUNT(DISTINCT v.Id) AS total
      FROM Viajes v
      INNER JOIN Clientes c ON v.IdCliente = c.Id
      WHERE v.Estatus = 1
        AND v.Fin IS NULL
        AND v.Inicio >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)
        ${clienteFilter}
    `;
    const viajesResult = await this.clienteRepository.query(viajesQuery, clienteParams);
    const viajesAbiertos = Number(viajesResult[0]?.total) || 0;

    return {
      viajesAbiertos,
      totalValidadores,
      porcentajeViajesActivos: totalValidadores > 0 
        ? Number(((viajesAbiertos / totalValidadores) * 100).toFixed(2))
        : 0,
    };
  }

  // 4. Top 5 rutas con más ingresos
  private async getTop5RutasIngresos(
    clienteFilter: string, 
    clienteFilter2: string, 
    clienteParams: any[],
    fechaInicio: string,
    fechaFin: string,
  ) {
    const query = `
      SELECT 
        r.Id AS idRuta,
        r.Nombre AS nombreRuta,
        SUM(monto) AS ingresosTotales,
        COUNT(DISTINCT idViaje) AS totalViajes
      FROM (
        SELECT td.Monto AS monto, td.IdViaje AS idViaje, td.NumeroSerieValidador
        FROM TransaccionesDebito td
        INNER JOIN Validadores val ON td.NumeroSerieValidador = val.NumeroSerie
        INNER JOIN Clientes c ON val.IdCliente = c.Id
        WHERE td.IdTipoTransaccion = 2
          AND td.IdViaje IS NOT NULL
          AND DATE(td.FechaHoraFinal) BETWEEN '${fechaInicio}' AND '${fechaFin}'
          ${clienteFilter}
        UNION ALL
        SELECT htd.Monto AS monto, htd.IdViaje AS idViaje, htd.NumeroSerieValidador
        FROM HistoricoTransaccionesDebito htd
        INNER JOIN Validadores val2 ON htd.NumeroSerieValidador = val2.NumeroSerie
        INNER JOIN Clientes c2 ON val2.IdCliente = c2.Id
        WHERE htd.IdTipoTransaccion = 2
          AND htd.IdViaje IS NOT NULL
          AND DATE(htd.FechaHoraFinal) BETWEEN '${fechaInicio}' AND '${fechaFin}'
          ${clienteFilter2}
      ) AS todas_transacciones
      INNER JOIN Viajes v ON todas_transacciones.idViaje = v.Id
      INNER JOIN Variantes var ON v.IdVariante = var.Id
      INNER JOIN Rutas r ON var.IdRuta = r.Id
      GROUP BY r.Id, r.Nombre
      ORDER BY ingresosTotales DESC
      LIMIT 5
    `;
    const params = clienteParams.length > 0 ? [...clienteParams, ...clienteParams] : [];
    return await this.clienteRepository.query(query, params);
  }

  // 5. Pasajeros por ruta según tipo de pasajero (gráfica apilada)
  private async getPasajerosPorRutaTipo(
    clienteFilter: string, 
    clienteFilter2: string, 
    clienteParams: any[],
    fechaInicio: string,
    fechaFin: string,
  ) {
    const query = `
      SELECT 
        r.Id AS idRuta,
        r.Nombre AS nombreRuta,
        ctp.Id AS idTipoPasajero,
        ctp.Nombre AS tipoPasajero,
        COUNT(DISTINCT todas_transacciones.numeroSerieMonedero) AS cantidadPasajeros
      FROM (
        SELECT td.NumeroSerieMonedero AS numeroSerieMonedero, td.IdViaje AS idViaje, m.IdTipoPasajero AS idTipoPasajero, m.IdCliente AS idCliente
        FROM TransaccionesDebito td
        INNER JOIN Monederos m ON td.NumeroSerieMonedero = m.NumeroSerie
        INNER JOIN Clientes c ON m.IdCliente = c.Id
        WHERE td.IdTipoTransaccion = 2
          AND td.IdViaje IS NOT NULL
          AND DATE(td.FechaHoraFinal) BETWEEN '${fechaInicio}' AND '${fechaFin}'
          ${clienteFilter}
        UNION ALL
        SELECT htd.NumeroSerieMonedero AS numeroSerieMonedero, htd.IdViaje AS idViaje, m2.IdTipoPasajero AS idTipoPasajero, m2.IdCliente AS idCliente
        FROM HistoricoTransaccionesDebito htd
        INNER JOIN Monederos m2 ON htd.NumeroSerieMonedero = m2.NumeroSerie
        INNER JOIN Clientes c2 ON m2.IdCliente = c2.Id
        WHERE htd.IdTipoTransaccion = 2
          AND htd.IdViaje IS NOT NULL
          AND DATE(htd.FechaHoraFinal) BETWEEN '${fechaInicio}' AND '${fechaFin}'
          ${clienteFilter2}
      ) AS todas_transacciones
      INNER JOIN Viajes v ON todas_transacciones.idViaje = v.Id
      INNER JOIN Variantes var ON v.IdVariante = var.Id
      INNER JOIN Rutas r ON var.IdRuta = r.Id
      INNER JOIN CatTiposPasajeros ctp ON todas_transacciones.idTipoPasajero = ctp.Id
      GROUP BY r.Id, r.Nombre, ctp.Id, ctp.Nombre
      ORDER BY r.Nombre, ctp.Nombre
    `;
    const params = clienteParams.length > 0 ? [...clienteParams, ...clienteParams] : [];
    return await this.clienteRepository.query(query, params);
  }
}
