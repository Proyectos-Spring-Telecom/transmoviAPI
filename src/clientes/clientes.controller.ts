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
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { UpdateClienteEstatusDto } from './dto/update-clientes-estatus.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Clientes')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear cliente',
    description:
      'Registra un nuevo cliente (persona física o moral). El RFC debe ser único. Se crea automáticamente un tipo de pasajero "Estandar" para el cliente.',
  })
  @ApiBody({
    type: CreateClienteDto,
    description:
      'rfc (obligatorio), tipoPersona (1=Física, 2=Moral), idPadre, nombre, apellidos, teléfono, correo, dirección, encargado, documentos, etc.',
  })
  @ApiResponse({
    status: 201,
    description: 'Cliente creado exitosamente',
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
  @ApiResponse({ status: 400, description: 'El RFC ya existe o error de validación' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async createCliente(@Body() createClienteDto: CreateClienteDto, @Request() req): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.clientesService.createCliente(createClienteDto, idUser);
  }
  @Get('list')
  @ApiOperation({
    summary: 'Listar clientes (resumen)',
    description:
      'Obtiene un listado de clientes activos (estatus=1) con datos básicos. SuperAdministrador ve todos; otros usuarios ven solo sus clientes asociados.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de clientes',
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
              apellidoPaterno: { type: 'string' },
              apellidoMaterno: { type: 'string' },
              logotipo: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async getAllListClientes(@Request() req,): Promise<ApiResponseCommon> {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.clientesService.getAllListClientes(+idUser, +cliente, +rol);
  }

  @Get('list/:cliente')
  @ApiOperation({
    summary: 'Listar clientes por ID padre',
    description: 'Obtiene el listado de clientes hijos asociados a un cliente padre. Incluye nombre y apellidos.',
  })
  @ApiParam({ name: 'cliente', description: 'ID del cliente padre' })
  @ApiResponse({
    status: 200,
    description: 'Lista de clientes asociados',
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
              apellidoPaterno: { type: 'string' },
              apellidoMaterno: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async getAllListClientesId(
    @Param('cliente', ParseIntPipe) cliente: number,
    @Request() req,): Promise<ApiResponseCommon> {
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.clientesService.getAllListClientesId(+idUser, +cliente, +rol);
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Listar clientes paginados',
    description:
      'Obtiene el catálogo paginado de clientes con todos los datos. SuperAdministrador ve todos; otros usuarios ven solo sus clientes asociados.',
  })
  @ApiParam({ name: 'page', description: 'Número de página (desde 1)' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de clientes',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              rfc: { type: 'string' },
              tipoPersona: { type: 'number' },
              nombre: { type: 'string' },
              apellidoPaterno: { type: 'string' },
              apellidoMaterno: { type: 'string' },
              telefono: { type: 'string' },
              correo: { type: 'string' },
              estado: { type: 'string' },
              municipio: { type: 'string' },
              colonia: { type: 'string' },
              calle: { type: 'string' },
              numeroExterior: { type: 'string' },
              numeroInterior: { type: 'string' },
              cp: { type: 'string' },
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
  getAllClientes(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.clientesService.getAllClientes(+idUser, +cliente, +rol, page, limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener cliente por ID',
    description: 'Obtiene el detalle completo de un cliente por su ID.',
  })
  @ApiParam({ name: 'id', description: 'ID del cliente' })
  @ApiResponse({
    status: 200,
    description: 'Detalle del cliente',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            idPadre: { type: 'number' },
            rfc: { type: 'string' },
            tipoPersona: { type: 'number' },
            nombre: { type: 'string' },
            apellidoPaterno: { type: 'string' },
            apellidoMaterno: { type: 'string' },
            telefono: { type: 'string' },
            correo: { type: 'string' },
            estado: { type: 'string' },
            municipio: { type: 'string' },
            colonia: { type: 'string' },
            calle: { type: 'string' },
            numeroExterior: { type: 'string' },
            numeroInterior: { type: 'string' },
            cp: { type: 'string' },
            estatus: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  getOneCliente(@Param('id') id: string, @Request() req,) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.clientesService.getOneCliente(+id);
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Actualizar estatus del cliente',
    description: 'Cambia el estatus de un cliente y sus clientes hijos (0=Inactivo, 1=Activo).',
  })
  @ApiParam({ name: 'id', description: 'ID del cliente' })
  @ApiBody({
    type: UpdateClienteEstatusDto,
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
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  updateEstatusClientes(
    @Param('id') id: string,
    @Request() req,
    @Body() updateClienteEstatusDto: UpdateClienteEstatusDto,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    return this.clientesService.updateClienteStatus(
      +id,
      idUser,
      +cliente,
      updateClienteEstatusDto,
    );
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar cliente',
    description: 'Modifica los datos de un cliente existente. Todos los campos son opcionales.',
  })
  @ApiParam({ name: 'id', description: 'ID del cliente a actualizar' })
  @ApiBody({
    type: UpdateClienteDto,
    description: 'Campos a actualizar (todos opcionales): rfc, tipoPersona, nombre, apellidos, teléfono, correo, dirección, etc.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cliente actualizado correctamente',
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
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateCliente(
    @Param('id') id: string,
    @Request() req,
    @Body() updateClienteDto: UpdateClienteDto,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.clientesService.updateCliente(+id, idUser, updateClienteDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar cliente',
    description: 'Eliminación lógica: cambia el estatus del cliente y sus clientes hijos a inactivo (0).',
  })
  @ApiParam({ name: 'id', description: 'ID del cliente a eliminar' })
  @ApiResponse({
    status: 200,
    description: 'Cliente eliminado correctamente',
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
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async removeClientes(@Param('id') id: string, @Request() req): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    return await this.clientesService.removeCliente(+id, idUser, +cliente);
  }
}
