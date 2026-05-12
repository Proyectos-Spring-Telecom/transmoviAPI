import {
  Controller,
  Get,
  UseGuards,
  Param,
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import { BitacoraLoggerService } from './bitacora.service';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiResponseCommon } from 'src/common/ApiResponse';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Bitácora')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('bitacora')
export class BitacoraController {
  constructor(private readonly bitacoraService: BitacoraLoggerService) {}

  @Get('list')
  @ApiOperation({
    summary: 'Listar todos los registros de bitácora',
    description:
      'Obtiene el listado completo de registros de la bitácora sin paginación. SuperAdministrador ve todas las acciones; otros roles ven solo las de usuarios de su cliente y clientes hijos. Ordenado por fecha descendente.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de registros de bitácora',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', description: 'ID del registro' },
              modulo: { type: 'string', description: 'Módulo del sistema' },
              descripcion: {
                type: 'string',
                description: 'Descripción de la acción',
              },
              accion: {
                type: 'string',
                description: 'Tipo de acción (CREATE, UPDATE, DELETE)',
              },
              query: {
                type: 'object',
                description: 'Detalle técnico o query ejecutada',
              },
              fechaCreacion: {
                type: 'string',
                description: 'Fecha y hora del registro',
              },
              estatus: { type: 'string', description: 'success o error' },
              error: {
                type: 'string',
                nullable: true,
                description: 'Mensaje de error si aplica',
              },
              idUsuario: { type: 'number' },
              nombreUsuario: { type: 'string' },
              apellidoPaternoUsuario: { type: 'string' },
              apellidoMaternoUsuario: { type: 'string' },
              UserNameUsuario: { type: 'string' },
              idModulo: { type: 'number' },
              nombreModulo: { type: 'string' },
              descripcionModulo: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllListBitacora(@Request() req): Promise<ApiResponseCommon> {
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return await this.bitacoraService.findAllListBitacora(+cliente, +rol);
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Listar bitácora con paginación',
    description:
      'Obtiene los registros de la bitácora paginados. SuperAdministrador ve todo; otros roles solo registros de usuarios de su cliente y clientes hijos.',
  })
  @ApiParam({ name: 'page', description: 'Número de página (desde 1)' })
  @ApiParam({ name: 'limit', description: 'Cantidad de registros por página' })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de registros de bitácora',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              modulo: { type: 'string' },
              descripcion: { type: 'string' },
              accion: { type: 'string' },
              query: { type: 'object' },
              fechaCreacion: { type: 'string' },
              estatus: { type: 'string' },
              error: { type: 'string', nullable: true },
              idUsuario: { type: 'number' },
              nombreUsuario: { type: 'string' },
              apellidoPaternoUsuario: { type: 'string' },
              apellidoMaternoUsuario: { type: 'string' },
              UserNameUsuario: { type: 'string' },
              idModulo: { type: 'number' },
              nombreModulo: { type: 'string' },
              descripcionModulo: { type: 'string' },
            },
          },
        },
        paginated: {
          type: 'object',
          properties: {
            total: { type: 'number', description: 'Total de registros' },
            page: { type: 'number', description: 'Página actual' },
            lastPage: { type: 'number', description: 'Última página' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.bitacoraService.findAll(+cliente, +rol, page, limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener registro de bitácora por ID',
    description: 'Obtiene el detalle de un registro específico de la bitácora.',
  })
  @ApiParam({ name: 'id', description: 'ID del registro de bitácora' })
  @ApiResponse({
    status: 200,
    description: 'Registro de bitácora encontrado',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              modulo: { type: 'string' },
              descripcion: { type: 'string' },
              accion: { type: 'string' },
              query: { type: 'object' },
              fechaCreacion: { type: 'string' },
              estatus: { type: 'string' },
              error: { type: 'string', nullable: true },
              idUsuario: { type: 'number' },
              nombreUsuario: { type: 'string' },
              apellidoPaternoUsuario: { type: 'string' },
              apellidoMaternoUsuario: { type: 'string' },
              UserNameUsuario: { type: 'string' },
              idModulo: { type: 'number' },
              nombreModulo: { type: 'string' },
              descripcionModulo: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Registro no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return await this.bitacoraService.findOne(id);
  }
}
