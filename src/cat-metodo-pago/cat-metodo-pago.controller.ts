import { Controller, Get, UseGuards } from '@nestjs/common';
import { CatMetodoPagoService } from './cat-metodo-pago.service';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('Catálogo metodo pago')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('catmetodopago')
export class CatMetodoPagoController {
  constructor(private readonly catMetodoPagoService: CatMetodoPagoService) {}

  @Get('list')
  @ApiOperation({
    summary: 'Listar métodos de pago',
    description:
      'Obtiene el catálogo completo de métodos de pago (ej: Efectivo, Tarjeta, Transferencia). Se usa al registrar transacciones de recarga.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de métodos de pago',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', description: 'ID del método de pago' },
              nombre: {
                type: 'string',
                description: 'Nombre del método (Efectivo, Tarjeta, etc.)',
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'No se encontraron métodos de pago',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findAll() {
    return this.catMetodoPagoService.findAll();
  }
}
