import { Controller, Get, Param, UseGuards, Request, ParseIntPipe, Post, Body } from '@nestjs/common';
import { MonitoreoService } from './monitoreo.service';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiParam, ApiBody } from '@nestjs/swagger';
import { RecorridoMonitoreoDto } from './dto/recorrido-monitoreo.dto';

@ApiTags('Monitoreo')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('monitoreo')
export class MonitoreoController {
  constructor(private readonly monitoreoService: MonitoreoService) {}

  @Get('list/:cliente')
  @ApiOperation({
    summary: 'Listar posiciones en monitoreo',
    description: 'Obtiene el listado de dispositivos/posiciones en tiempo real para el cliente especificado.',
  })
  @ApiParam({ name: 'cliente', description: 'ID del cliente' })
  @ApiResponse({
    status: 200,
    description: 'Lista de posiciones/dispositivos en monitoreo',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: { type: 'number' }, latitud: { type: 'number' }, longitud: { type: 'number' }, idDispositivo: { type: 'number' } },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findListPosiciones(
    @Param('cliente', ParseIntPipe) cliente: number,
    @Request() req) {
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.monitoreoService.monitoreoListado(+idUser, +cliente, +rol);
  }

  @Post('recorrido')
  @ApiOperation({
    summary: 'Obtener recorrido del día de un dispositivo',
    description: 'Obtiene las posiciones/recorrido del día de un dispositivo para el monitoreo.',
  })
  @ApiBody({
    type: RecorridoMonitoreoDto,
    description: 'Filtros: idDispositivo, fecha (formato YYYY-MM-DD)',
  })
  @ApiResponse({
    status: 201,
    description: 'Recorrido con las posiciones del dispositivo',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: { latitud: { type: 'number' }, longitud: { type: 'number' }, fechaHora: { type: 'string' } },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findKpi(@Body() recorridoMonitoreoDto: RecorridoMonitoreoDto, @Request() req) {
      const cliente = req.user.cliente;
      const idUser = req.user.userId;
      const rol = req.user.rol;
      return this.monitoreoService.monitoreoRecorrido(recorridoMonitoreoDto, +cliente, +rol);
    }

}
