import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { RegionesService } from './regiones.service';
import { CreateRegionesDto } from './dto/create-regione.dto';
import { UpdateRegioneDto } from './dto/update-regione.dto';
import { UpdateRegionesEstatusDto } from './dto/update-regione-estatus.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('Regiones')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('regiones')
export class RegionesController {
  constructor(private readonly regionesService: RegionesService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear región',
    description: 'Registra una nueva región geográfica asociada a un cliente.',
  })
  @ApiBody({
    type: CreateRegionesDto,
    description: 'nombre, descripción, idCliente, coordenadas, estatus, etc.',
  })
  @ApiResponse({
    status: 201,
    description: 'Región creada exitosamente',
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
  create(@Body() createRegionesDto: CreateRegionesDto, @Request() req) {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.regionesService.create(
      +idUser,
      +cliente,
      +rol,
      createRegionesDto,
    );
  }

  @Get('list')
  @ApiOperation({
    summary: 'Listar regiones',
    description:
      'Obtiene el listado de regiones activas. El acceso depende del rol del usuario.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de regiones',
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
  async findAllList(@Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return await this.regionesService.findAllList(+cliente, +idUser, +rol);
  }

  @Get('by-cliente/:idCliente')
  @ApiOperation({
    summary: 'Listar regiones por ID de cliente',
    description:
      'Obtiene todas las regiones activas pertenecientes únicamente al cliente especificado (sin incluir clientes hijos).',
  })
  @ApiParam({
    name: 'idCliente',
    type: Number,
    description: 'ID del cliente del cual se desean obtener las regiones',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de regiones del cliente',
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
  async findByCliente(
    @Param('idCliente', ParseIntPipe) idCliente: number,
    @Request() req,
  ) {
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return await this.regionesService.findByCliente(+idCliente, +idUser, +rol);
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Listar regiones paginadas',
    description:
      'Obtiene el catálogo paginado de regiones. El acceso depende del rol del usuario.',
  })
  @ApiParam({ name: 'page', description: 'Número de página (desde 1)' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de regiones',
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
  findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
  ) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.regionesService.findAll(+cliente, +idUser, +rol, page, limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener región por ID',
    description: 'Obtiene el detalle de una región por su ID.',
  })
  @ApiParam({ name: 'id', description: 'ID de la región' })
  @ApiResponse({
    status: 200,
    description: 'Detalle de la región',
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
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Región no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findOne(@Param('id') id: string, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.regionesService.findOne(+idUser, +id, +cliente, +rol);
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Actualizar estatus de la región',
    description: 'Cambia el estatus de una región (0=Inactivo, 1=Activo).',
  })
  @ApiParam({ name: 'id', description: 'ID de la región' })
  @ApiBody({
    type: UpdateRegionesEstatusDto,
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
  @ApiResponse({ status: 404, description: 'Región no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateEstatus(
    @Param('id') id: string,
    @Body() updateRegionesEstatusDto: UpdateRegionesEstatusDto,
    @Request() req,
  ) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return await this.regionesService.updateEstatus(
      +id,
      +idUser,
      +cliente,
      +rol,
      updateRegionesEstatusDto,
    );
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar región',
    description: 'Modifica los datos de una región existente.',
  })
  @ApiParam({ name: 'id', description: 'ID de la región a actualizar' })
  @ApiBody({
    type: UpdateRegioneDto,
    description:
      'Campos a actualizar: nombre, descripción, coordenadas, estatus',
  })
  @ApiResponse({
    status: 200,
    description: 'Región actualizada correctamente',
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
  @ApiResponse({ status: 404, description: 'Región no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  update(
    @Param('id') id: string,
    @Body() updateRegioneDto: UpdateRegioneDto,
    @Request() req,
  ) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.regionesService.update(
      +id,
      +cliente,
      +idUser,
      +rol,
      updateRegioneDto,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar región',
    description:
      'Eliminación lógica: cambia el estatus de la región a inactivo.',
  })
  @ApiParam({ name: 'id', description: 'ID de la región a eliminar' })
  @ApiResponse({
    status: 200,
    description: 'Región eliminada correctamente',
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
  @ApiResponse({ status: 404, description: 'Región no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  remove(@Param('id') id: string, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.regionesService.remove(+id, +cliente, +idUser, +rol);
  }
}
