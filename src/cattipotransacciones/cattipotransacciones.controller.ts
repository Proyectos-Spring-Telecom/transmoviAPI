import { Controller, Get, UseGuards } from '@nestjs/common';
import { CattipotransaccionesService } from './cattipotransacciones.service';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('Catálogo tipo transacciones')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('cattipotransacciones')
export class CattipotransaccionesController {
  constructor(
    private readonly cattipotransaccionesService: CattipotransaccionesService,
  ) {}

  @Get('list')
  @ApiOperation({
    summary: 'Listar tipos de transacción',
    description:
      'Obtiene el catálogo completo de tipos de transacción (ej: Recarga, Viaje, Descuento). Ordenado por nombre ascendente. Se usa al registrar transacciones de débito o recarga.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de tipos de transacción',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              idCatTiposTransacciones: {
                type: 'number',
                description: 'ID del tipo de transacción',
              },
              nombreCatTiposTransacciones: {
                type: 'string',
                description: 'Nombre del tipo de transacción',
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findAllList() {
    return this.cattipotransaccionesService.findAllList();
  }
}
