import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
  Request,
  Put,
} from '@nestjs/common';
import { VehiculosService } from './vehiculos.service';
import { CreateVehiculoDto } from './dto/create-vehiculo.dto';
import { UpdateVehiculoDto } from './dto/update-vehiculo.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiResponseCommon } from 'src/common/ApiResponse';
import { UpdateVehiculoEstatusDto } from './dto/update-vehiculos-estatus.dto';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('Vehiculos')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('vehiculos')
export class VehiculosController {
  constructor(private readonly vehiculosService: VehiculosService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear vehículo',
    description: 'Registra un nuevo vehículo asociado al cliente.',
  })
  @ApiBody({
    type: CreateVehiculoDto,
    description:
      'Datos del vehículo: numeroEconomico, placas, idCliente, idModelo, etc.',
  })
  @ApiResponse({
    status: 201,
    description: 'Vehículo creado exitosamente',
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
  create(@Body() createVehiculoDto: CreateVehiculoDto, @Request() req) {
    const idUser = req.user.userId;
    return this.vehiculosService.create(createVehiculoDto, +idUser);
  }

  @Get('list')
  @ApiOperation({
    summary: 'Listar vehículos',
    description:
      'Obtiene el listado de vehículos activos. El acceso depende del rol del usuario.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de vehículos',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              numeroEconomico: { type: 'string' },
              placas: { type: 'string' },
              idCliente: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllList(@Request() req): Promise<ApiResponseCommon> {
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return await this.vehiculosService.findAllList(+cliente, +rol);
  }

  @Get('by-cliente/:idCliente')
  @ApiOperation({
    summary: 'Listar vehículos por ID de cliente',
    description:
      'Obtiene todos los vehículos activos pertenecientes únicamente al cliente especificado.',
  })
  @ApiParam({
    name: 'idCliente',
    type: Number,
    description: 'ID del cliente del cual se desean obtener los vehículos',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de vehículos del cliente',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              numeroEconomico: { type: 'string' },
              placas: { type: 'string' },
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
  ): Promise<ApiResponseCommon> {
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return await this.vehiculosService.findByCliente(+idCliente, +idUser, +rol);
  }

  @Get('clientes/:id')
  @ApiOperation({
    summary: 'Listar vehículos por ID de cliente',
    description:
      'Obtiene los vehículos (y dispositivos asociados) del cliente especificado.',
  })
  @ApiParam({ name: 'id', description: 'ID del cliente' })
  @ApiResponse({
    status: 200,
    description: 'Lista de vehículos del cliente',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              numeroEconomico: { type: 'string' },
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
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return await this.vehiculosService.findAllListClientes(id, +cliente);
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Listar vehículos paginados',
    description:
      'Obtiene el catálogo paginado de vehículos. El acceso depende del rol del usuario.',
  })
  @ApiParam({ name: 'page', description: 'Número de página (desde 1)' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de vehículos',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              numeroEconomico: { type: 'string' },
              placas: { type: 'string' },
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
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return await this.vehiculosService.findAll(page, limit, +cliente, +rol);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener vehículo por ID',
    description: 'Obtiene el detalle de un vehículo por su ID.',
  })
  @ApiParam({ name: 'id', description: 'ID del vehículo' })
  @ApiResponse({
    status: 200,
    description: 'Detalle del vehículo',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            numeroEconomico: { type: 'string' },
            placas: { type: 'string' },
            idCliente: { type: 'number' },
            idModelo: { type: 'number' },
            estatus: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findOne(@Param('id') id: string, @Request() req) {
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.vehiculosService.findOne(+id, +cliente, +rol);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar vehículo',
    description: 'Modifica los datos de un vehículo existente.',
  })
  @ApiParam({ name: 'id', description: 'ID del vehículo a actualizar' })
  @ApiBody({
    type: UpdateVehiculoDto,
    description: 'Campos a actualizar del vehículo',
  })
  @ApiResponse({
    status: 200,
    description: 'Vehículo actualizado correctamente',
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
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  update(
    @Param('id') id: string,
    @Request() req,
    @Body() updateVehiculoDto: UpdateVehiculoDto,
  ) {
    const idUser = req.user.userId;
    return this.vehiculosService.update(+id, +idUser, updateVehiculoDto);
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Actualizar estatus del vehículo',
    description: 'Cambia el estatus de un vehículo (0=Inactivo, 1=Activo).',
  })
  @ApiParam({ name: 'id', description: 'ID del vehículo' })
  @ApiBody({
    type: UpdateVehiculoEstatusDto,
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
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  updateEstatus(
    @Param('id') id: string,
    @Body() UpdateVehiculoEstatusDto: UpdateVehiculoEstatusDto,
    @Request() req,
  ) {
    const idUser = req.user.userId;
    return this.vehiculosService.updateEstatus(
      +id,
      idUser,
      UpdateVehiculoEstatusDto,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar vehículo',
    description:
      'Eliminación lógica: cambia el estatus del vehículo a inactivo.',
  })
  @ApiParam({ name: 'id', description: 'ID del vehículo a eliminar' })
  @ApiResponse({
    status: 200,
    description: 'Vehículo eliminado correctamente',
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
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  remove(@Param('id') id: string, @Request() req) {
    const idUser = req.user.userId;
    return this.vehiculosService.remove(+id, +idUser);
  }
}
