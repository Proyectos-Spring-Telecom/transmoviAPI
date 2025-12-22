import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  Request,
  Patch,
} from '@nestjs/common';
import { TransaccionesService } from './transacciones.service';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { CreateTransaccioneDebitoDto } from './dto/create-transaccione-debito.dto';
import { CreateTransaccioneRecargaDto } from './dto/create-transaccione-recarga.dto';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UpdateTransaccioneDebitoDto } from './dto/update-transaccione-debito.dto';
import { GetTransaccioneDto } from './dto/get-transacciones.dto';
import { GetHistoricoRecargasDto } from './dto/get-historico-recargas.dto';

@ApiTags('Transacciones')
@Controller('transacciones')
@ApiBearerAuth('bearer-token')
export class TransaccionesController {
  constructor(private readonly transaccionesService: TransaccionesService) { }

  // ========================================
  // 🔹 POST ROUTES - Rutas específicas primero
  // ========================================

  @Post('debito')
  @UseGuards(JwtAuthGuard)
  createTransaccionDebito(
    @Body() createTransaccioneDebitoDto: CreateTransaccioneDebitoDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.transaccionesService.createTransaccionDebitoPrueba(
      createTransaccioneDebitoDto,
      idUser,
      req.user.cliente,
    );
  }

  @Post('recarga')
  @UseGuards(JwtAuthGuard)
  createTransaccionRecarga(
    @Body() createTransaccioneRecargaDto: CreateTransaccioneRecargaDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.transaccionesService.createTransaccionRecarga(
      createTransaccioneRecargaDto,
      idUser,
    );
  }

  @Patch('debito')
  @UseGuards(JwtAuthGuard)
  updateTransaccionDebito(
    @Body() updateTransaccioneDebitoDto: UpdateTransaccioneDebitoDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.transaccionesService.updateTransaccionDebito(
      updateTransaccioneDebitoDto,
      idUser,
    );
  }

  @Post('paginado')
  @UseGuards(JwtAuthGuard)
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
      getTransaccioneDto.page,
      getTransaccioneDto.limit,
      getTransaccioneDto.fechaInicio,
      getTransaccioneDto.fechaFin
    );
  }

  @Post('recargas/historico')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Obtiene el histórico de recargas paginado',
    description:
      'Obtiene el histórico de recargas con paginación. Los filtros se aplican según el rol del usuario:\n' +
      '- SA (rol 1): Todas las recargas\n' +
      '- ADMIN (rol 2): Sus recargas y las de clientes hijos\n' +
      '- Cajero (rol 3): Solo sus recargas\n' +
      '- Pasajero (rol 9): Solo las recargas de sus monederos',
  })
  @ApiResponse({ status: 200, description: 'Histórico de recargas obtenido exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  async getHistoricoRecargas(
    @Body() getHistoricoRecargasDto: GetHistoricoRecargasDto,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const idUser = req.user.userId;
    const email = req.user.email;
    const cliente = req.user.cliente;
    const rol = req.user.rol;

    return await this.transaccionesService.getHistoricoRecargasPaginado(
      +idUser,
      email,
      +cliente,
      +rol,
      getHistoricoRecargasDto,
    );
  }

  // ========================================
  // 🔹 GET ROUTES - Rutas específicas primero
  // ========================================

  @Get('list')
  @UseGuards(JwtAuthGuard)
  async findAllListTransacciones(@Request() req): Promise<ApiResponseCommon> {
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return await this.transaccionesService.findAllListTransacciones(cliente, rol);
  }

  @Get('RECARGA/:id')
  @UseGuards(JwtAuthGuard)
  findOneTransaccioneRecarga(@Param('id', ParseIntPipe) id: number) {
    return this.transaccionesService.findOneTransaccionRecarga(id);
  }

  @Get('DEBITO/:id')
  @UseGuards(JwtAuthGuard)
  findOneTransaccioneDebito(@Param('id', ParseIntPipe) id: number) {
    return this.transaccionesService.findOneTransaccionDebito(id);
  }

/*   @Get(':page/:limit')
  @UseGuards(JwtAuthGuard)
  async findAllTransacciones(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const idUser = req.user.userId;
    const email = req.user.email;
    const cliente = req.user.cliente;
    const rol = req.user.rol;

    return await this.transaccionesService.findAllTransacciones(
      +idUser,
      email,
      +cliente,
      +rol,
      page,
      limit
    );
  } */
}
