import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Put,
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import { PermisosService } from './permisos.service';
import { CreatePermisoDto } from './dto/create-permiso.dto';
import { UpdatePermisoDto } from './dto/update-permiso.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { UpdatePermisoEstatusDto } from './dto/update-permiso-estatus.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';

@ApiTags('Permisos')
@ApiBearerAuth('bearer-token')
@Controller('permisos')
@UseGuards(JwtAuthGuard)
export class PermisosController {
  constructor(private readonly permisosService: PermisosService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear permiso',
    description: 'Registra un nuevo permiso del sistema asociado a un módulo.',
  })
  @ApiBody({
    type: CreatePermisoDto,
    description: 'nombre, descripción, idModulo, estatus, etc.',
  })
  @ApiResponse({
    status: 201,
    description: 'Permiso creado exitosamente',
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
  async createPermioso(
    @Body() createPermiso: CreatePermisoDto,
    @Req() req,
  ): Promise<ApiCrudResponse> {
    const idUsuario = req.user.userId;
    return this.permisosService.createPermiso(createPermiso, idUsuario);
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Listar permisos paginados',
    description: 'Obtiene el catálogo paginado de permisos del sistema.',
  })
  @ApiParam({ name: 'page', description: 'Número de página (desde 1)' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de permisos',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: { type: 'number' }, nombre: { type: 'string' }, idModulo: { type: 'number' }, estatus: { type: 'number' } },
          },
        },
        paginated: {
          type: 'object',
          properties: { total: { type: 'number' }, page: { type: 'number' }, lastPage: { type: 'number' } },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
  ): Promise<ApiResponseCommon> {
    return await this.permisosService.findAll(page, limit);
  }

  @Get('list')
  @ApiOperation({
    summary: 'Listar permisos',
    description: 'Obtiene el listado de todos los permisos activos sin paginación.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de permisos',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: { type: 'number' }, nombre: { type: 'string' }, idModulo: { type: 'number' } },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllList(): Promise<ApiResponseCommon> {
    return await this.permisosService.findAllList();
  }

  @Get('permisosAgrupados')
  @ApiOperation({
    summary: 'Obtener permisos agrupados por módulo',
    description: 'Obtiene los permisos del usuario actual agrupados por módulo.',
  })
  @ApiResponse({
    status: 200,
    description: 'Permisos agrupados por módulo',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: { modulo: { type: 'string' }, permisos: { type: 'array', items: { type: 'object' } } },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllAgrupado(@Req() req): Promise<any[]> {
    const idUsuario = req.user.userId;
    const permiso =
      await this.permisosService.obtenerPermisosAgrupados(idUsuario);
    return permiso;
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener permiso por ID',
    description: 'Obtiene el detalle de un permiso por su ID.',
  })
  @ApiParam({ name: 'id', description: 'ID del permiso' })
  @ApiResponse({
    status: 200,
    description: 'Detalle del permiso',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: { id: { type: 'number' }, nombre: { type: 'string' }, idModulo: { type: 'number' }, estatus: { type: 'number' } },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Permiso no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOne(@Param('id') id: string) {
    return await this.permisosService.findOne(+id);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar permiso',
    description: 'Modifica los datos de un permiso existente.',
  })
  @ApiParam({ name: 'id', description: 'ID del permiso a actualizar' })
  @ApiBody({
    type: UpdatePermisoDto,
    description: 'Campos a actualizar: nombre, descripción, idModulo, estatus',
  })
  @ApiResponse({
    status: 200,
    description: 'Permiso actualizado correctamente',
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
  @ApiResponse({ status: 404, description: 'Permiso no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePermisoDto: UpdatePermisoDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.permisosService.update(id, updatePermisoDto, idUser);
  }

  @Patch(':id/estatus')
  @ApiOperation({
    summary: 'Actualizar estatus del permiso',
    description: 'Cambia el estatus de un permiso (0=Inactivo, 1=Activo).',
  })
  @ApiParam({ name: 'id', description: 'ID del permiso' })
  @ApiBody({
    type: UpdatePermisoEstatusDto,
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
  @ApiResponse({ status: 404, description: 'Permiso no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updatePermisoEstatus(
    @Param('id') id: string,
    @Request() req,
    @Body() updatePermisoEstatusDto: UpdatePermisoEstatusDto,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.permisosService.updateEstatus(
      +id,
      idUser,
      updatePermisoEstatusDto,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar permiso',
    description: 'Eliminación lógica: cambia el estatus del permiso a inactivo.',
  })
  @ApiParam({ name: 'id', description: 'ID del permiso a eliminar' })
  @ApiResponse({
    status: 200,
    description: 'Permiso eliminado correctamente',
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
  @ApiResponse({ status: 404, description: 'Permiso no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  remove(@Param('id') id: string, @Request() req): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.permisosService.remove(+id, idUser);
  }
}
