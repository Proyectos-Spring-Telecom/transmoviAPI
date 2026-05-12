import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  Request,
  Query,
  Res,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ModulosService } from './modulos.service';
import { CreateModuloDto } from './dto/create-modulo.dto';
import { UpdateModuloDto } from './dto/update-modulo.dto';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { UpdateModulosEstatusDto } from './dto/update-modulo-estatus.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';

@ApiTags('Modulos')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('modulos')
export class ModulosController {
  constructor(private readonly modulosService: ModulosService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear módulo',
    description:
      'Registra un nuevo módulo del sistema con nombre, descripción y estatus.',
  })
  @ApiBody({
    type: CreateModuloDto,
    description: 'nombre, descripción, estatus (0 ó 1, opcional)',
  })
  @ApiResponse({
    status: 201,
    description: 'Módulo creado exitosamente',
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
  @ApiResponse({ status: 400, description: 'Error de validación' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() createModuloDto: CreateModuloDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.modulosService.create(createModuloDto, idUser);
  }

  @Get('list')
  @ApiOperation({
    summary: 'Listar módulos',
    description:
      'Obtiene el listado de todos los módulos activos sin paginación.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de módulos',
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
    return this.modulosService.findAllList();
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Listar módulos paginados',
    description: 'Obtiene el catálogo paginado de módulos del sistema.',
  })
  @ApiParam({ name: 'page', description: 'Número de página (desde 1)' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de módulos',
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
              descripcion: { type: 'string' },
              estatus: { type: 'number' },
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
    return this.modulosService.findAll(page, limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener módulo por ID',
    description: 'Obtiene el detalle de un módulo por su ID.',
  })
  @ApiParam({ name: 'id', description: 'ID del módulo' })
  @ApiResponse({
    status: 200,
    description: 'Detalle del módulo',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            nombre: { type: 'string' },
            descripcion: { type: 'string' },
            estatus: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Módulo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findOne(@Param('id') id: string) {
    return this.modulosService.findOne(+id);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar módulo',
    description: 'Modifica los datos de un módulo existente.',
  })
  @ApiParam({ name: 'id', description: 'ID del módulo a actualizar' })
  @ApiBody({
    type: UpdateModuloDto,
    description: 'Campos a actualizar: nombre, descripción, estatus',
  })
  @ApiResponse({
    status: 200,
    description: 'Módulo actualizado correctamente',
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
  @ApiResponse({ status: 404, description: 'Módulo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateModuloDto: UpdateModuloDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.modulosService.update(id, updateModuloDto, idUser);
  }

  @Patch(':id/estatus')
  @ApiOperation({
    summary: 'Actualizar estatus del módulo',
    description: 'Cambia el estatus de un módulo (0=Inactivo, 1=Activo).',
  })
  @ApiParam({ name: 'id', description: 'ID del módulo' })
  @ApiBody({
    type: UpdateModulosEstatusDto,
    description: 'estatus (0 ó 1)',
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
  @ApiResponse({ status: 404, description: 'Módulo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateModuloEstatus(
    @Param('id') id: string,
    @Request() req,
    @Body() updateModulosEstatusDto: UpdateModulosEstatusDto,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.modulosService.updateModulosStatus(
      +id,
      idUser,
      updateModulosEstatusDto,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar módulo',
    description: 'Elimina un módulo del sistema.',
  })
  @ApiParam({ name: 'id', description: 'ID del módulo a eliminar' })
  @ApiResponse({
    status: 200,
    description: 'Módulo eliminado correctamente',
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
  @ApiResponse({ status: 404, description: 'Módulo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.modulosService.deleteModulo(id, idUser);
  }
}
