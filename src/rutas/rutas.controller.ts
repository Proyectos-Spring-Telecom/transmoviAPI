import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  ParseIntPipe,
  Put,
} from '@nestjs/common';
import { RutasService } from './rutas.service';
import { CreateRutaDto } from './dto/create-ruta.dto';
import { UpdateRutaDto } from './dto/update-ruta.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { UpdateRutasEstatusDto } from './dto/update-ruta-estatus.dto';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('Rutas')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('rutas')
export class RutasController {
  constructor(private readonly rutasService: RutasService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear ruta',
    description:
      'Registra una nueva ruta de transporte asociada a regiones y cliente.',
  })
  @ApiBody({
    type: CreateRutaDto,
    description:
      'nombre, idRegionInicio, idRegionFin, idRutaRegreso, idCliente, estatus, etc.',
  })
  @ApiResponse({
    status: 201,
    description: 'Ruta creada exitosamente',
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
  async create(@Body() createRutaDto: CreateRutaDto, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return await this.rutasService.create(
      +idUser,
      +cliente,
      +rol,
      createRutaDto,
    );
  }

  @Get('list')
  @ApiOperation({
    summary: 'Listar rutas',
    description:
      'Obtiene el listado de rutas activas. El acceso depende del rol del usuario.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de rutas',
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
              idRegionInicio: { type: 'number' },
              idRegionFin: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findAllList(@Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.rutasService.findAllList(+idUser, +cliente, +rol);
  }

  @Get('by-region/:idRegion')
  @ApiOperation({
    summary: 'Listar rutas por ID de región',
    description:
      'Obtiene todas las rutas activas pertenecientes únicamente a la región especificada.',
  })
  @ApiParam({
    name: 'idRegion',
    type: Number,
    description: 'ID de la región de la cual se desean obtener las rutas',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de rutas de la región',
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
              idRegionInicio: { type: 'number' },
              idRegionFin: { type: 'number' },
              idCliente: { type: 'number' },
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
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
  })
  async findByRegion(
    @Param('idRegion', ParseIntPipe) idRegion: number,
    @Request() req,
  ) {
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return await this.rutasService.findByRegion(+idRegion, +idUser, +rol);
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Listar rutas paginadas',
    description:
      'Obtiene el catálogo paginado de rutas. El acceso depende del rol del usuario.',
  })
  @ApiParam({ name: 'page', description: 'Número de página (desde 1)' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de rutas',
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
              idRegionInicio: { type: 'number' },
              idRegionFin: { type: 'number' },
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
  async getRutasUsuario(
    @Request() req,
    @Param('page', ParseIntPipe) page,
    @Param('limit', ParseIntPipe) limit,
  ) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.rutasService.obtenerRutasPorUsuarioSQL(
      +idUser,
      +cliente,
      +rol,
      +page,
      +limit,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener ruta por ID',
    description: 'Obtiene el detalle de una ruta por su ID.',
  })
  @ApiParam({ name: 'id', description: 'ID de la ruta' })
  @ApiResponse({
    status: 200,
    description: 'Detalle de la ruta',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            nombre: { type: 'string' },
            idRegionInicio: { type: 'number' },
            idRegionFin: { type: 'number' },
            idCliente: { type: 'number' },
            estatus: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Ruta no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.rutasService.findOne(id, +idUser, +cliente, +rol);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar ruta',
    description: 'Modifica los datos de una ruta existente.',
  })
  @ApiParam({ name: 'id', description: 'ID de la ruta a actualizar' })
  @ApiBody({
    type: UpdateRutaDto,
    description:
      'Campos a actualizar: nombre, idRegionInicio, idRegionFin, idRutaRegreso, estatus',
  })
  @ApiResponse({
    status: 200,
    description: 'Ruta actualizada correctamente',
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
  @ApiResponse({ status: 404, description: 'Ruta no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRutaDto: UpdateRutaDto,
    @Request() req,
  ) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.rutasService.update(id, +idUser, +cliente, +rol, updateRutaDto);
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Actualizar estatus de la ruta',
    description: 'Cambia el estatus de una ruta (0=Inactivo, 1=Activo).',
  })
  @ApiParam({ name: 'id', description: 'ID de la ruta' })
  @ApiBody({
    type: UpdateRutasEstatusDto,
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
  @ApiResponse({ status: 404, description: 'Ruta no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRutasEstatusDto: UpdateRutasEstatusDto,
    @Request() req,
  ) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.rutasService.updateEstatus(
      id,
      +idUser,
      +cliente,
      +rol,
      updateRutasEstatusDto,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar ruta',
    description: 'Eliminación lógica: cambia el estatus de la ruta a inactivo.',
  })
  @ApiParam({ name: 'id', description: 'ID de la ruta a eliminar' })
  @ApiResponse({
    status: 200,
    description: 'Ruta eliminada correctamente',
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
  @ApiResponse({ status: 404, description: 'Ruta no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.rutasService.remove(id, +idUser, +rol);
  }
}
