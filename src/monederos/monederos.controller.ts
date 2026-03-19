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
import { MonederosService } from './monederos.service';
import { CreateMonederoDto } from './dto/create-monedero.dto';
import { UpdateMonederoDto } from './dto/update-monedero.dto';
import { UpdateMonederoEstatusDto } from './dto/update-monedero-estatus.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiResponseCommon } from 'src/common/ApiResponse';
import { UpdateMonederoCatPasajeroDto } from './dto/update-monedero-catpasajero.dto';
import { UpdateMonederoExtravioDto } from './dto/update-monedero-extravio.dto';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';

@ApiTags('Monederos')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('monederos')
export class MonederosController {
  constructor(private readonly monederosService: MonederosService) {}

  // ========================================
  // 🔹 POST ROUTES
  // ========================================

  @Post('reporte/extravio')
  @ApiOperation({
    summary: 'Reportar monedero extraviado',
    description: 'Registra el reporte de un monedero extraviado o perdido.',
  })
  @ApiBody({
    type: UpdateMonederoExtravioDto,
    description: 'Datos del reporte de extravío',
  })
  @ApiResponse({
    status: 201,
    description: 'Extravío reportado exitosamente',
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
  reportarExtravio(@Body() updateMonederoExtravioDto: UpdateMonederoExtravioDto, @Request() req) {
    const idUser = req.user.userId;
    return this.monederosService.reportarExtravio(+idUser, updateMonederoExtravioDto);
  }

  @Post()
  @ApiOperation({
    summary: 'Crear monedero',
    description: 'Registra un nuevo monedero electrónico asociado a un pasajero.',
  })
  @ApiBody({
    type: CreateMonederoDto,
    description: 'Datos del monedero: número de serie, idPasajero, idCatPasajero, etc.',
  })
  @ApiResponse({
    status: 201,
    description: 'Monedero creado exitosamente',
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
  @ApiResponse({ status: 400, description: 'Error de validación o serie duplicada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  createMonedero(@Body() createMonederoDto: CreateMonederoDto, @Request() req) {
    const idUser = req.user.userId;
    return this.monederosService.createMonedero(createMonederoDto, idUser);
  }

  // ========================================
  // 🔹 GET ROUTES - Rutas específicas primero
  // ========================================

  @Get('list')
  @ApiOperation({
    summary: 'Listar monederos',
    description: 'Obtiene el listado de monederos activos. El acceso depende del rol del usuario.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de monederos',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: { type: 'number' }, numeroSerie: { type: 'string' }, idPasajero: { type: 'number' }, estatus: { type: 'number' } },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findAllListMonederos(@Request() req): Promise<ApiResponseCommon> {
    const idUser = req.user.userId;
    const email = req.user.email;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.monederosService.findAllListMonederos(
      idUser,
      email,
      cliente,
      rol,
    );
  }

  @Get('numero/serie/:idCard')
  @ApiOperation({
    summary: 'Obtener monedero por número de serie',
    description: 'Busca un monedero por su número de serie/tarjeta.',
  })
  @ApiParam({ name: 'idCard', description: 'Número de serie de la tarjeta/monedero' })
  @ApiResponse({
    status: 200,
    description: 'Detalle del monedero',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: { id: { type: 'number' }, numeroSerie: { type: 'string' }, idPasajero: { type: 'number' }, saldo: { type: 'number' }, estatus: { type: 'number' } },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Monedero no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findOneMonederoBySerie(
    @Param('idCard') idCard: string,
    @Request() req,
  ) {
    return this.monederosService.findOneMonederoBySerie(idCard);
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Listar monederos paginados',
    description: 'Obtiene el catálogo paginado de monederos. El acceso depende del rol del usuario.',
  })
  @ApiParam({ name: 'page', description: 'Número de página (desde 1)' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de monederos',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: { type: 'number' }, numeroSerie: { type: 'string' }, idPasajero: { type: 'number' }, saldo: { type: 'number' }, estatus: { type: 'number' } },
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
  findAllMonederos(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const idUser = req.user.userId;
    const email = req.user.email;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.monederosService.findAllPagMonederos(
      +idUser,
      email,
      +cliente,
      +rol,
      page,
      limit,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener monedero por ID',
    description: 'Obtiene el detalle de un monedero por su ID.',
  })
  @ApiParam({ name: 'id', description: 'ID del monedero' })
  @ApiResponse({
    status: 200,
    description: 'Detalle del monedero',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: { id: { type: 'number' }, numeroSerie: { type: 'string' }, idPasajero: { type: 'number' }, saldo: { type: 'number' }, estatus: { type: 'number' } },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Monedero no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findOneMonedero(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.monederosService.findOneMonedero(id);
  }

  // ========================================
  // 🔹 PUT ROUTES - Rutas específicas primero
  // ========================================

  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar monedero',
    description: 'Modifica los datos de un monedero existente.',
  })
  @ApiParam({ name: 'id', description: 'ID del monedero a actualizar' })
  @ApiBody({
    type: UpdateMonederoDto,
    description: 'Campos a actualizar del monedero',
  })
  @ApiResponse({
    status: 200,
    description: 'Monedero actualizado correctamente',
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
  @ApiResponse({ status: 404, description: 'Monedero no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  updateMonedero(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMonederoDto: UpdateMonederoDto,
    @Request() req,
  ) {
    const idUser = req.user.userId;
    return this.monederosService.updateMonedero(id, idUser, updateMonederoDto);
  }

  // ========================================
  // 🔹 PATCH ROUTES - Rutas específicas primero
  // ========================================

  @Patch('tipo/pasajero/:id')
  @ApiOperation({
    summary: 'Actualizar tipo de pasajero del monedero',
    description: 'Cambia el tipo de pasajero (categoría tarifaria) asociado a un monedero.',
  })
  @ApiParam({ name: 'id', description: 'ID del monedero' })
  @ApiBody({
    type: UpdateMonederoCatPasajeroDto,
    description: 'idCatPasajero (nuevo tipo de pasajero)',
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
  @ApiResponse({ status: 404, description: 'Monedero no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  updateMonederoTipoPasajero(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMonederoCatPasajeroDto: UpdateMonederoCatPasajeroDto,
    @Request() req,
  ) {
    const idUser = req.user.userId;
    return this.monederosService.updateMonederoTipoPasajero(
      id,
      idUser,
      updateMonederoCatPasajeroDto,
    );
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Actualizar estatus del monedero',
    description: 'Cambia el estatus de un monedero (0=Inactivo, 1=Activo).',
  })
  @ApiParam({ name: 'id', description: 'ID del monedero' })
  @ApiBody({
    type: UpdateMonederoEstatusDto,
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
  @ApiResponse({ status: 404, description: 'Monedero no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  updateMonederoEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMonederoEstatusDto: UpdateMonederoEstatusDto,
    @Request() req,
  ) {
    const idUser = req.user.userId;
    return this.monederosService.updateMonederoEstatus(
      id,
      idUser,
      updateMonederoEstatusDto,
    );
  }

  // ========================================
  // 🔹 DELETE ROUTES
  // ========================================

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar monedero',
    description: 'Eliminación lógica: cambia el estatus del monedero a inactivo.',
  })
  @ApiParam({ name: 'id', description: 'ID del monedero a eliminar' })
  @ApiResponse({
    status: 200,
    description: 'Monedero eliminado correctamente',
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
  @ApiResponse({ status: 404, description: 'Monedero no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  removeMonedero(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const idUser = req.user.userId;
    return this.monederosService.removeMonedero(id, idUser);
  }
}
