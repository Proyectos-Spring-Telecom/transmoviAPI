import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
  Request,
  Patch,
} from '@nestjs/common';
import { TransaccionesService } from './transacciones.service';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import {
  ApiCrudResponse,
  ApiCrudTransaccionRecarga,
  ApiResponseCommon,
} from 'src/common/ApiResponse';
import { CreateTransaccioneDebitoDto } from './dto/create-transaccione-debito.dto';
import { CreateTransaccioneRecargaDto } from './dto/create-transaccione-recarga.dto';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { UpdateTransaccioneDebitoDto } from './dto/update-transaccione-debito.dto';
import { GetTransaccioneDto } from './dto/get-transacciones.dto';

@ApiTags('Transacciones')
@Controller('transacciones')
@ApiBearerAuth('bearer-token')
export class TransaccionesController {
  constructor(private readonly transaccionesService: TransaccionesService) {}

  @Post('debito')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Crear/cerrar transacción de débito',
    description:
      'Registra una nueva transacción de débito (validación) o cierra una existente.',
  })
  @ApiBody({
    type: CreateTransaccioneDebitoDto,
    description:
      'Datos de la transacción de débito: idMonedero, idDispositivo, idDerrotero, monto, etc.',
  })
  @ApiResponse({
    status: 201,
    description: 'Transacción de débito procesada exitosamente',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            monto: { type: 'number' },
            saldoRestante: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación o saldo insuficiente',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  createTransaccionDebito(
    @Body() createTransaccioneDebitoDto: CreateTransaccioneDebitoDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    console.log('[POST /transacciones/debito] Inicio', {
      idUser,
      idViaje: createTransaccioneDebitoDto.idViaje,
      numeroSerieDispositivo:
        createTransaccioneDebitoDto.numeroSerieDispositivo,
      tieneIdCard: !!createTransaccioneDebitoDto.idCardMonedero,
      tieneNumeroSerieMonedero:
        !!createTransaccioneDebitoDto.numeroSerieMonedero,
    });
    return this.transaccionesService.createOrCloseTransaccionDebito(
      createTransaccioneDebitoDto,
      idUser,
    );
  }

  @Post('recarga')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Crear transacción de recarga',
    description: 'Registra una recarga de saldo en un monedero electrónico.',
  })
  @ApiBody({
    type: CreateTransaccioneRecargaDto,
    description: 'Datos de la recarga: idMonedero, monto, idMetodoPago, etc.',
  })
  @ApiResponse({
    status: 201,
    description: 'Recarga procesada exitosamente',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            monto: { type: 'number' },
            saldoNuevo: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Error de validación' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  createTransaccionRecarga(
    @Body() createTransaccioneRecargaDto: CreateTransaccioneRecargaDto,
    @Request() req,
  ): Promise<ApiCrudTransaccionRecarga> {
    const idUser = req.user.userId;
    return this.transaccionesService.createTransaccionRecarga(
      createTransaccioneRecargaDto,
      idUser,
    );
  }

  @Post('paginado/recargas')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Listar recargas paginadas',
    description:
      'Obtiene el listado paginado de transacciones de recarga con filtros por fecha.',
  })
  @ApiBody({
    type: GetTransaccioneDto,
    description: 'page, limit, fechaInicio, fechaFin (opcionales)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de recargas',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              monto: { type: 'number' },
              idMonedero: { type: 'number' },
              fecha: { type: 'string' },
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
  async paginadoTransaccionRecargas(
    @Body() getTransaccioneDto: GetTransaccioneDto,
    @Request() req,
  ) {
    const idUser = req.user.userId;
    const email = req.user.email;
    const cliente = req.user.cliente;
    const rol = req.user.rol;

    return await this.transaccionesService.paginadoRecarga(
      +idUser,
      email,
      +cliente,
      +rol,
      getTransaccioneDto,
    );
  }

  @Post('paginado')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Listar transacciones paginadas',
    description:
      'Obtiene el listado paginado de transacciones (débitos) con filtros por fecha.',
  })
  @ApiBody({
    type: GetTransaccioneDto,
    description: 'page, limit, fechaInicio, fechaFin (opcionales)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de transacciones',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              monto: { type: 'number' },
              idMonedero: { type: 'number' },
              idDispositivo: { type: 'number' },
              fecha: { type: 'string' },
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
  async paginadoTransaccion(
    @Body() getTransaccioneDto: GetTransaccioneDto,
    @Request() req,
  ) {
    const idUser = req.user.userId;
    const email = req.user.email;
    const cliente = req.user.cliente;
    const rol = req.user.rol;

    return await this.transaccionesService.paginado(
      +idUser,
      email,
      +cliente,
      +rol,
      getTransaccioneDto,
    );
  }

  @Get('list')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Listar transacciones',
    description:
      'Obtiene el listado de transacciones. El acceso depende del rol del usuario.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de transacciones',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              monto: { type: 'number' },
              tipo: { type: 'string' },
              fecha: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllListTransacciones(@Request() req): Promise<ApiResponseCommon> {
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return await this.transaccionesService.findAllListTransacciones(
      cliente,
      rol,
    );
  }

  @Get('RECARGA/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Obtener transacción de recarga por ID',
    description: 'Obtiene el detalle de una transacción de recarga por su ID.',
  })
  @ApiParam({ name: 'id', description: 'ID de la transacción de recarga' })
  @ApiResponse({
    status: 200,
    description: 'Detalle de la transacción de recarga',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            monto: { type: 'number' },
            idMonedero: { type: 'number' },
            idMetodoPago: { type: 'number' },
            fecha: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Transacción no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findOneTransaccioneRecarga(@Param('id', ParseIntPipe) id: number) {
    return this.transaccionesService.findOneTransaccionRecarga(id);
  }

  @Get('DEBITO/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Obtener transacción de débito por ID',
    description:
      'Obtiene el detalle de una transacción de débito (validación) por su ID.',
  })
  @ApiParam({ name: 'id', description: 'ID de la transacción de débito' })
  @ApiResponse({
    status: 200,
    description: 'Detalle de la transacción de débito',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            monto: { type: 'number' },
            idMonedero: { type: 'number' },
            idDispositivo: { type: 'number' },
            idDerrotero: { type: 'number' },
            fecha: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Transacción no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findOneTransaccioneDebito(@Param('id', ParseIntPipe) id: number) {
    return this.transaccionesService.findOneTransaccionDebito(id);
  }
}
