import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { HistoricoinstalacionesService } from './historicoinstalaciones.service';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';

@ApiTags('Histórico instalaciones')
@UseGuards(JwtAuthGuard)
@Controller('historicoinstalaciones')
export class HistoricoinstalacionesController {
  constructor(
    private readonly historicoinstalacionesService: HistoricoinstalacionesService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar histórico de instalaciones',
    description:
      'Obtiene el listado del historial de cambios de instalaciones (dispositivo, vehículo, BlueVoxs).',
  })
  @ApiResponse({ status: 200, description: 'Lista de registros del histórico' })
  findAll() {
    return this.historicoinstalacionesService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener histórico por ID',
    description:
      'Obtiene el detalle de un registro del histórico de instalaciones por su ID.',
  })
  @ApiParam({ name: 'id', description: 'ID del registro del histórico' })
  @ApiResponse({ status: 200, description: 'Detalle del registro histórico' })
  findOne(@Param('id') id: string) {
    return this.historicoinstalacionesService.findOne(+id);
  }
}
