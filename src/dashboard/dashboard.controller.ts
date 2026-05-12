import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { KpiDto } from './dto/kpi.dto';

@ApiTags('Dashboard')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Post('kpi')
  @ApiOperation({
    summary: 'Obtener KPIs del dashboard',
    description:
      'Obtiene los indicadores y gráficas del dashboard para un cliente. Se puede filtrar por rango de fechas (fechaInicio, fechaFin) o por filtro predefinido: 1=Al día, 2=Semana, 3=Mes. Si se envían fechas, prevalecen sobre el filtro.',
  })
  @ApiBody({
    type: KpiDto,
    description:
      'idCliente (obligatorio), fechaInicio y fechaFin (opcionales, formato YYYY-MM-DD), filtro (opcional: 1=Al día, 2=Semana, 3=Mes)',
  })
  @ApiResponse({
    status: 200,
    description: 'KPIs y datos para gráficas obtenidos exitosamente',
    schema: {
      type: 'object',
      properties: {
        ingresosAlDia: {
          type: 'number',
          description: 'Ingresos totales del período',
        },
        totalMovimientos: {
          type: 'number',
          description: 'Total de intentos de validación',
        },
        pasajerosValidados: {
          type: 'number',
          description: 'Monederos únicos con validación exitosa',
        },
        totalMonederosUnicos: {
          type: 'number',
          description: 'Monederos activos',
        },
        ticketPromedio: {
          type: 'number',
          description: 'Ticket promedio por pasajero',
        },
        pasajerosAfiliados: {
          type: 'number',
          description: 'Monederos con pasajero asociado',
        },
        validacionesExitosas: {
          type: 'number',
          description: 'Validaciones exitosas (tipo 2)',
        },
        validacionesFallidas: {
          type: 'number',
          description: 'Validaciones fallidas (tipo 3)',
        },
        unidadesEnServicio: {
          type: 'number',
          description: 'Unidades actualmente en servicio',
        },
        totalUnidades: {
          type: 'number',
          description: 'Total de unidades del cliente',
        },
        cumplimientoTurnos: {
          type: 'number',
          description: 'Porcentaje de turnos cerrados',
        },
        totalTurnos: { type: 'number', description: 'Total de turnos' },
        totalTurnosCerrado: { type: 'number', description: 'Turnos cerrados' },
        ocupacionPromedio: {
          type: 'number',
          description: 'Ocupación promedio de vehículos',
        },
        capacidadTeorica: {
          type: 'number',
          description: 'Capacidad teórica total',
        },
        porcentajePagos: {
          type: 'object',
          properties: {
            efectivo: {
              type: 'number',
              description: 'Porcentaje pagos en efectivo',
            },
            otrosMetodos: {
              type: 'number',
              description: 'Porcentaje pagos con otros métodos',
            },
          },
        },
        graficaIngresos: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              periodo: { type: 'string' },
              ingresos: { type: 'number' },
              validaciones_exitosas: { type: 'number' },
              validaciones_fallidas: { type: 'number' },
              ticket_promedio: { type: 'number' },
            },
          },
        },
        graficaPasajerosPorRutas: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              idRuta: { type: 'number' },
              ruta: { type: 'string' },
              periodo: { type: 'string' },
              pasajeros: { type: 'number' },
            },
          },
        },
        graficaAscensoBoleto: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              periodo: { type: 'string' },
              ascensos: { type: 'number' },
              boletos: { type: 'number' },
            },
          },
        },
        velocidadPromedioPorRuta: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              idRuta: { type: 'number' },
              ruta: { type: 'string' },
              periodo: { type: 'string' },
              velocidad_promedio: { type: 'number' },
            },
          },
        },
        dataGripTop5RutasPorIngreso: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              idRuta: { type: 'number' },
              ruta: { type: 'string' },
              totalViajes: { type: 'number' },
              ingresosTotales: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor' })
  findKpi(@Body() kpiDto: KpiDto, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.dashboardService.dashboardkpi(kpiDto, +rol, +cliente);
  }
}
