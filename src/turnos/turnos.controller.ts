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
  UseGuards,
} from '@nestjs/common';
import { TurnosService } from './turnos.service';
import { CreateTurnoDto } from './dto/create-turno.dto';
import { UpdateTurnoDto } from './dto/update-turno.dto';
import { UpdateTurnosEstatusDto } from './dto/update-turno-estatus.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { openApiTurnoListadoItem } from 'src/common/openapi-instalaciones-monitoreo.schemas';

@ApiTags('Turnos')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('turnos')
export class TurnosController {
  constructor(private readonly turnosService: TurnosService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear turno',
    description: 'Registra un nuevo turno de operador (apertura de turno).',
  })
  @ApiBody({
    type: CreateTurnoDto,
    description: 'idOperador, idVehiculo, idDispositivo, idRuta, etc.',
  })
  @ApiResponse({
    status: 201,
    description: 'Turno creado exitosamente',
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
    description: 'Error de validación o turno abierto existente',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() createTurnoDto: CreateTurnoDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    const idOperador = req.user.idOperador;
    return await this.turnosService.create(
      +idUser,
      +cliente,
      +idOperador,
      createTurnoDto,
    );
  }

  @Get('list')
  @ApiOperation({
    summary: 'Listar turnos',
    description:
      'Listado sin paginación. Cada turno incluye datos de instalación en **`dispositivos[]`** y **`blueVoxs[]`** (JSON agregado en SQL), con **`principal`** (`1` o `null`) en cada dispositivo. No hay un único `idDispositivo` en la raíz del objeto.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de turnos',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: openApiTurnoListadoItem,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllList(@Request() req): Promise<ApiResponseCommon> {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return await this.turnosService.findAllList(+idUser, +cliente, +rol);
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Listar turnos paginados',
    description:
      'Misma forma de cada elemento que en `GET /turnos/list`: arreglos `dispositivos` y `blueVoxs` con `principal` por dispositivo, más metadatos de turno, instalación, vehículo, cliente y operador.',
  })
  @ApiParam({ name: 'page', description: 'Número de página (desde 1)' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de turnos',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: openApiTurnoListadoItem,
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
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return await this.turnosService.findAll(
      +idUser,
      +cliente,
      +rol,
      page,
      limit,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener turno por ID',
    description:
      'Devuelve `{ data }` con un objeto de detalle con la misma convención que el listado: **`dispositivos[]`**, **`blueVoxs[]`**, `principal` en cada dispositivo.',
  })
  @ApiParam({ name: 'id', description: 'ID del turno' })
  @ApiResponse({
    status: 200,
    description: 'Detalle del turno',
    schema: {
      type: 'object',
      properties: {
        data: openApiTurnoListadoItem,
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Turno no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return await this.turnosService.findOne(+id, +idUser, +cliente, +rol);
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Actualizar estatus del turno',
    description: 'Cambia el estatus de un turno (0=Inactivo, 1=Activo).',
  })
  @ApiParam({ name: 'id', description: 'ID del turno' })
  @ApiBody({
    type: UpdateTurnosEstatusDto,
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
  @ApiResponse({ status: 404, description: 'Turno no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTurnosEstatusDto: UpdateTurnosEstatusDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return await this.turnosService.updateEstatus(
      id,
      +idUser,
      updateTurnosEstatusDto,
    );
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar turno',
    description:
      'Modifica los datos de un turno existente (ej. cierre de turno).',
  })
  @ApiParam({ name: 'id', description: 'ID del turno a actualizar' })
  @ApiBody({
    type: UpdateTurnoDto,
    description:
      'Campos a actualizar: fechaFin, idVehiculo, idDispositivo, idRuta, etc.',
  })
  @ApiResponse({
    status: 200,
    description: 'Turno actualizado correctamente',
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
  @ApiResponse({ status: 404, description: 'Turno no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTurnoDto: UpdateTurnoDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    const idOperador = req.user.idOperador;
    return await this.turnosService.update(
      id,
      +idUser,
      +cliente,
      +idOperador,
      updateTurnoDto,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar turno',
    description: 'Eliminación lógica: cambia el estatus del turno a inactivo.',
  })
  @ApiParam({ name: 'id', description: 'ID del turno a eliminar' })
  @ApiResponse({
    status: 200,
    description: 'Turno eliminado correctamente',
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
  @ApiResponse({ status: 404, description: 'Turno no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return await this.turnosService.remove(id, +idUser);
  }
}
