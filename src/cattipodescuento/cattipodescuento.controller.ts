import { Controller, Get, UseGuards } from '@nestjs/common';
import { CattipodescuentoService } from './cattipodescuento.service';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Catálogo tipo descuento')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('cattipodescuento')
export class CattipodescuentoController {
  constructor(private readonly cattipodescuentoService: CattipodescuentoService) {}

  @Get('list')
  @ApiOperation({
    summary: 'Listar tipos de descuento',
    description:
      'Obtiene el catálogo completo de tipos de descuento. Ordenado por ID descendente. Se usa al aplicar descuentos en transacciones o recargas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de tipos de descuento',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              idCatTipoDescuento: { type: 'number', description: 'ID del tipo de descuento' },
              nombreCatTipoDescuento: { type: 'string', description: 'Nombre del tipo de descuento' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findAll() {
    return this.cattipodescuentoService.findAllList();
  }
}
