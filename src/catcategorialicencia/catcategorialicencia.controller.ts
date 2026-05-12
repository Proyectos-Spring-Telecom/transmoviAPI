import { Controller, Get, UseGuards } from '@nestjs/common';
import { CatcategorialicenciaService } from './catcategorialicencia.service';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

@UseGuards(JwtAuthGuard)
@ApiTags('Catálogo categoría licencia')
@Controller('catcategorialicencia')
@ApiBearerAuth('bearer-token')
export class CatcategorialicenciaController {
  constructor(
    private readonly catcategorialicenciaService: CatcategorialicenciaService,
  ) {}

  @Get('list')
  @ApiOperation({
    summary: 'Listar categorías de licencia',
    description:
      'Obtiene el catálogo completo de categorías de licencia (ej: Federal, Estatal). Se usa al registrar licencias de conductores.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de categorías de licencia',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              idCategoriaLicencia: {
                type: 'number',
                description: 'ID de la categoría de licencia',
              },
              nombreCategoriaLicencia: {
                type: 'string',
                description: 'Nombre de la categoría',
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findAll() {
    return this.catcategorialicenciaService.findAllList();
  }
}
