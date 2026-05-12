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
  Put,
  UseGuards,
} from '@nestjs/common';
import { UsuariosregionesService } from './usuariosregiones.service';
import { CreateUsuariosRegionesDto } from './dto/create-usuariosregione.dto';
import { UpdateUsuariosregioneDto } from './dto/update-usuariosregione.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { UpdateUsuariosRegionesEstatusDto } from './dto/update-usuariosregione-estatus.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Usuarios regiones')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('usuariosregiones')
export class UsuariosregionesController {
  constructor(
    private readonly usuariosregionesService: UsuariosregionesService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Crear relación usuario-región',
    description: 'Registra una nueva relación entre un usuario y una región.',
  })
  @ApiBody({
    type: CreateUsuariosRegionesDto,
    description: 'Datos para crear la relación usuario-región',
  })
  @ApiResponse({
    status: 201,
    description: 'Relación usuario-región creada exitosamente',
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
    @Body() createUsuariosRegionesDto: CreateUsuariosRegionesDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.usuariosregionesService.create(
      +idUser,
      createUsuariosRegionesDto,
    );
  }

  @Get('list')
  @ApiOperation({
    summary: 'Listar relaciones usuario-región',
    description:
      'Obtiene el listado de todas las relaciones usuario-región activas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de relaciones usuario-región',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              idUsuario: { type: 'number' },
              idRegion: { type: 'number' },
              estatus: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllList(): Promise<ApiResponseCommon> {
    return await this.usuariosregionesService.findAllList();
  }

  @Get('usuario/:idUsuario')
  @ApiOperation({
    summary: 'Obtener regiones por usuario',
    description:
      'Obtiene todas las regiones asociadas a un usuario específico.',
  })
  @ApiParam({ name: 'idUsuario', description: 'ID del usuario' })
  @ApiResponse({
    status: 200,
    description: 'Regiones asociadas al usuario',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              idUsuario: { type: 'number' },
              idRegion: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOneUsuario(@Param('idUsuario', ParseIntPipe) id: number) {
    return await this.usuariosregionesService.findOneUsuario(id);
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Listar relaciones usuario-región paginadas',
    description: 'Obtiene el listado paginado de relaciones usuario-región.',
  })
  @ApiParam({ name: 'page', description: 'Número de página (desde 1)' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de relaciones usuario-región',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              idUsuario: { type: 'number' },
              idRegion: { type: 'number' },
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
    return await this.usuariosregionesService.findAll(page, limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener relación usuario-región por ID',
    description: 'Obtiene el detalle de una relación usuario-región por su ID.',
  })
  @ApiParam({ name: 'id', description: 'ID de la relación usuario-región' })
  @ApiResponse({
    status: 200,
    description: 'Detalle de la relación usuario-región',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            idUsuario: { type: 'number' },
            idRegion: { type: 'number' },
            estatus: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Relación no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOne(@Param('id') id: string) {
    return await this.usuariosregionesService.findOne(+id);
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Actualizar estatus de relación usuario-región',
    description:
      'Cambia el estatus de una relación usuario-región (0=Inactivo, 1=Activo).',
  })
  @ApiParam({ name: 'id', description: 'ID de la relación usuario-región' })
  @ApiBody({
    type: UpdateUsuariosRegionesEstatusDto,
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
  @ApiResponse({ status: 404, description: 'Relación no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateEstatus(
    @Param('id') id: string,
    @Body() updateUsuariosRegionesEstatusDto: UpdateUsuariosRegionesEstatusDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.usuariosregionesService.updateEstatus(
      +id,
      idUser,
      updateUsuariosRegionesEstatusDto,
    );
  }

  @Put(':idUsuario')
  @ApiOperation({
    summary: 'Actualizar relación usuario-región',
    description: 'Actualiza completamente las regiones asociadas a un usuario.',
  })
  @ApiParam({
    name: 'idUsuario',
    description: 'ID del usuario cuyas regiones se actualizan',
  })
  @ApiBody({
    type: UpdateUsuariosregioneDto,
    description: 'Nuevos datos de regiones para el usuario',
  })
  @ApiResponse({
    status: 200,
    description: 'Regiones del usuario actualizadas correctamente',
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
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('idUsuario') id: string,
    @Body() updateUsuariosregioneDto: UpdateUsuariosregioneDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.usuariosregionesService.update(
      +id,
      idUser,
      updateUsuariosregioneDto,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar relación usuario-región',
    description: 'Elimina una relación específica entre usuario y región.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la relación usuario-región a eliminar',
  })
  @ApiResponse({
    status: 200,
    description: 'Relación eliminada correctamente',
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
  @ApiResponse({ status: 404, description: 'Relación no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async remove(
    @Param('id') id: string,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.usuariosregionesService.remove(+id, idUser);
  }
}
