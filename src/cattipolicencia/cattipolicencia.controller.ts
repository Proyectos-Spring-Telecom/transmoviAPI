import { Controller, Get, UseGuards } from '@nestjs/common';
import { CattipolicenciaService } from './cattipolicencia.service';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Catálogo tipo licencia')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('cattipolicencia')
export class CattipolicenciaController {
  constructor(private readonly cattipolicenciaService: CattipolicenciaService) {}

  @Get('list')
  @ApiOperation({
    summary: 'Listar tipos de licencia',
    description:
      'Obtiene el catálogo completo de tipos de licencia (ej: Profesional, Particular). Ordenado por nombre ascendente. Se usa al registrar licencias de conductores.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de tipos de licencia',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              idCatTipoLicencia: { type: 'number', description: 'ID del tipo de licencia' },
              nombreCatTipoLicencia: { type: 'string', description: 'Nombre del tipo de licencia' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findAllList() {
    return this.cattipolicenciaService.findAllList();
  }
}
