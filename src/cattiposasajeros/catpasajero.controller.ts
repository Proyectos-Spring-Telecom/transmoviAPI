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
  Put,
  ParseIntPipe,
} from '@nestjs/common';
import { CatpasajeroService } from './catpasajero.service';
import { CreateCatpasajeroDto } from './dto/create-catpasajero.dto';
import { UpdateCatpasajeroDto } from './dto/update-catpasajero.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Catálogo tipos pasajeros')
@ApiBearerAuth('bearer-token')
@Controller('catpasajero')
export class CatpasajeroController {
  constructor(private readonly catpasajeroService: CatpasajeroService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({
    summary: 'Crear tipo de pasajero',
    description:
      'Registra un nuevo tipo de pasajero en el catálogo (ej: Estudiante, Adulto Mayor). Cada cliente define sus propios tipos con descuento asociado.',
  })
  @ApiBody({
    type: CreateCatpasajeroDto,
    description:
      'nombre, idCatTipoDescuento (1=Porcentaje, 2=Monetario, 3=Nulo), cantidad (opcional), estatus (0 ó 1), idCliente',
  })
  @ApiResponse({
    status: 201,
    description: 'Tipo de pasajero creado exitosamente',
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
  create(@Body() createCatpasajeroDto: CreateCatpasajeroDto, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.catpasajeroService.create(+idUser, createCatpasajeroDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('list')
  @ApiOperation({
    summary: 'Listar tipos de pasajero',
    description:
      'Obtiene el listado de tipos de pasajero según el rol del usuario. SuperAdministrador ve todos; otros usuarios ven solo los de sus clientes asociados.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de tipos de pasajero',
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
              idCatTipoDescuento: { type: 'number' },
              nombreTipoDescuento: { type: 'string' },
              cantidad: { type: 'number' },
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
  findAllList(@Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.catpasajeroService.findAllList(+cliente, +rol);
  }

  @UseGuards(JwtAuthGuard)
  @Get('clientes/:id')
  @ApiOperation({
    summary: 'Listar tipos de pasajero por cliente',
    description: 'Obtiene los tipos de pasajero activos (estatus=1) de un cliente específico.',
  })
  @ApiParam({ name: 'id', description: 'ID del cliente' })
  @ApiResponse({
    status: 200,
    description: 'Lista de tipos de pasajero del cliente',
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
              idCatTipoDescuento: { type: 'number' },
              cantidad: { type: 'number' },
              estatus: { type: 'number' },
              idCliente: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findAllListClientes(@Param('id', ParseIntPipe) id: number) {
    return this.catpasajeroService.findAllListClientes(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiOperation({
    summary: 'Obtener tipo de pasajero por ID',
    description: 'Obtiene el detalle de un tipo de pasajero por su ID.',
  })
  @ApiParam({ name: 'id', description: 'ID del tipo de pasajero' })
  @ApiResponse({
    status: 200,
    description: 'Detalle del tipo de pasajero',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          nombre: { type: 'string' },
          idCatTipoDescuento: { type: 'number' },
          nombreTipoDescuento: { type: 'string' },
          cantidad: { type: 'number' },
          estatus: { type: 'number' },
          idCliente: { type: 'number' },
          nombreCliente: { type: 'string' },
          apellidoPaternoCliente: { type: 'string' },
          apellidoMaternoCliente: { type: 'string' },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Tipo de pasajero no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findOne(@Param('id') id: string) {
    return this.catpasajeroService.findOne(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar tipo de pasajero',
    description: 'Modifica los datos de un tipo de pasajero existente (nombre, tipo descuento, cantidad, estatus, idCliente).',
  })
  @ApiParam({ name: 'id', description: 'ID del tipo de pasajero a actualizar' })
  @ApiBody({
    type: UpdateCatpasajeroDto,
    description: 'nombre, idCatTipoDescuento, cantidad, estatus, idCliente (todos opcionales)',
  })
  @ApiResponse({
    status: 200,
    description: 'Tipo de pasajero actualizado correctamente',
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
  @ApiResponse({ status: 400, description: 'Tipo de pasajero no encontrado o error de validación' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  update(
    @Param('id') id: string,
    @Body() updateCatpasajeroDto: UpdateCatpasajeroDto,
    @Request() req,
  ) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.catpasajeroService.update(+id, +idUser, updateCatpasajeroDto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Actualizar estatus de tipo de pasajero',
    description: 'Cambia el estatus de un tipo de pasajero (0=Inactivo, 1=Activo).',
  })
  @ApiParam({ name: 'id', description: 'ID del tipo de pasajero' })
  @ApiBody({
    type: UpdateCatpasajeroDto,
    description: 'Para cambio de estatus enviar solo el campo estatus (0 ó 1)',
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
  @ApiResponse({ status: 400, description: 'Tipo de pasajero no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  updateEstatus(
    @Param('id') id: string,
    @Body() updateCatpasajeroDto: UpdateCatpasajeroDto,
    @Request() req,
  ) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.catpasajeroService.update(+id, +idUser, updateCatpasajeroDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar tipo de pasajero',
    description: 'Eliminación lógica: cambia el estatus del tipo de pasajero a inactivo (0).',
  })
  @ApiParam({ name: 'id', description: 'ID del tipo de pasajero a eliminar' })
  @ApiResponse({
    status: 200,
    description: 'Tipo de pasajero eliminado correctamente',
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
  @ApiResponse({ status: 400, description: 'Tipo de pasajero no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  remove(@Param('id') id: string, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.catpasajeroService.remove(+id, +idUser);
  }
}
