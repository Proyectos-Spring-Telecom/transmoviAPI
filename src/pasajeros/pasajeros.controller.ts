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
import { PasajerosService } from './pasajeros.service';
import { CreatePasajeroDto } from './dto/create-pasajero.dto';
import { UpdatePasajeroDto } from './dto/update-pasajero.dto';
import { UpdatePasajeroEstatusDto } from './dto/update-pasajeros-estatus.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiResponseCommon } from 'src/common/ApiResponse';
import { UpdatePasajeroEstadoSolicitudDto } from './dto/update-pasajeros-estado-solicitud.dto';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Pasajeros')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('pasajeros')
export class PasajerosController {
  constructor(private readonly pasajerosService: PasajerosService) {}

  // ========================================
  // 🔹 POST ROUTES
  // ========================================

  @Post()
  @ApiOperation({
    summary: 'Crear pasajero',
    description: 'Registra un nuevo pasajero en el sistema.',
  })
  @ApiBody({
    type: CreatePasajeroDto,
    description:
      'Datos del pasajero: nombre, apellidos, correo, teléfono, idCliente, etc.',
  })
  @ApiResponse({
    status: 201,
    description: 'Pasajero creado exitosamente',
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
  createPasajero(@Body() createPasajeroDto: CreatePasajeroDto, @Request() req) {
    const idUser = req.user.userId;
    return this.pasajerosService.createPasajeros(createPasajeroDto, idUser);
  }

  // ========================================
  // 🔹 GET ROUTES - Rutas específicas primero
  // ========================================

  @Get('list')
  @ApiOperation({
    summary: 'Listar pasajeros',
    description:
      'Obtiene el listado de pasajeros activos. El acceso depende del rol del usuario.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de pasajeros',
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
              apellidos: { type: 'string' },
              correo: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findAllListPasajero(@Request() req): Promise<ApiResponseCommon> {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.pasajerosService.findAllListPasajeros(+cliente, +rol);
  }

  @Get('main/:idUsuario')
  @ApiOperation({
    summary: 'Obtener pasajero principal por ID de usuario',
    description: 'Obtiene el pasajero principal asociado a un usuario.',
  })
  @ApiParam({ name: 'idUsuario', description: 'ID del usuario' })
  @ApiResponse({
    status: 200,
    description: 'Pasajero principal del usuario',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            nombre: { type: 'string' },
            idUsuario: { type: 'number' },
            idCliente: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Pasajero no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findMainPasajero(
    @Param('idUsuario', ParseIntPipe) id: number,
    @Request() req,
  ) {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.pasajerosService.obtenerMainPasajero(id, idUser, cliente, rol);
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Listar pasajeros paginados',
    description:
      'Obtiene el catálogo paginado de pasajeros. El acceso depende del rol del usuario.',
  })
  @ApiParam({ name: 'page', description: 'Número de página (desde 1)' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de pasajeros',
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
              apellidos: { type: 'string' },
              correo: { type: 'string' },
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
  findAllPasajero(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.pasajerosService.findAllPasajeros(+cliente, +rol, page, limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener pasajero por ID',
    description: 'Obtiene el detalle de un pasajero por su ID.',
  })
  @ApiParam({ name: 'id', description: 'ID del pasajero' })
  @ApiResponse({
    status: 200,
    description: 'Detalle del pasajero',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            nombre: { type: 'string' },
            apellidos: { type: 'string' },
            correo: { type: 'string' },
            idCliente: { type: 'number' },
            estatus: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Pasajero no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findOnePasajero(@Param('id', ParseIntPipe) id: number) {
    return this.pasajerosService.findOnePasajero(id);
  }

  // ========================================
  // 🔹 PUT ROUTES - Rutas específicas primero
  // ========================================

  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar pasajero',
    description: 'Modifica los datos de un pasajero existente.',
  })
  @ApiParam({ name: 'id', description: 'ID del pasajero a actualizar' })
  @ApiBody({
    type: UpdatePasajeroDto,
    description: 'Campos a actualizar del pasajero',
  })
  @ApiResponse({
    status: 200,
    description: 'Pasajero actualizado correctamente',
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
  @ApiResponse({ status: 404, description: 'Pasajero no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  updatePasajero(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePasajeroDto: UpdatePasajeroDto,
    @Request() req,
  ) {
    const idUser = req.user.userId;
    return this.pasajerosService.updatePasajero(id, idUser, updatePasajeroDto);
  }

  // ========================================
  // 🔹 PATCH ROUTES - Rutas específicas primero
  // ========================================
  @Patch('estado/solicitud/:id')
  @ApiOperation({
    summary: 'Actualizar estado de solicitud del pasajero',
    description:
      'Actualiza el estado de la solicitud de un pasajero (ej. aprobado, rechazado).',
  })
  @ApiParam({ name: 'id', description: 'ID del pasajero' })
  @ApiBody({
    type: UpdatePasajeroEstadoSolicitudDto,
    description: 'estadoSolicitud (valor según catálogo)',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado de solicitud actualizado correctamente',
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
  @ApiResponse({ status: 404, description: 'Pasajero no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  updatePasajeroEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePasajeroEstadoSolicitudDto: UpdatePasajeroEstadoSolicitudDto,
    @Request() req,
  ) {
    const idUser = req.user.userId;
    return this.pasajerosService.updatePasajeroEstadoSolicitud(
      id,
      updatePasajeroEstadoSolicitudDto,
      idUser,
    );
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Actualizar estatus del pasajero',
    description: 'Cambia el estatus de un pasajero (0=Inactivo, 1=Activo).',
  })
  @ApiParam({ name: 'id', description: 'ID del pasajero' })
  @ApiBody({
    type: UpdatePasajeroEstatusDto,
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
  @ApiResponse({ status: 404, description: 'Pasajero no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  updatePasajeroEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePasajeroEstatusDto: UpdatePasajeroEstatusDto,
    @Request() req,
  ) {
    const idUser = req.user.userId;
    return this.pasajerosService.updatePasajeroEstatus(
      id,
      updatePasajeroEstatusDto,
      idUser,
    );
  }

  // ========================================
  // 🔹 DELETE ROUTES
  // ========================================

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar pasajero',
    description:
      'Eliminación lógica: cambia el estatus del pasajero a inactivo.',
  })
  @ApiParam({ name: 'id', description: 'ID del pasajero a eliminar' })
  @ApiResponse({
    status: 200,
    description: 'Pasajero eliminado correctamente',
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
  @ApiResponse({ status: 404, description: 'Pasajero no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  removePasajero(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const idUser = req.user.userId;
    return this.pasajerosService.removePasajero(id, idUser);
  }
}
