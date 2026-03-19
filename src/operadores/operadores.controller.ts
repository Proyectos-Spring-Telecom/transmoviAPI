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
import { OperadoresService } from './operadores.service';
import { CreateOperadoreDto } from './dto/create-operadore.dto';
import { UpdateOperadoreDto } from './dto/update-operadore.dto';
import { UpdateOperadorStatusDto } from './dto/update-operadores-estatus.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';

@ApiTags('Operadores')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('operadores')
export class OperadoresController {
  constructor(private readonly operadoresService: OperadoresService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear operador',
    description: 'Registra un nuevo operador asociado a un usuario y cliente.',
  })
  @ApiBody({
    type: CreateOperadoreDto,
    description: 'Datos del operador: idUsuario, idCliente, licencia, etc.',
  })
  @ApiResponse({
    status: 201,
    description: 'Operador creado exitosamente',
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
  createOperador(
    @Body() createOperadoreDto: CreateOperadoreDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.operadoresService.createOperador(createOperadoreDto, +idUser);
  }

  @Get('list')
  @ApiOperation({
    summary: 'Listar operadores',
    description: 'Obtiene el listado de operadores activos. El acceso depende del rol del usuario.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de operadores',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: { type: 'number' }, nombre: { type: 'string' }, numeroLicencia: { type: 'string' } },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findAllListOperador(@Request() req,): Promise<ApiResponseCommon> {
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.operadoresService.findAllListOperadores(+cliente, +rol,);
  }

  @Get('by-cliente/:idCliente')
  @ApiOperation({
    summary: 'Listar operadores por ID de cliente',
    description: 'Obtiene todos los operadores activos pertenecientes únicamente al cliente especificado (a través de la relación Operadores -> Usuarios -> Clientes).',
  })
  @ApiParam({
    name: 'idCliente',
    type: Number,
    description: 'ID del cliente del cual se desean obtener los operadores',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de operadores del cliente',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: { type: 'number' }, nombre: { type: 'string' }, numeroLicencia: { type: 'string' }, idCliente: { type: 'number' } },
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
    return await this.operadoresService.findByCliente(+idCliente, +idUser, +rol);
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Listar operadores paginados',
    description: 'Obtiene el catálogo paginado de operadores. El acceso depende del rol del usuario.',
  })
  @ApiParam({ name: 'page', description: 'Número de página (desde 1)' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de operadores',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: { type: 'number' }, nombre: { type: 'string' }, numeroLicencia: { type: 'string' }, idCliente: { type: 'number' }, estatus: { type: 'number' } },
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
  findAllOperador(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.operadoresService.findAllOperadores(+cliente, +rol, page, limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener operador por ID',
    description: 'Obtiene el detalle completo de un operador por su ID.',
  })
  @ApiParam({ name: 'id', description: 'ID del operador' })
  @ApiResponse({
    status: 200,
    description: 'Detalle del operador',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: { id: { type: 'number' }, nombre: { type: 'string' }, numeroLicencia: { type: 'string' }, idCliente: { type: 'number' }, estatus: { type: 'number' } },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Operador no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findOneOperador(@Param('id') id: string,@Request() req) {
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.operadoresService.findOneOperador(+id, +cliente, + rol);
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Actualizar estatus del operador',
    description: 'Cambia el estatus de un operador (0=Inactivo, 1=Activo).',
  })
  @ApiParam({ name: 'id', description: 'ID del operador' })
  @ApiBody({
    type: UpdateOperadorStatusDto,
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
  @ApiResponse({ status: 404, description: 'Operador no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  updateOperadorEstatus(
    @Param('id') id: string,
    @Request() req,
    @Body() updateOperadorStatusDto: UpdateOperadorStatusDto,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.operadoresService.updateOperadorEstatus(
      +id,
      +idUser,
      updateOperadorStatusDto,
    );
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar operador',
    description: 'Modifica los datos de un operador existente.',
  })
  @ApiParam({ name: 'id', description: 'ID del operador a actualizar' })
  @ApiBody({
    type: UpdateOperadoreDto,
    description: 'Campos a actualizar del operador',
  })
  @ApiResponse({
    status: 200,
    description: 'Operador actualizado correctamente',
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
  @ApiResponse({ status: 404, description: 'Operador no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  updateOperador(
    @Param('id') id: string,
    @Request() req,
    @Body() updateOperadoreDto: UpdateOperadoreDto,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.operadoresService.updateOperador(
      +id,
      +idUser,
      updateOperadoreDto,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar operador',
    description: 'Eliminación lógica: cambia el estatus del operador a inactivo.',
  })
  @ApiParam({ name: 'id', description: 'ID del operador a eliminar' })
  @ApiResponse({
    status: 200,
    description: 'Operador eliminado correctamente',
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
  @ApiResponse({ status: 404, description: 'Operador no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  removeOperador(@Param('id') id: string, @Request() req) {
    const idUser = req.user.userId;
    return this.operadoresService.removeOperador(+id, +idUser);
  }
}
