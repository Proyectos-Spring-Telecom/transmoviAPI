import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Request,
  Put,
  UseGuards,
  Res,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRolDto } from './dto/create-rol.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { UpdateRolEstatusDto } from './dto/update-rol.dto';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Roles')
@ApiBearerAuth('bearer-token')
@Controller('roles')
@UseGuards(JwtAuthGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear rol',
    description:
      'Registra un nuevo rol del sistema con sus permisos asociados.',
  })
  @ApiBody({
    type: CreateRolDto,
    description:
      'nombre, descripción, idCliente, permisos (array), estatus, etc.',
  })
  @ApiResponse({
    status: 201,
    description: 'Rol creado exitosamente',
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
  create(@Body() createRoleDto: CreateRolDto, @Request() req) {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.rolesService.create(idUser, createRoleDto);
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Listar roles paginados',
    description:
      'Obtiene el catálogo paginado de roles. El acceso depende del rol del usuario.',
  })
  @ApiParam({ name: 'page', description: 'Número de página (desde 1)' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de roles',
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
              idCliente: { type: 'number' },
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
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return await this.rolesService.findAll(+rol, page, limit);
  }

  @Get('list')
  @ApiOperation({
    summary: 'Listar roles',
    description:
      'Obtiene el listado de roles activos sin paginación. El acceso depende del rol del usuario.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de roles',
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
              idCliente: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllList(@Request() req): Promise<ApiResponseCommon> {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return await this.rolesService.findAllList(+rol);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener rol por ID',
    description:
      'Obtiene el detalle de un rol por su ID, incluyendo permisos asociados.',
  })
  @ApiParam({ name: 'id', description: 'ID del rol' })
  @ApiResponse({
    status: 200,
    description: 'Detalle del rol',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            nombre: { type: 'string' },
            idCliente: { type: 'number' },
            estatus: { type: 'number' },
            permisos: { type: 'array' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Rol no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar rol',
    description: 'Modifica los datos de un rol existente, incluyendo permisos.',
  })
  @ApiParam({ name: 'id', description: 'ID del rol a actualizar' })
  @ApiBody({
    type: UpdateRoleDto,
    description: 'Campos a actualizar: nombre, descripción, permisos, estatus',
  })
  @ApiResponse({
    status: 200,
    description: 'Rol actualizado correctamente',
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
  @ApiResponse({ status: 404, description: 'Rol no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRoleDto: UpdateRoleDto,
    @Request() req,
  ) {
    const idUser = req.user.userId;
    return this.rolesService.update(id, idUser, updateRoleDto);
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Actualizar estatus del rol',
    description: 'Cambia el estatus de un rol (0=Inactivo, 1=Activo).',
  })
  @ApiParam({ name: 'id', description: 'ID del rol' })
  @ApiBody({
    type: UpdateRolEstatusDto,
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
  @ApiResponse({ status: 404, description: 'Rol no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Body() updateRolEstatusDto: UpdateRolEstatusDto,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.rolesService.updateEstatus(
      id,
      idUser,
      updateRolEstatusDto,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar rol',
    description: 'Eliminación lógica: cambia el estatus del rol a inactivo.',
  })
  @ApiParam({ name: 'id', description: 'ID del rol a eliminar' })
  @ApiResponse({
    status: 200,
    description: 'Rol eliminado correctamente',
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
  @ApiResponse({ status: 404, description: 'Rol no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  remove(@Param('id') id: string, @Request() req) {
    const idUser = req.user.userId;
    return this.rolesService.remove(+id, idUser);
  }
}
