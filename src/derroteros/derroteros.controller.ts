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
import { DerroterosService } from './derroteros.service';
import { CreateDerroteroDto } from './dto/create-derrotero.dto';
import { UpdateDerroteroDto } from './dto/update-derrotero.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { UpdateDerroterosEstatusDto } from './dto/update-derrotero-estatus.dto';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';

@ApiTags('Derroteros')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('derroteros')
export class DerroterosController {
  constructor(private readonly derroterosService: DerroterosService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear derrotero',
    description:
      'Crea un derrotero con su tarifa asociada. Si crearDerroteroRegreso=1 y la ruta tiene idRutaRegreso, se crea automáticamente el derrotero y tarifa de regreso.',
  })
  @ApiBody({
    type: CreateDerroteroDto,
    description:
      'nombre, idRuta, recorridoDetallado (array de {lat, lng}), crearDerroteroRegreso (0 ó 1), tarifaBase, tipoTarifa, distanciaKm, estatus, y campos de tarifa',
  })
  @ApiResponse({
    status: 201,
    description: 'Derrotero y tarifa creados exitosamente',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            derroteroPrincipal: {
              type: 'object',
              properties: { id: { type: 'number' }, nombre: { type: 'string' }, distanciaKm: { type: 'number' }, estatus: { type: 'number' }, idRuta: { type: 'number' } },
            },
            tarifaPrincipal: {
              type: 'object',
              properties: { id: { type: 'number' }, tarifaBase: { type: 'number' }, tipoTarifa: { type: 'number' }, estatus: { type: 'number' }, idDerrotero: { type: 'number' } },
            },
            derroteroRegreso: { type: 'object', description: 'Presente si se creó derrotero de regreso' },
            tarifaRegreso: { type: 'object', description: 'Presente si se creó tarifa de regreso' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Ruta no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  create(@Body() createDerroteroDto: CreateDerroteroDto, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.derroterosService.create(+idUser, +cliente, +rol, createDerroteroDto);
  }

  @Get('list')
  @ApiOperation({
    summary: 'Listar derroteros',
    description:
      'Obtiene el listado de derroteros activos (estatus=1) sin paginación. El acceso depende del rol del usuario.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de derroteros',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              nombreDerrotero: { type: 'string' },
              puntoInicio: { type: 'object' },
              puntoFin: { type: 'object' },
              distanciaKm: { type: 'number' },
              idRuta: { type: 'number' },
              nombreRuta: { type: 'string' },
              idRegionInicio: { type: 'number' },
              nombreRegionInicio: { type: 'string' },
              idCliente: { type: 'number' },
              nombreCompletoCliente: { type: 'string' },
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
    return this.derroterosService.findAllList(+idUser, +cliente, +rol);
  }

  @Get('by-ruta/:idRuta')
  @ApiOperation({
    summary: 'Listar derroteros por ID de ruta',
    description: 'Obtiene todos los derroteros activos pertenecientes únicamente a la ruta especificada.',
  })
  @ApiParam({ name: 'idRuta', description: 'ID de la ruta' })
  @ApiResponse({
    status: 200,
    description: 'Lista de derroteros de la ruta',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              nombreDerrotero: { type: 'string' },
              puntoInicio: { type: 'object' },
              puntoFin: { type: 'object' },
              distanciaKm: { type: 'number' },
              idRuta: { type: 'number' },
              nombreRuta: { type: 'string' },
              idRegionInicio: { type: 'number' },
              nombreRegionInicio: { type: 'string' },
              idCliente: { type: 'number' },
              nombreCompletoCliente: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor' })
  async findByRuta(
    @Param('idRuta', ParseIntPipe) idRuta: number,
    @Request() req,
  ) {
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return await this.derroterosService.findByRuta(+idRuta, +idUser, +rol);
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Listar derroteros paginados',
    description:
      'Obtiene el catálogo paginado de derroteros con rutas y regiones. El acceso depende del rol del usuario.',
  })
  @ApiParam({ name: 'page', description: 'Número de página (desde 1)' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de derroteros',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              nombreDerrotero: { type: 'string' },
              puntoInicio: { type: 'object' },
              puntoFin: { type: 'object' },
              distanciaKm: { type: 'number' },
              idRuta: { type: 'number' },
              nombreRuta: { type: 'string' },
              idRegionInicio: { type: 'number' },
              idRegionFin: { type: 'number' },
              idCliente: { type: 'number' },
              nombreCompletoCliente: { type: 'string' },
            },
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
    return this.derroterosService.findAll(+idUser, +cliente, +rol, page, limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener derrotero por ID',
    description: 'Obtiene el detalle completo de un derrotero, incluyendo recorrido interpolado.',
  })
  @ApiParam({ name: 'id', description: 'ID del derrotero' })
  @ApiResponse({
    status: 200,
    description: 'Detalle del derrotero',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              nombreDerrotero: { type: 'string' },
              puntoInicio: { type: 'object' },
              puntoFin: { type: 'object' },
              recorridoDetallado: { type: 'object' },
              recorridoInterpolar: { type: 'object' },
              distanciaKm: { type: 'number' },
              idRuta: { type: 'number' },
              nombreRuta: { type: 'string' },
              idRegionInicio: { type: 'number' },
              idRegionFin: { type: 'number' },
              idCliente: { type: 'number' },
              nombreCompletoCliente: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Derrotero no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findOne(@Param('id') id: string, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.derroterosService.findOne(+id, +idUser, +cliente, +rol);
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Actualizar estatus del derrotero',
    description: 'Cambia el estatus de un derrotero (0=Inactivo, 1=Activo).',
  })
  @ApiParam({ name: 'id', description: 'ID del derrotero' })
  @ApiBody({
    type: UpdateDerroterosEstatusDto,
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
        id: { type: 'number' },
        nombre: { type: 'string' },
        distancia: { type: 'number' },
        estatus: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Derrotero no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  updateEstatus(
    @Param('id') id: string,
    @Body() updateDerroterosEstatusDto: UpdateDerroterosEstatusDto,
    @Request() req,
  ) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.derroterosService.updateEstatus(+id, +idUser, +cliente, +rol, updateDerroterosEstatusDto);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar derrotero',
    description: 'Modifica los datos de un derrotero existente. Si se envía recorridoDetallado, se recalcula la distancia e interpolación.',
  })
  @ApiParam({ name: 'id', description: 'ID del derrotero a actualizar' })
  @ApiBody({
    type: UpdateDerroteroDto,
    description: 'Campos a actualizar (todos opcionales): nombre, puntoInicio, puntoFin, recorridoDetallado, distanciaKm, estatus, idRuta, tarifa, etc.',
  })
  @ApiResponse({
    status: 200,
    description: 'Derrotero actualizado correctamente',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        message: { type: 'string' },
        id: { type: 'number' },
        nombre: { type: 'string' },
        distancia: { type: 'number' },
        estatus: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Derrotero no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  update(
    @Param('id') id: string,
    @Body() updateDerroteroDto: UpdateDerroteroDto,
    @Request() req,
  ) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.derroterosService.update(+id, +idUser, +cliente, +rol, updateDerroteroDto);
  }

  @Delete('eliminado/total/:id')
  @ApiOperation({
    summary: 'Eliminar derrotero permanentemente',
    description: 'Eliminación física del registro. Solo disponible para SuperAdministrador.',
  })
  @ApiParam({ name: 'id', description: 'ID del derrotero a eliminar' })
  @ApiResponse({
    status: 200,
    description: 'Derrotero eliminado permanentemente',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        message: { type: 'string' },
        id: { type: 'number' },
        nombre: { type: 'string' },
        distancia: { type: 'number' },
        estatus: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Acceso denegado (solo SuperAdmin)' })
  @ApiResponse({ status: 404, description: 'Derrotero no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  removeTotal(@Param('id') id: string, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.derroterosService.removeTotal(+id, +idUser, +cliente, +rol);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar derrotero (lógico)',
    description: 'Eliminación lógica: cambia el estatus del derrotero a inactivo (0).',
  })
  @ApiParam({ name: 'id', description: 'ID del derrotero a eliminar' })
  @ApiResponse({
    status: 200,
    description: 'Derrotero eliminado correctamente',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        message: { type: 'string' },
        id: { type: 'number' },
        nombre: { type: 'string' },
        distancia: { type: 'number' },
        estatus: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Derrotero no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  remove(@Param('id') id: string, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.derroterosService.remove(+id, +idUser, +cliente, +rol);
  }

}
