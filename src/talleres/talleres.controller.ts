import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import { TalleresService } from './talleres.service';
import { CreateTallereDto } from './dto/create-tallere.dto';
import { UpdateTallereDto } from './dto/update-tallere.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiResponseCommon } from 'src/common/ApiResponse';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';

@ApiTags('Talleres')
@ApiBearerAuth('bearer-token')
@Controller('talleres')
@UseGuards(JwtAuthGuard)
export class TalleresController {
  constructor(private readonly talleresService: TalleresService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear taller',
    description: 'Registra un nuevo taller de mantenimiento asociado al cliente.',
  })
  @ApiBody({
    type: CreateTallereDto,
    description: 'Datos del taller: nombre, dirección, teléfono, idCliente, etc.',
  })
  @ApiResponse({
    status: 201,
    description: 'Taller creado exitosamente',
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
  create(@Body() createTallereDto: CreateTallereDto, @Req() req: any) {
    createTallereDto.idCliente = Number(req.user.cliente);

    return this.talleresService.create(createTallereDto, req.user.userId);
  }

  @Get('list')
  @ApiOperation({
    summary: 'Listar talleres',
    description: 'Obtiene el listado de talleres del cliente del usuario autenticado.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de talleres',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: { type: 'number' }, nombre: { type: 'string' }, direccion: { type: 'string' }, idCliente: { type: 'number' } },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findAll(@Req() req:any) {
    console.log(req.user)
    return this.talleresService.findAll(req);
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Listar talleres paginados',
    description: 'Obtiene el catálogo paginado de talleres del cliente.',
  })
  @ApiParam({ name: 'page', description: 'Número de página (desde 1)' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de talleres',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: { type: 'number' }, nombre: { type: 'string' }, direccion: { type: 'string' }, idCliente: { type: 'number' }, estatus: { type: 'number' } },
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
  findAllPaginated(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    return this.talleresService.findAllPaginated(req, page, limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener taller por ID',
    description: 'Obtiene el detalle de un taller por su ID.',
  })
  @ApiParam({ name: 'id', description: 'ID del taller' })
  @ApiResponse({
    status: 200,
    description: 'Detalle del taller',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: { id: { type: 'number' }, nombre: { type: 'string' }, direccion: { type: 'string' }, telefono: { type: 'string' }, idCliente: { type: 'number' }, estatus: { type: 'number' } },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Taller no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findOne(@Param('id') id: string) {
    return this.talleresService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar taller',
    description: 'Modifica los datos de un taller existente.',
  })
  @ApiParam({ name: 'id', description: 'ID del taller a actualizar' })
  @ApiBody({
    type: UpdateTallereDto,
    description: 'Campos a actualizar: nombre, dirección, teléfono, etc.',
  })
  @ApiResponse({
    status: 200,
    description: 'Taller actualizado correctamente',
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
  @ApiResponse({ status: 404, description: 'Taller no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  update(@Param('id') id: string, @Body() updateTallereDto: UpdateTallereDto,@Req() req) {
    return this.talleresService.update(+id, updateTallereDto,req.user.userId);
  }
  @Patch('desactivar/:id')
  @ApiOperation({
    summary: 'Desactivar taller',
    description: 'Desactiva un taller (cambia estatus a inactivo).',
  })
  @ApiParam({ name: 'id', description: 'ID del taller a desactivar' })
  @ApiResponse({
    status: 200,
    description: 'Taller desactivado correctamente',
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
  @ApiResponse({ status: 404, description: 'Taller no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  remove(@Param('id') id: number,@Req() req:any) {
    return this.talleresService.remove(+id,Number(req.user.userId));
  }
  @Patch('activar/:id')
  @ApiOperation({
    summary: 'Activar taller',
    description: 'Activa un taller previamente desactivado.',
  })
  @ApiParam({ name: 'id', description: 'ID del taller a activar' })
  @ApiResponse({
    status: 200,
    description: 'Taller activado correctamente',
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
  @ApiResponse({ status: 404, description: 'Taller no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  activar(@Param('id') id: number,@Req() req:any) {
    return this.talleresService.activar(+id,Number(req.user.userId));
  }
}
