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
import { CatEstatusMantenimientoService } from './cat-estatus-mantenimiento.service';
import { CreateCatEstatusMantenimientoDto } from './dto/create-cat-estatus-mantenimiento.dto';
import { UpdateCatEstatusMantenimientoDto } from './dto/update-cat-estatus-mantenimiento.dto';
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

@ApiTags('Catálogo estatus mantenimiento')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('cat-estatus-mantenimiento')
export class CatEstatusMantenimientoController {
  constructor(
    private readonly catEstatusMantenimientoService: CatEstatusMantenimientoService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Crear estatus de mantenimiento',
    description:
      'Registra un nuevo estatus en el catálogo (ej: En Proceso, Completado, Cancelado). El nombre debe ser único. Se usa en mantenimiento vehicular.',
  })
  @ApiBody({
    type: CreateCatEstatusMantenimientoDto,
    description: 'Nombre del estatus (máx. 50 caracteres)',
    examples: {
      ejemplo: { value: { nombre: 'En Proceso' }, summary: 'Estatus en proceso' },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Estatus creado exitosamente',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        message: { type: 'string', example: 'Estatus de mantenimiento creado correctamente' },
        data: {
          type: 'object',
          properties: { id: { type: 'number' }, nombre: { type: 'string' } },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Nombre ya existe o error de validación' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() createCatEstatusMantenimientoDto: CreateCatEstatusMantenimientoDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.catEstatusMantenimientoService.create(
      createCatEstatusMantenimientoDto,
      idUser,
    );
  }

  @Get('list')
  @ApiOperation({
    summary: 'Listar todos los estatus de mantenimiento',
    description:
      'Obtiene el listado completo del catálogo sin paginación. Ordenado por nombre ascendente.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de estatus de mantenimiento',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', description: 'ID del estatus' },
              nombre: { type: 'string', description: 'Nombre del estatus' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findAllList(): Promise<ApiResponseCommon> {
    return this.catEstatusMantenimientoService.findAllList();
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Listar estatus de mantenimiento paginados',
    description: 'Obtiene el catálogo paginado. Ordenado por nombre ascendente.',
  })
  @ApiParam({ name: 'page', description: 'Número de página (desde 1)' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de estatus de mantenimiento',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: { type: 'number' }, nombre: { type: 'string' } },
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
    return this.catEstatusMantenimientoService.findAll(page, limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener estatus de mantenimiento por ID',
    description: 'Obtiene el detalle de un registro del catálogo por su ID.',
  })
  @ApiParam({ name: 'id', description: 'ID del estatus de mantenimiento' })
  @ApiResponse({
    status: 200,
    description: 'Estatus encontrado',
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
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Estatus no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ApiResponseCommon> {
    return this.catEstatusMantenimientoService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar estatus de mantenimiento',
    description: 'Modifica el nombre de un estatus existente. El nombre debe seguir siendo único.',
  })
  @ApiParam({ name: 'id', description: 'ID del estatus a actualizar' })
  @ApiBody({
    type: UpdateCatEstatusMantenimientoDto,
    description: 'Nombre actualizado (máx. 50 caracteres)',
    examples: {
      ejemplo: { value: { nombre: 'Completado' }, summary: 'Cambiar nombre' },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Estatus actualizado correctamente',
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
  @ApiResponse({ status: 400, description: 'Nombre ya existe o error de validación' })
  @ApiResponse({ status: 404, description: 'Estatus no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCatEstatusMantenimientoDto: UpdateCatEstatusMantenimientoDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.catEstatusMantenimientoService.update(
      id,
      updateCatEstatusMantenimientoDto,
      idUser,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar estatus de mantenimiento',
    description:
      'Elimina un registro del catálogo. No se puede eliminar si está asociado a mantenimientos vehiculares.',
  })
  @ApiParam({ name: 'id', description: 'ID del estatus a eliminar' })
  @ApiResponse({
    status: 200,
    description: 'Estatus eliminado correctamente',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        message: { type: 'string' },
        data: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Estatus no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.catEstatusMantenimientoService.remove(id, idUser);
  }
}
