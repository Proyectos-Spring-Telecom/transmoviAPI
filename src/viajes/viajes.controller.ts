import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Request,
  ParseIntPipe,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { ViajesService } from './viajes.service';
import { CreateViajeDto } from './dto/create-viaje.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { UpdateViajeDto } from './dto/update-viaje.dto';

@ApiTags('Viajes')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('viajes')
export class ViajesController {
  constructor(private readonly viajesService: ViajesService) { }

  @Post()
  @ApiOperation({
    summary: 'Crear viaje',
    description:
      'Crea un nuevo viaje asociado a un turno, derrotero y operador. Solo usuarios con rol operador pueden crear viajes. La fecha de inicio se establece automáticamente.',
  })
  @ApiBody({
    type: CreateViajeDto,
    description: 'idTurno, idDerrotero (y otros campos según el DTO)',
  })
  @ApiResponse({
    status: 201,
    description: 'Viaje creado exitosamente',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        message: { type: 'string', example: 'Viaje creado correctamente' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            nombre: {
              type: 'string',
              example: 'Cliente ID: 5, Turno ID: 10, Derrotero ID: 20, Operador ID: 3',
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
  create(@Body() createViajeDto: CreateViajeDto, @Request() req) {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    const idOperador = req.user.idOperador;
    return this.viajesService.create(+idUser, +cliente, +idOperador, createViajeDto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar viaje',
    description:
      'Actualiza un viaje existente, generalmente para finalizarlo. Solo usuarios con rol operador pueden actualizar viajes. La fecha de fin se establece automáticamente y el estatus se cambia a INACTIVO.',
  })
  @ApiBody({
    type: UpdateViajeDto,
    description: 'Campos a actualizar del viaje',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID del viaje a actualizar',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Viaje actualizado exitosamente',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        message: { type: 'string', example: 'Viaje actualizado correctamente' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            nombre: {
              type: 'string',
              example: 'Cliente ID: 5, Turno ID: 10, Derrotero ID: 20, Operador ID: 3',
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Los datos del viaje no coinciden con los del usuario',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  @ApiResponse({
    status: 404,
    description: 'Viaje no encontrado',
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
  })
  async update(
    @Param('id') id: number,
    @Body() updateViajeDto: UpdateViajeDto,
    @Request() req,
  ) {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    const idOperador = req.user.idOperador;
    return this.viajesService.update(+idUser, +cliente, +idOperador, +id, updateViajeDto);
  }

  @Get('list')
  @ApiOperation({
    summary: 'Obtener listado completo de viajes',
    description:
      'Obtiene un listado completo de viajes según el rol del usuario: SuperAdministrador (todos), Administrador/Reportes/Capturista (hijos del cliente), Cliente (solo su cliente). Los viajes incluyen información detallada de turno, instalación, dispositivo, BlueVox, vehículo, operador y derrotero.',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado de viajes obtenido exitosamente',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', example: 1 },
              inicio: { type: 'string', format: 'date-time' },
              fin: { type: 'string', format: 'date-time', nullable: true },
              estatus: { type: 'number', example: 1 },
              idCliente: { type: 'number', example: 5 },
              idTurno: { type: 'number', example: 10 },
              idDerrotero: { type: 'number', example: 20 },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
  })
  findAllList(@Request() req) {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.viajesService.findAllList(+cliente, +cliente,);
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Obtener viajes paginados',
    description:
      'Obtiene un listado paginado de viajes según el rol del usuario. Incluye información de paginación (total, página actual, última página). Los viajes incluyen información detallada de turno, instalación, dispositivo, BlueVox, vehículo, operador y derrotero.',
  })
  @ApiParam({
    name: 'page',
    type: Number,
    description: 'Número de página (inicia en 1)',
    example: 1,
  })
  @ApiParam({
    name: 'limit',
    type: Number,
    description: 'Cantidad de registros por página',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Listado paginado de viajes obtenido exitosamente',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', example: 1 },
              inicio: { type: 'string', format: 'date-time' },
              fin: { type: 'string', format: 'date-time', nullable: true },
              estatus: { type: 'number', example: 1 },
            },
          },
        },
        paginated: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 100 },
            page: { type: 'number', example: 1 },
            lastPage: { type: 'number', example: 10 },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
  })
  findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req
  ) {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.viajesService.findAll(+cliente, +rol, page, limit, +idUser);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener viaje por ID',
    description:
      'Obtiene la información detallada de un viaje específico por su ID. Incluye turno, instalación, dispositivo, vehículo, operador y derrotero.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del viaje',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Detalle del viaje',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            inicio: { type: 'string', format: 'date-time' },
            fin: { type: 'string', format: 'date-time', nullable: true },
            estatus: { type: 'number', example: 1 },
            idCliente: { type: 'number', example: 5 },
            idTurno: { type: 'number', example: 10 },
            idDerrotero: { type: 'number', example: 20 },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Viaje no encontrado',
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
  })
  findOne(@Param('id') id: string, @Request() req) {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.viajesService.findOne(+id, +cliente, +rol,);
  }

}
