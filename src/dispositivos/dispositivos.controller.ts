import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Put,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { DispositivosService } from './dispositivos.service';
import { CreateDispositivoDto } from './dto/create-dispositivo.dto';
import { UpdateDispositivoDto } from './dto/update-dispositivo.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { UpdateDispositivoEstatusDto } from './dto/update-dispositivos-estatus.dto';
import { ApiResponseCommon } from 'src/common/ApiResponse';
import { UpdateDispositivoEstadoDto } from './dto/update-dispositivo-estado.dto';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('Dispositivos')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('dispositivos')
export class DispositivosController {
  constructor(private readonly dispositivosService: DispositivosService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear dispositivo',
    description:
      'Registra un nuevo dispositivo (lector, validador, etc.). El número de serie debe ser único.',
  })
  @ApiBody({
    type: CreateDispositivoDto,
    description:
      'numeroSerie (obligatorio, único), marca, modelo, idCliente, estatus, estadoActual',
  })
  @ApiResponse({
    status: 201,
    description: 'Dispositivo creado exitosamente',
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
    description: 'El número de serie ya existe o cliente no válido',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  createDispositivo(
    @Body() createDispositivoDto: CreateDispositivoDto,
    @Request() req,
  ) {
    const idUser = req.user.userId;
    return this.dispositivosService.createDispositivo(
      createDispositivoDto,
      +idUser,
    );
  }

  @Get('list')
  @ApiOperation({
    summary: 'Listar dispositivos',
    description:
      'Obtiene el listado de dispositivos activos (estatus=1) y disponibles (estadoActual=1). El acceso depende del rol del usuario.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de dispositivos',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              numeroSerie: { type: 'string' },
              marca: { type: 'string' },
              modelo: { type: 'string' },
              fechaCreacion: { type: 'string' },
              fechaActualizacion: { type: 'string' },
              estadoActual: { type: 'number' },
              estatus: { type: 'number' },
              idCliente: { type: 'number' },
              nombreCliente: { type: 'string' },
              apellidoPaternoCliente: { type: 'string' },
              apellidoMaternoCliente: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findAllListDispositivos(@Request() req): Promise<ApiResponseCommon> {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.dispositivosService.findAllList(+cliente, +rol);
  }

  @Get('by-cliente/:idCliente')
  @ApiOperation({
    summary: 'Listar dispositivos por cliente',
    description: 'Obtiene los dispositivos activos de un cliente específico.',
  })
  @ApiParam({ name: 'idCliente', description: 'ID del cliente' })
  @ApiResponse({
    status: 200,
    description: 'Lista de dispositivos del cliente',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              numeroSerie: { type: 'string' },
              marca: { type: 'string' },
              modelo: { type: 'string' },
              estadoActual: { type: 'number' },
              estatus: { type: 'number' },
              idCliente: { type: 'number' },
              nombreCompletoCliente: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findByCliente(
    @Param('idCliente', ParseIntPipe) idCliente: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return await this.dispositivosService.findByCliente(
      idCliente,
      +cliente,
      +rol,
    );
  }

  @Get('clientes/:id')
  @ApiOperation({
    summary: 'Listar dispositivos disponibles de un cliente',
    description:
      'Obtiene los dispositivos activos, disponibles y no asignados a instalación de un cliente.',
  })
  @ApiParam({ name: 'id', description: 'ID del cliente' })
  @ApiResponse({
    status: 200,
    description: 'Lista de dispositivos disponibles del cliente',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              numeroSerie: { type: 'string' },
              marca: { type: 'string' },
              modelo: { type: 'string' },
              estadoActual: { type: 'number' },
              estatus: { type: 'number' },
              idCliente: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllDispositivosClientes(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return await this.dispositivosService.findAllListDispositivosClientes(
      +id,
      +cliente,
    );
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Listar dispositivos paginados',
    description:
      'Obtiene el catálogo paginado de dispositivos. El acceso depende del rol del usuario.',
  })
  @ApiParam({ name: 'page', description: 'Número de página (desde 1)' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de dispositivos',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              numeroSerie: { type: 'string' },
              marca: { type: 'string' },
              modelo: { type: 'string' },
              estadoActual: { type: 'number' },
              estatus: { type: 'number' },
              idCliente: { type: 'number' },
              nombreCliente: { type: 'string' },
              apellidoPaternoCliente: { type: 'string' },
              apellidoMaternoCliente: { type: 'string' },
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
  async findAllDispositivos(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.dispositivosService.findAll(+cliente, +rol, page, limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener dispositivo por ID',
    description: 'Obtiene el detalle de un dispositivo por su ID.',
  })
  @ApiParam({ name: 'id', description: 'ID del dispositivo' })
  @ApiResponse({
    status: 200,
    description: 'Detalle del dispositivo',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              numeroSerie: { type: 'string' },
              marca: { type: 'string' },
              modelo: { type: 'string' },
              fechaCreacion: { type: 'string' },
              fechaActualizacion: { type: 'string' },
              estadoActual: { type: 'number' },
              estatus: { type: 'number' },
              idCliente: { type: 'number' },
              nombreCliente: { type: 'string' },
              apellidoPaternoCliente: { type: 'string' },
              apellidoMaternoCliente: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Dispositivo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findOneDispositivo(@Param('id') id: string, @Request() req) {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.dispositivosService.findOneDispositivo(+id, +cliente, +rol);
  }

  @Patch('actualizar/estado/:id')
  @ApiOperation({
    summary: 'Actualizar estado del dispositivo',
    description:
      'Cambia el estado actual del dispositivo (1=Disponible, 2=Asignado, 3=En Mantenimiento, 4=Dañado, 5=Retirado). No aplica si está asignado a una instalación.',
  })
  @ApiParam({ name: 'id', description: 'ID del dispositivo' })
  @ApiBody({
    type: UpdateDispositivoEstadoDto,
    description: 'estadoActual (0-5 según EstadoComponente)',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado actualizado correctamente',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        message: { type: 'string' },
        estatus: {
          type: 'object',
          properties: { estatus: { type: 'number' } },
        },
        data: {
          type: 'object',
          properties: { id: { type: 'number' }, nombre: { type: 'string' } },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Dispositivo asignado a instalación o dado de baja',
  })
  @ApiResponse({ status: 404, description: 'Dispositivo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  updateDispositivoEstado(
    @Param('id') id: string,
    @Request() req,
    @Body() updateDispositivoEstadoDto: UpdateDispositivoEstadoDto,
  ) {
    const idUser = req.user.userId;
    return this.dispositivosService.updateDispositivoEstado(
      +id,
      +idUser,
      updateDispositivoEstadoDto,
    );
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Actualizar estatus del dispositivo',
    description:
      'Cambia el estatus del dispositivo (0=Inactivo, 1=Activo). No aplica si está asignado a una instalación (al pasar a inactivo).',
  })
  @ApiParam({ name: 'id', description: 'ID del dispositivo' })
  @ApiBody({
    type: UpdateDispositivoEstatusDto,
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
        estatus: {
          type: 'object',
          properties: { estatus: { type: 'number' } },
        },
        data: {
          type: 'object',
          properties: { id: { type: 'number' }, nombre: { type: 'string' } },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Dispositivo asignado a instalación',
  })
  @ApiResponse({ status: 404, description: 'Dispositivo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  updateDispositivoEstatus(
    @Param('id') id: string,
    @Request() req,
    @Body() updateDispositivoEstatusDto: UpdateDispositivoEstatusDto,
  ) {
    const idUser = req.user.userId;
    return this.dispositivosService.updateDispositivoEstatus(
      +id,
      +idUser,
      updateDispositivoEstatusDto,
    );
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar dispositivo',
    description:
      'Modifica los datos de un dispositivo existente (numeroSerie, marca, modelo, etc.).',
  })
  @ApiParam({ name: 'id', description: 'ID del dispositivo a actualizar' })
  @ApiBody({
    type: UpdateDispositivoDto,
    description:
      'Campos a actualizar (todos opcionales): numeroSerie, marca, modelo, estatus, estadoActual, idCliente',
  })
  @ApiResponse({
    status: 200,
    description: 'Dispositivo actualizado correctamente',
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
  @ApiResponse({ status: 404, description: 'Dispositivo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  updateDispositivo(
    @Param('id') id: string,
    @Request() req,
    @Body() updateDispositivoDto: UpdateDispositivoDto,
  ) {
    const idUser = req.user.userId;
    return this.dispositivosService.updateDispositivo(
      +id,
      +idUser,
      updateDispositivoDto,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar dispositivo',
    description:
      'Eliminación lógica: cambia estatus y estadoActual a inactivo. No aplica si el dispositivo está asignado a una instalación.',
  })
  @ApiParam({ name: 'id', description: 'ID del dispositivo a eliminar' })
  @ApiResponse({
    status: 200,
    description: 'Dispositivo eliminado correctamente',
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
    description: 'Dispositivo asignado a instalación',
  })
  @ApiResponse({ status: 404, description: 'Dispositivo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  removeDispositivo(@Param('id') id: string, @Request() req) {
    const idUser = req.user.userId;
    return this.dispositivosService.removeDispositivo(+id, +idUser);
  }
}
