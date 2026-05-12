import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  Patch,
} from '@nestjs/common';
import { PosicionesService } from './posiciones.service';
import { CreatePosicionesDto } from './dto/create-posicione.dto';
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
import { UpdatePosicionesDto } from './dto/update-posicione.dto';

@ApiTags('Posiciones')
@ApiBearerAuth('bearer-token')
@Controller('posiciones')
export class PosicionesController {
  constructor(private readonly posicionesService: PosicionesService) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar posición',
    description:
      'Registra una nueva posición GPS de un dispositivo (ej. desde el validador).',
  })
  @ApiBody({
    type: CreatePosicionesDto,
    description:
      'Datos de la posición: idDispositivo, latitud, longitud, fechaHora, etc.',
  })
  @ApiResponse({
    status: 201,
    description: 'Posición registrada exitosamente',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            idDispositivo: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Error de validación' })
  create(@Body() createPosicionesDto: CreatePosicionesDto) {
    return this.posicionesService.create(createPosicionesDto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar posición',
    description: 'Modifica una posición registrada.',
  })
  @ApiParam({ name: 'id', description: 'ID de la posición a actualizar' })
  @ApiBody({
    type: UpdatePosicionesDto,
    description: 'Campos a actualizar de la posición',
  })
  @ApiResponse({
    status: 200,
    description: 'Posición actualizada correctamente',
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
  @ApiResponse({ status: 404, description: 'Posición no encontrada' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePosicionesDto: UpdatePosicionesDto,
  ): Promise<ApiCrudResponse> {
    return this.posicionesService.update(id, updatePosicionesDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('list')
  @ApiOperation({
    summary: 'Listar posiciones',
    description:
      'Obtiene el listado de posiciones/dispositivos. El acceso depende del rol del usuario.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de posiciones',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              latitud: { type: 'number' },
              longitud: { type: 'number' },
              idDispositivo: { type: 'number' },
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
    const idUser = req.user.userId;
    return await this.posicionesService.findAllList(+idUser, +cliente, +rol);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Listar posiciones paginadas',
    description:
      'Obtiene el catálogo paginado de posiciones. El acceso depende del rol del usuario.',
  })
  @ApiParam({ name: 'page', description: 'Número de página (desde 1)' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de posiciones',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              latitud: { type: 'number' },
              longitud: { type: 'number' },
              idDispositivo: { type: 'number' },
              fechaHora: { type: 'string' },
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
    const idUser = req.user.userId;
    return await this.posicionesService.findAll(
      +idUser,
      +cliente,
      +rol,
      page,
      limit,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiOperation({
    summary: 'Obtener posición por ID',
    description: 'Obtiene el detalle de una posición por su ID.',
  })
  @ApiParam({ name: 'id', description: 'ID de la posición' })
  @ApiResponse({
    status: 200,
    description: 'Detalle de la posición',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            latitud: { type: 'number' },
            longitud: { type: 'number' },
            idDispositivo: { type: 'number' },
            fechaHora: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Posición no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findOne(@Param('id') id: string) {
    return this.posicionesService.findOne(+id);
  }
}
