import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Request,
  ParseIntPipe,
  Put,
} from '@nestjs/common';
import { LicenciasService } from './licencias.service';
import { CreateLicenciaDto } from './dto/create-licencia.dto';
import { UpdateLicenciaDto } from './dto/update-licencia.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';

@ApiTags('Licencias')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('licencias')
export class LicenciasController {
  constructor(private readonly licenciasService: LicenciasService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear licencia',
    description: 'Registra una nueva licencia de operador. El número de licencia debe ser único.',
  })
  @ApiBody({
    type: CreateLicenciaDto,
    description: 'numeroLicencia, idOperador, idCatTipoLicencia, idCategoriaLicencia, fechaExpedicion, fechaVencimiento, estatus',
  })
  @ApiResponse({
    status: 201,
    description: 'Licencia creada exitosamente',
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
  @ApiResponse({ status: 400, description: 'La licencia ya existe' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  create(@Body() createLicenciaDto: CreateLicenciaDto, @Request() req) {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.licenciasService.create(idUser, createLicenciaDto);
  }

  @Get('list')
  @ApiOperation({
    summary: 'Listar licencias',
    description: 'Obtiene el listado de licencias sin paginación. El acceso depende del rol del usuario.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de licencias',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              idLicencia: { type: 'number' },
              numeroLicencia: { type: 'string' },
              nombreOperador: { type: 'string' },
              tipoLicencia: { type: 'string' },
              categoriaLicencia: { type: 'string' },
              fechaExpedicion: { type: 'string' },
              fechaVencimiento: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findAllList(@Request() req) {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.licenciasService.findAllList(+cliente, +rol);
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Listar licencias paginadas',
    description: 'Obtiene el catálogo paginado de licencias. El acceso depende del rol del usuario.',
  })
  @ApiParam({ name: 'page', description: 'Número de página (desde 1)' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de licencias',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object' } },
        paginated: {
          type: 'object',
          properties: { total: { type: 'number' }, page: { type: 'number' }, lastPage: { type: 'number' } },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findAll(
    @Request() req,
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
  ) {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.licenciasService.findAll(+cliente, +rol, page, limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener licencia por ID',
    description: 'Obtiene el detalle de una licencia por su ID.',
  })
  @ApiParam({ name: 'id', description: 'ID de la licencia' })
  @ApiResponse({
    status: 200,
    description: 'Detalle de la licencia',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              idLicencia: { type: 'number' },
              numeroLicencia: { type: 'string' },
              nombreOperador: { type: 'string' },
              tipoLicencia: { type: 'string' },
              categoriaLicencia: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Licencia no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findOne(
    @Param('id') id: string,
    @Request() req,
  ) {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.licenciasService.findOne(+id, +cliente, +rol );
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar licencia',
    description: 'Modifica los datos de una licencia existente.',
  })
  @ApiParam({ name: 'id', description: 'ID de la licencia a actualizar' })
  @ApiBody({
    type: UpdateLicenciaDto,
    description: 'Campos a actualizar (todos opcionales)',
  })
  @ApiResponse({
    status: 200,
    description: 'Licencia actualizada correctamente',
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
  @ApiResponse({ status: 404, description: 'Licencia no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  update(
    @Param('id') id: string,
    @Body() updateLicenciaDto: UpdateLicenciaDto,
    @Request() req,
  ) {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.licenciasService.update(+id, +idUser, updateLicenciaDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar licencia',
    description: 'Elimina una licencia del sistema.',
  })
  @ApiParam({ name: 'id', description: 'ID de la licencia a eliminar' })
  @ApiResponse({
    status: 200,
    description: 'Licencia eliminada correctamente',
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
  @ApiResponse({ status: 404, description: 'Licencia no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  remove(
    @Param('id') id: string,
    @Request() req,
  ) {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.licenciasService.remove(+id, +idUser);
  }
}
