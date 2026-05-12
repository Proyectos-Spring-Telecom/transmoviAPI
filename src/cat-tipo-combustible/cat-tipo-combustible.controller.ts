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
import { CatTipoCombustibleService } from './cat-tipo-combustible.service';
import { CreateCatTipoCombustibleDto } from './dto/create-cat-tipo-combustible.dto';
import { UpdateCatTipoCombustibleDto } from './dto/update-cat-tipo-combustible.dto';
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

@ApiTags('Catálogo tipo combustible')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('cat-tipo-combustible')
export class CatTipoCombustibleController {
  constructor(
    private readonly catTipoCombustibleService: CatTipoCombustibleService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Crear tipo de combustible',
    description:
      'Registra un nuevo tipo en el catálogo (ej: Gasolina Premium, Diésel). El nombre debe ser único. Se usa en mantenimiento de combustible.',
  })
  @ApiBody({
    type: CreateCatTipoCombustibleDto,
    description: 'nombre (obligatorio, máx. 100 caracteres)',
  })
  @ApiResponse({
    status: 201,
    description: 'Tipo de combustible creado exitosamente',
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
  @ApiResponse({
    status: 400,
    description: 'El tipo ya existe o error de validación',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() createCatTipoCombustibleDto: CreateCatTipoCombustibleDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.catTipoCombustibleService.create(
      createCatTipoCombustibleDto,
      idUser,
    );
  }

  @Get('list')
  @ApiOperation({
    summary: 'Listar tipos de combustible',
    description:
      'Obtiene el catálogo completo sin paginación. Ordenado por nombre ascendente.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de tipos de combustible',
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
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findAllList(): Promise<ApiResponseCommon> {
    return this.catTipoCombustibleService.findAllList();
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Listar tipos de combustible paginados',
    description:
      'Obtiene el catálogo paginado. Ordenado por nombre ascendente.',
  })
  @ApiParam({ name: 'page', description: 'Número de página (desde 1)' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de tipos de combustible',
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
    return this.catTipoCombustibleService.findAll(page, limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener tipo de combustible por ID',
    description: 'Obtiene el detalle de un tipo por su ID.',
  })
  @ApiParam({ name: 'id', description: 'ID del tipo de combustible' })
  @ApiResponse({
    status: 200,
    description: 'Tipo de combustible encontrado',
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
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Tipo de combustible no encontrado',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ApiResponseCommon> {
    return this.catTipoCombustibleService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar tipo de combustible',
    description:
      'Modifica el nombre de un tipo existente. El nombre debe seguir siendo único.',
  })
  @ApiParam({ name: 'id', description: 'ID del tipo a actualizar' })
  @ApiBody({
    type: UpdateCatTipoCombustibleDto,
    description: 'nombre (opcional, máx. 100 caracteres)',
  })
  @ApiResponse({
    status: 200,
    description: 'Tipo actualizado correctamente',
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
  @ApiResponse({
    status: 400,
    description: 'El nombre ya existe o error de validación',
  })
  @ApiResponse({
    status: 404,
    description: 'Tipo de combustible no encontrado',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCatTipoCombustibleDto: UpdateCatTipoCombustibleDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.catTipoCombustibleService.update(
      id,
      updateCatTipoCombustibleDto,
      idUser,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar tipo de combustible',
    description:
      'Elimina un tipo del catálogo. No se puede eliminar si está asociado a mantenimientos de combustible.',
  })
  @ApiParam({ name: 'id', description: 'ID del tipo a eliminar' })
  @ApiResponse({
    status: 200,
    description: 'Tipo eliminado correctamente',
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
  @ApiResponse({
    status: 404,
    description: 'Tipo de combustible no encontrado',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.catTipoCombustibleService.remove(id, idUser);
  }
}
