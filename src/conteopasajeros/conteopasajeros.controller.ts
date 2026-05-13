import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
  Request,
  Query,
  Patch,
} from '@nestjs/common';
import { ConteopasajerosService } from './conteopasajeros.service';
import { CreateConteoPasajerosDto } from './dto/create-conteopasajero.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { UpdateConteoPasajerosDto } from './dto/update-conteopasajero.dto';

@ApiTags('Conteo pasajeros')
@ApiBearerAuth('bearer-token')
@Controller('conteopasajeros')
export class ConteopasajerosController {
  constructor(
    private readonly conteopasajerosService: ConteopasajerosService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({
    summary: 'Crear registro de conteo de pasajeros',
    description:
      'Registra el conteo de entradas y salidas capturado por un dispositivo BlueVox. El número de serie del BlueVox es obligatorio. Si se proporciona idViaje, el viaje debe existir.',
  })
  @ApiBody({
    type: CreateConteoPasajerosDto,
    description:
      'entradas, salidas, diferencia (obligatorio), fechaHora (obligatorio), numeroSerieBlueVox (obligatorio), estatus (opcional), idViaje (opcional)',
  })
  @ApiResponse({
    status: 201,
    description: 'Registro de conteo creado exitosamente',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        message: {
          type: 'string',
          example: 'El registro de ConteoPasajero se realizó con éxito.',
        },
        data: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            nombre: { type: 'string', example: '1 BVX-2025-XYZ123' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({
    status: 404,
    description: 'BlueVox o Viaje no encontrado',
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
  })
  async create(
    @Body() createConteopasajeroDto: CreateConteoPasajerosDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    const idUser = req.user.userId;
    return this.conteopasajerosService.create(
      +idUser,
      +cliente,
      +rol,
      createConteopasajeroDto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar registro de conteo de pasajeros',
    description:
      'Actualiza un registro existente. Todos los campos son opcionales. No se puede actualizar si el conteo tiene estatus=0 (inactivo) o si el viaje asociado está inactivo.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del registro de conteo a actualizar',
  })
  @ApiBody({
    type: UpdateConteoPasajerosDto,
    description:
      'entradas, salidas, diferencia, fechaHora, estatus, idViaje (todos opcionales)',
  })
  @ApiResponse({
    status: 200,
    description: 'Registro de conteo actualizado exitosamente',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        message: {
          type: 'string',
          example: 'ConteoPasajero fue actualizada correctamente',
        },
        data: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            nombre: { type: 'string', example: 'ConteoPasajero 1' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'No se puede actualizar: el conteo tiene estatus 0 o el viaje asociado está inactivo',
  })
  @ApiResponse({
    status: 404,
    description: 'Registro de conteo no encontrado',
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
  })
  async update(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateConteoPasajerosDto: UpdateConteoPasajerosDto,
  ): Promise<ApiCrudResponse> {
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    const idUser = req.user.userId;
    return this.conteopasajerosService.update(
      +id,
      +idUser,
      +cliente,
      +rol,
      updateConteoPasajerosDto,
    );
  }

  // RUTAS ESPECÍFICAS PRIMERO (orden correcto)
  @UseGuards(JwtAuthGuard)
  @Get('list')
  @ApiOperation({
    summary: 'Listar todos los conteos de pasajeros',
    description:
      'Obtiene el listado completo de registros de conteo de pasajeros, ordenado por fecha y hora descendente.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de conteos de pasajeros',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              entradas: { type: 'number' },
              salidas: { type: 'number' },
              diferencia: { type: 'number' },
              fechaHora: { type: 'string' },
              fhRegistro: { type: 'string' },
              estatus: { type: 'number' },
              numeroSerieBlueVox: { type: 'string' },
              idViaje: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'ConteoPasajeros no encontrado' })
  async findAllList(): Promise<ApiResponseCommon> {
    return await this.conteopasajerosService.findAllList();
  }

  @UseGuards(JwtAuthGuard)
  @Get('rango/:fechaInicio/:fechaFin')
  @ApiOperation({
    summary: 'Conteos por rango de fechas (paginado)',
    description:
      'Obtiene los registros de conteo entre dos fechas. Formato: YYYY-MM-DD. El acceso depende del rol del usuario.',
  })
  @ApiParam({ name: 'fechaInicio', description: 'Fecha inicio (YYYY-MM-DD)' })
  @ApiParam({ name: 'fechaFin', description: 'Fecha fin (YYYY-MM-DD)' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Número de página',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Registros por página',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de conteos en el rango',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              entradas: { type: 'number' },
              salidas: { type: 'number' },
              diferencia: { type: 'number' },
              fechaHora: { type: 'string' },
              numeroSerieBlueVox: { type: 'string' },
              idCliente: { type: 'number' },
              NombreCompletoCliente: { type: 'string' },
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
  async findByDateRange(
    @Param('fechaInicio') fechaInicio: string,
    @Param('fechaFin') fechaFin: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    const idUser = req.user.userId;
    return await this.conteopasajerosService.findByDateRangePaginated(
      +idUser,
      +cliente,
      +rol,
      fechaInicio,
      fechaFin,
      page,
      limit,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('resumen-por-viaje/:fechaInicio/:fechaFin')
  @ApiOperation({
    summary: 'Resumen ascensos vs boletos por viaje (paginado)',
    description:
      'Por viaje en el rango: totalAscensos (SUM Entradas-Salidas en ConteoPasajeros), totalBoletos (COUNT HistoricoTransaccionesDebito tipo débito), vehiculo (JSON camelCase), blueVoxs (array JSON con conteos en rango por serie). Roles: 1 global; 2/8/10 jerarquía; 3 y default un cliente.',
  })
  @ApiParam({ name: 'fechaInicio', description: 'Fecha inicio (YYYY-MM-DD)' })
  @ApiParam({ name: 'fechaFin', description: 'Fecha fin (YYYY-MM-DD)' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Número de página',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Viajes por página',
    example: 10,
  })
  @ApiResponse({ status: 200, description: 'Lista paginada por viaje' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findResumenPorViaje(
    @Param('fechaInicio') fechaInicio: string,
    @Param('fechaFin') fechaFin: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    const idUser = req.user.userId;
    return this.conteopasajerosService.findResumenAscensosVsBoletosPorViaje(
      +idUser,
      +cliente,
      +rol,
      fechaInicio,
      fechaFin,
      page,
      limit,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Listar conteos paginados',
    description:
      'Obtiene el catálogo paginado de conteos de pasajeros. El acceso depende del rol (SuperAdmin ve todos; otros ven solo sus clientes).',
  })
  @ApiParam({ name: 'page', description: 'Número de página (desde 1)' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de conteos de pasajeros',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              entradas: { type: 'number' },
              salidas: { type: 'number' },
              diferencia: { type: 'number' },
              fechaHora: { type: 'string' },
              numeroSerieBlueVox: { type: 'string' },
              idCliente: { type: 'number' },
              NombreCompletoCliente: { type: 'string' },
              marcaBlueVox: { type: 'string' },
              modeloBlueVox: { type: 'string' },
              placaVehiculo: { type: 'string' },
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
  findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    const idUser = req.user.userId;
    return this.conteopasajerosService.findAll(
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
    summary: 'Obtener conteo por ID',
    description:
      'Obtiene el detalle de un registro de conteo de pasajeros por su ID.',
  })
  @ApiParam({ name: 'id', description: 'ID del registro de conteo' })
  @ApiResponse({
    status: 200,
    description: 'Detalle del conteo de pasajeros',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            entradas: { type: 'number' },
            salidas: { type: 'number' },
            diferencia: { type: 'number' },
            fechaHora: { type: 'string' },
            fhRegistro: { type: 'string' },
            estatus: { type: 'number' },
            numeroSerieBlueVox: { type: 'string' },
            idViaje: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'ConteoPasajeros no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findOne(@Param('id') id: string) {
    return this.conteopasajerosService.findOne(+id);
  }
}
