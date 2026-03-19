import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Request,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { CatReferenciaServicioService } from './cat-referencia-servicio.service';
import { CreateCatReferenciaServicioDto } from './dto/create-cat-referencia-servicio.dto';
import { UpdateCatReferenciaServicioDto } from './dto/update-cat-referencia-servicio.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';

@ApiTags('Catálogo referencia servicio')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('cat-referencia-servicio')
export class CatReferenciaServicioController {
  constructor(
    private readonly catReferenciaServicioService: CatReferenciaServicioService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Crear referencia de servicio',
    description:
      'Registra una nueva referencia en el catálogo (ej: Cambio de Aceite, Revisión). El nombre debe ser único. Se usa en mantenimiento vehicular.',
  })
  @ApiBody({
    type: CreateCatReferenciaServicioDto,
    description: 'nombre (obligatorio), estatus (opcional, 0 ó 1)',
  })
  @ApiResponse({
    status: 201,
    description: 'Referencia creada exitosamente',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: { id: { type: 'number' }, nombre: { type: 'string' } },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'La referencia ya existe o error de validación' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() createCatReferenciaServicioDto: CreateCatReferenciaServicioDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.catReferenciaServicioService.create(
      createCatReferenciaServicioDto,
      idUser,
    );
  }

  @Get('list')
  @ApiOperation({
    summary: 'Listar referencias de servicio',
    description:
      'Obtiene el catálogo completo de referencias activas (estatus=1) sin paginación. Ordenado por nombre ascendente.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de referencias de servicio',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              nombre: { type: 'string' },
              estatus: { type: 'number' },
              fhRegistro: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findAllList(): Promise<ApiResponseCommon> {
    return this.catReferenciaServicioService.findAllList();
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Listar referencias de servicio paginadas',
    description: 'Obtiene el catálogo paginado. Ordenado por nombre ascendente.',
  })
  @ApiParam({ name: 'page', description: 'Número de página (desde 1)' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de referencias de servicio',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              nombre: { type: 'string' },
              estatus: { type: 'number' },
              fhRegistro: { type: 'string' },
            },
          },
        },
        paginated: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page: { type: 'number' },
            lastPage: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
  ): Promise<ApiResponseCommon> {
    return this.catReferenciaServicioService.findAll(page, limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener referencia de servicio por ID',
    description: 'Obtiene el detalle de una referencia por su ID.',
  })
  @ApiParam({ name: 'id', description: 'ID de la referencia de servicio' })
  @ApiResponse({
    status: 200,
    description: 'Referencia encontrada',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              nombre: { type: 'string' },
              estatus: { type: 'number' },
              fhRegistro: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Referencia no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ApiResponseCommon> {
    return this.catReferenciaServicioService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar referencia de servicio',
    description: 'Modifica nombre y/o estatus de una referencia existente. El nombre debe seguir siendo único.',
  })
  @ApiParam({ name: 'id', description: 'ID de la referencia a actualizar' })
  @ApiBody({
    type: UpdateCatReferenciaServicioDto,
    description: 'nombre (opcional), estatus (opcional, 0 ó 1)',
  })
  @ApiResponse({
    status: 200,
    description: 'Referencia actualizada correctamente',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: { id: { type: 'number' }, nombre: { type: 'string' } },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'El nombre ya existe o error de validación' })
  @ApiResponse({ status: 404, description: 'Referencia no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCatReferenciaServicioDto: UpdateCatReferenciaServicioDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.catReferenciaServicioService.update(
      id,
      updateCatReferenciaServicioDto,
      idUser,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar referencia de servicio',
    description: 'Elimina una referencia del catálogo. No se puede eliminar si está asociada a mantenimientos vehiculares.',
  })
  @ApiParam({ name: 'id', description: 'ID de la referencia a eliminar' })
  @ApiResponse({
    status: 200,
    description: 'Referencia eliminada correctamente',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: { id: { type: 'number' }, nombre: { type: 'string' } },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Referencia no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.catReferenciaServicioService.remove(id, idUser);
  }
}
