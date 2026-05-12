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
import { CatTipoVerificacionesService } from './cat-tipo-verificaciones.service';
import { CreateCatTipoVerificacionesDto } from './dto/create-cat-tipo-verificaciones.dto';
import { UpdateCatTipoVerificacionesDto } from './dto/update-cat-tipo-verificaciones.dto';
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

@ApiTags('Catálogo tipo verificaciones')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('cat-tipo-verificaciones')
export class CatTipoVerificacionesController {
  constructor(
    private readonly catTipoVerificacionesService: CatTipoVerificacionesService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Crear tipo de verificación',
    description:
      'Registra un nuevo tipo de verificación en el catálogo (ej: Verificación Técnica, Verificación Física). El nombre debe ser único.',
  })
  @ApiBody({
    type: CreateCatTipoVerificacionesDto,
    description: 'nombre (obligatorio, máx. 100 caracteres)',
  })
  @ApiResponse({
    status: 201,
    description: 'Tipo de verificación creado exitosamente',
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
    description: 'El tipo de verificación ya existe o error de validación',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async create(
    @Body() createCatTipoVerificacionesDto: CreateCatTipoVerificacionesDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.catTipoVerificacionesService.create(
      createCatTipoVerificacionesDto,
      idUser,
    );
  }

  @Get('list')
  @ApiOperation({
    summary: 'Listar tipos de verificación',
    description:
      'Obtiene el catálogo completo de tipos de verificación sin paginación. Ordenado por nombre ascendente.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de tipos de verificación',
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
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  findAllList(): Promise<ApiResponseCommon> {
    return this.catTipoVerificacionesService.findAllList();
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Listar tipos de verificación paginados',
    description:
      'Obtiene el catálogo paginado de tipos de verificación. Ordenado por nombre ascendente.',
  })
  @ApiParam({ name: 'page', description: 'Número de página (desde 1)' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de tipos de verificación',
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
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
  ): Promise<ApiResponseCommon> {
    return this.catTipoVerificacionesService.findAll(page, limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener tipo de verificación por ID',
    description: 'Obtiene el detalle de un tipo de verificación por su ID.',
  })
  @ApiParam({ name: 'id', description: 'ID del tipo de verificación' })
  @ApiResponse({
    status: 200,
    description: 'Tipo de verificación encontrado',
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
  @ApiResponse({
    status: 404,
    description: 'Tipo de verificación no encontrado',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ApiResponseCommon> {
    return this.catTipoVerificacionesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar tipo de verificación',
    description:
      'Modifica el nombre de un tipo de verificación existente. El nombre debe seguir siendo único.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del tipo de verificación a actualizar',
  })
  @ApiBody({
    type: UpdateCatTipoVerificacionesDto,
    description: 'nombre (opcional, máx. 100 caracteres)',
  })
  @ApiResponse({
    status: 200,
    description: 'Tipo de verificación actualizado correctamente',
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
    description: 'Tipo de verificación no encontrado',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCatTipoVerificacionesDto: UpdateCatTipoVerificacionesDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.catTipoVerificacionesService.update(
      id,
      updateCatTipoVerificacionesDto,
      idUser,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar tipo de verificación',
    description:
      'Elimina permanentemente un tipo de verificación del catálogo.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del tipo de verificación a eliminar',
  })
  @ApiResponse({
    status: 200,
    description: 'Tipo de verificación eliminado correctamente',
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
    description: 'Tipo de verificación no encontrado',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.catTipoVerificacionesService.remove(id, idUser);
  }
}
