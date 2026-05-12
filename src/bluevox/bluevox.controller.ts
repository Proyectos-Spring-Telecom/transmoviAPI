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
  UseGuards,
  Put,
} from '@nestjs/common';
import { BluevoxService } from './bluevox.service';
import { CreateBlueVoxsDto } from './dto/create-bluevox.dto';
import { UpdateBluevoxDto } from './dto/update-bluevox.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { UpdateBlueVoxEstatusDto } from './dto/update-bluevox-estatus.dto';
import { UpdateBluevoxEstadoDto } from './dto/update-bluevox.estado.dto';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('BlueVox')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('bluevox')
export class BluevoxController {
  constructor(private readonly bluevoxService: BluevoxService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear BlueVox',
    description:
      'Registra un nuevo dispositivo BlueVox. El número de serie debe ser único. Estados: 0=Inactivo, 1=Disponible, 2=Asignado, 3=En Mantenimiento, 4=Dañado, 5=Retirado.',
  })
  @ApiBody({ type: CreateBlueVoxsDto })
  @ApiResponse({
    status: 201,
    description: 'BlueVox creado correctamente',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        message: { type: 'string', example: 'BlueVox creado correctamente.' },
        data: {
          type: 'object',
          properties: { id: { type: 'number' }, nombre: { type: 'string' } },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Número de serie ya registrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() createBlueVoxsDto: CreateBlueVoxsDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.bluevoxService.create(+idUser, createBlueVoxsDto);
  }

  @Get('list')
  @ApiOperation({
    summary: 'Listar todos los BlueVox',
    description:
      'Obtiene el listado completo de dispositivos BlueVox. SuperAdministrador ve todos; otros roles solo los de su cliente y clientes hijos.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de BlueVox',
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
              estatus: { type: 'number' },
              estadoActual: { type: 'number' },
              idCliente: { type: 'number' },
              fechaCreacion: { type: 'string' },
              fechaActualizacion: { type: 'string' },
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
    return this.bluevoxService.findAllList(+cliente, +rol);
  }

  @Get('clientes/:id')
  @ApiOperation({
    summary: 'Listar BlueVox disponibles por cliente',
    description:
      'Obtiene los BlueVox activos y disponibles (estadoActual=1) de un cliente específico. Útil para asignar dispositivos a instalaciones.',
  })
  @ApiParam({ name: 'id', description: 'ID del cliente' })
  @ApiResponse({
    status: 200,
    description: 'Lista de BlueVox disponibles del cliente',
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
    return await this.bluevoxService.findAllListClientes(id, +cliente);
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Listar BlueVox con paginación',
    description:
      'Obtiene los dispositivos BlueVox paginados. SuperAdministrador ve todo; otros roles solo los de su cliente y clientes hijos.',
  })
  @ApiParam({ name: 'page', description: 'Número de página' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de BlueVox',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array' },
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
    return await this.bluevoxService.findAll(+cliente, +rol, page, limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener BlueVox por ID',
    description: 'Obtiene el detalle de un dispositivo BlueVox específico.',
  })
  @ApiParam({ name: 'id', description: 'ID del BlueVox' })
  @ApiResponse({
    status: 200,
    description: 'BlueVox encontrado',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            numeroSerie: { type: 'string' },
            marca: { type: 'string' },
            modelo: { type: 'string' },
            estatus: { type: 'number' },
            estadoActual: { type: 'number' },
            idCliente: { type: 'number' },
            fechaCreacion: { type: 'string' },
            fechaActualizacion: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'BlueVox no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findOne(@Param('id') id: string, @Request() req) {
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.bluevoxService.findOne(+id, +cliente, +rol);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar BlueVox',
    description:
      'Actualiza la información del dispositivo (número de serie, marca, modelo, cliente).',
  })
  @ApiParam({ name: 'id', description: 'ID del BlueVox' })
  @ApiBody({ type: UpdateBluevoxDto })
  @ApiResponse({
    status: 200,
    description: 'BlueVox actualizado correctamente',
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
  @ApiResponse({ status: 404, description: 'BlueVox no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  update(
    @Param('id') id: string,
    @Request() req,
    @Body() updateBluevoxDto: UpdateBluevoxDto,
  ) {
    const idUser = req.user.userId;
    return this.bluevoxService.update(+id, +idUser, updateBluevoxDto);
  }

  @Patch('actualizar/estado/:id')
  @ApiOperation({
    summary: 'Actualizar estado del BlueVox',
    description:
      'Cambia el estado del componente. Valores: 0=Inactivo, 1=Disponible, 2=Asignado, 3=En Mantenimiento, 4=Dañado, 5=Retirado.',
  })
  @ApiParam({ name: 'id', description: 'ID del BlueVox' })
  @ApiBody({ type: UpdateBluevoxEstadoDto })
  @ApiResponse({
    status: 200,
    description: 'Estado actualizado correctamente',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        message: { type: 'string' },
        data: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'BlueVox no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  updateEstado(
    @Param('id') id: string,
    @Body() updateBluevoxEstadoDto: UpdateBluevoxEstadoDto,
    @Request() req,
  ) {
    const idUser = req.user.userId;
    return this.bluevoxService.updateEstado(
      +id,
      +idUser,
      updateBluevoxEstadoDto,
    );
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Actualizar estatus del BlueVox',
    description: 'Activa o desactiva el BlueVox. 0=Inactivo, 1=Activo.',
  })
  @ApiParam({ name: 'id', description: 'ID del BlueVox' })
  @ApiBody({ type: UpdateBlueVoxEstatusDto })
  @ApiResponse({
    status: 200,
    description: 'Estatus actualizado correctamente',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        message: { type: 'string' },
        estatus: {
          type: 'object',
          properties: { estatus: { type: 'number' } },
        },
        data: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'BlueVox no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  updateEstatus(
    @Param('id') id: string,
    @Body() updateBlueVoxEstatusDto: UpdateBlueVoxEstatusDto,
    @Request() req,
  ) {
    const idUser = req.user.userId;
    return this.bluevoxService.updateEstatus(
      +id,
      +idUser,
      updateBlueVoxEstatusDto,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar BlueVox',
    description: 'Elimina un dispositivo BlueVox del sistema.',
  })
  @ApiParam({ name: 'id', description: 'ID del BlueVox' })
  @ApiResponse({
    status: 200,
    description: 'BlueVox eliminado correctamente',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        message: { type: 'string' },
        data: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'BlueVox no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  remove(@Param('id') id: string, @Request() req) {
    const idUser = req.user.userId;
    return this.bluevoxService.remove(+id, +idUser);
  }
}
