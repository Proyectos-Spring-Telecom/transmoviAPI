import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { RecaudacionDiariaRutaDto } from './dto/recaudacion-diaria-ruta.dto';
import { RecaudacionPorOperadorDto } from './dto/recaudacion-por-operador.dto';
import { RecaudacionPorVehiculoDto } from './dto/recaudacion-por-vehiculo.dto';
import { RecaudacionPorDispositivoDto } from './dto/recaudacion-por-dispositivo.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';

@ApiTags('Reportes')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Post('recaudacion-diaria-ruta')
  @ApiOperation({
    summary: 'Reporte de recaudación diaria por ruta',
    description: 'Genera un reporte de recaudación diaria agrupado por ruta, incluyendo viajes, validaciones, ingresos, ticket promedio, % electrónico y evasión.',
  })
  @ApiBody({
    type: RecaudacionDiariaRutaDto,
    description: 'Filtros para el reporte',
  })
  @ApiResponse({
    status: 200,
    description: 'Reporte generado exitosamente',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: { ruta: { type: 'string' }, viajes: { type: 'number' }, validaciones: { type: 'number' }, ingresos: { type: 'number' }, ticketPromedio: { type: 'number' }, porcentajeElectronico: { type: 'number' }, evasion: { type: 'number' } },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación en los filtros',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async recaudacionDiariaPorRuta(
    @Body() filtros: RecaudacionDiariaRutaDto,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const cliente = req.user.cliente;
    return await this.reportesService.recaudacionDiariaPorRuta(
      filtros,
      Number(cliente),
    );
  }

  @Post('recaudacion-por-operador')
  @ApiOperation({
    summary: 'Reporte de recaudación por operador',
    description: 'Genera un reporte de recaudación agrupado por operador, incluyendo turnos, viajes, validaciones, ingresos, ticket promedio, evasión % y último turno.',
  })
  @ApiBody({
    type: RecaudacionPorOperadorDto,
    description: 'Filtros para el reporte',
  })
  @ApiResponse({
    status: 200,
    description: 'Reporte generado exitosamente',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: { operador: { type: 'string' }, turnos: { type: 'number' }, viajes: { type: 'number' }, validaciones: { type: 'number' }, ingresos: { type: 'number' }, ticketPromedio: { type: 'number' }, evasion: { type: 'number' }, ultimoTurno: { type: 'string' } },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación en los filtros',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async recaudacionPorOperador(
    @Body() filtros: RecaudacionPorOperadorDto,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const cliente = req.user.cliente;
    return await this.reportesService.recaudacionPorOperador(
      filtros,
      Number(cliente),
    );
  }

  @Post('recaudacion-por-vehiculo')
  @ApiOperation({
    summary: 'Reporte de recaudación por vehículo',
    description: 'Genera un reporte de recaudación agrupado por vehículo, incluyendo turnos, viajes, validaciones, ingresos, ticket promedio y horas en servicio.',
  })
  @ApiBody({
    type: RecaudacionPorVehiculoDto,
    description: 'Filtros para el reporte',
  })
  @ApiResponse({
    status: 200,
    description: 'Reporte generado exitosamente',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: { vehiculo: { type: 'string' }, turnos: { type: 'number' }, viajes: { type: 'number' }, validaciones: { type: 'number' }, ingresos: { type: 'number' }, ticketPromedio: { type: 'number' }, horasServicio: { type: 'number' } },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación en los filtros',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async recaudacionPorVehiculo(
    @Body() filtros: RecaudacionPorVehiculoDto,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const cliente = req.user.cliente;
    return await this.reportesService.recaudacionPorVehiculo(
      filtros,
      Number(cliente),
    );
  }

  @Post('recaudacion-por-dispositivo')
  @ApiOperation({
    summary: 'Reporte de recaudación por dispositivo/instalación',
    description: 'Genera un reporte de recaudación agrupado por dispositivo e instalación, incluyendo validaciones, ingresos, última posición y estado.',
  })
  @ApiBody({
    type: RecaudacionPorDispositivoDto,
    description: 'Filtros para el reporte',
  })
  @ApiResponse({
    status: 200,
    description: 'Reporte generado exitosamente',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: { dispositivo: { type: 'string' }, instalacion: { type: 'string' }, validaciones: { type: 'number' }, ingresos: { type: 'number' }, ultimaPosicion: { type: 'object' }, estado: { type: 'string' } },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación en los filtros',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async recaudacionPorDispositivo(
    @Body() filtros: RecaudacionPorDispositivoDto,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const cliente = req.user.cliente;
    return await this.reportesService.recaudacionPorDispositivo(
      filtros,
      Number(cliente),
    );
  }
}
