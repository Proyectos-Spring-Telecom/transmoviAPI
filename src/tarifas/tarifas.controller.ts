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
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { TarifasService } from './tarifas.service';
import { CreateTarifaDto } from './dto/create-tarifa.dto';
import { UpdateTarifaDto } from './dto/update-tarifa.dto';
import { UpdateTarifasEstatusDto } from './dto/update-tarifa-estatus.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';

@ApiTags('Tarifas')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('tarifas')
export class TarifasController {
  constructor(private readonly tarifasService: TarifasService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear tarifa',
    description: 'Registra una nueva tarifa asociada a un derrotero.',
  })
  @ApiBody({
    type: CreateTarifaDto,
    description: 'tarifaBase, tipoTarifa, idDerrotero, distanciaKm, idCatPasajero, estatus, etc.',
  })
  @ApiResponse({
    status: 201,
    description: 'Tarifa creada exitosamente',
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
  create(@Body() createTarifaDto: CreateTarifaDto, @Request() req) {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.tarifasService.create(+idUser, +cliente, +rol, createTarifaDto);
  }

  @Get('list')
  @ApiOperation({
    summary: 'Listar tarifas',
    description: 'Obtiene el listado de tarifas activas. El acceso depende del rol del usuario.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de tarifas',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: { type: 'number' }, tarifaBase: { type: 'number' }, idDerrotero: { type: 'number' }, tipoTarifa: { type: 'number' } },
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
    return this.tarifasService.findAllList(+idUser, +cliente, +rol);
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Listar tarifas paginadas',
    description: 'Obtiene el catálogo paginado de tarifas. El acceso depende del rol del usuario.',
  })
  @ApiParam({ name: 'page', description: 'Número de página (desde 1)' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de tarifas',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: { type: 'number' }, tarifaBase: { type: 'number' }, idDerrotero: { type: 'number' }, tipoTarifa: { type: 'number' }, idCliente: { type: 'number' }, estatus: { type: 'number' } },
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
  findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
  ) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.tarifasService.findAll(+idUser, +cliente, +rol, page, limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener tarifa por ID',
    description: 'Obtiene el detalle de una tarifa por su ID.',
  })
  @ApiParam({ name: 'id', description: 'ID de la tarifa' })
  @ApiResponse({
    status: 200,
    description: 'Detalle de la tarifa',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: { id: { type: 'number' }, tarifaBase: { type: 'number' }, idDerrotero: { type: 'number' }, tipoTarifa: { type: 'number' }, idCliente: { type: 'number' }, estatus: { type: 'number' } },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Tarifa no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findOne(@Param('id') id: string, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.tarifasService.findOne(+id, +idUser, +cliente, +rol);
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Actualizar estatus de la tarifa',
    description: 'Cambia el estatus de una tarifa (0=Inactivo, 1=Activo).',
  })
  @ApiParam({ name: 'id', description: 'ID de la tarifa' })
  @ApiBody({
    type: UpdateTarifasEstatusDto,
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
  @ApiResponse({ status: 404, description: 'Tarifa no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  updateEstatus(
    @Param('id') id: string,
    @Body() updateTarifasEstatusDto: UpdateTarifasEstatusDto,
    @Request() req,
  ) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.tarifasService.updateEstatus(
      +id,
      +idUser,
      updateTarifasEstatusDto,
    );
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar tarifa',
    description: 'Modifica los datos de una tarifa existente.',
  })
  @ApiParam({ name: 'id', description: 'ID de la tarifa a actualizar' })
  @ApiBody({
    type: UpdateTarifaDto,
    description: 'Campos a actualizar: tarifaBase, tipoTarifa, distanciaKm, estatus',
  })
  @ApiResponse({
    status: 200,
    description: 'Tarifa actualizada correctamente',
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
  @ApiResponse({ status: 404, description: 'Tarifa no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  update(
    @Param('id') id: string,
    @Body() updateTarifaDto: UpdateTarifaDto,
    @Request() req,
  ) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.tarifasService.update(+id, +idUser, updateTarifaDto);
  }

  @Delete('eliminado/total/:id')
  @ApiOperation({
    summary: 'Eliminar tarifa permanentemente',
    description: 'Eliminación física del registro. Solo disponible para SuperAdministrador.',
  })
  @ApiParam({ name: 'id', description: 'ID de la tarifa a eliminar' })
  @ApiResponse({
    status: 200,
    description: 'Tarifa eliminada permanentemente',
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
  @ApiResponse({ status: 400, description: 'Acceso denegado (solo SuperAdmin)' })
  @ApiResponse({ status: 404, description: 'Tarifa no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  removeTotal(@Param('id') id: string, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.tarifasService.removeTotal(+id, +idUser, +rol);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar tarifa',
    description: 'Eliminación lógica: cambia el estatus de la tarifa a inactivo.',
  })
  @ApiParam({ name: 'id', description: 'ID de la tarifa a eliminar' })
  @ApiResponse({
    status: 200,
    description: 'Tarifa eliminada correctamente',
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
  @ApiResponse({ status: 404, description: 'Tarifa no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  remove(@Param('id') id: string, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.tarifasService.remove(+id, +idUser);
  }
}
