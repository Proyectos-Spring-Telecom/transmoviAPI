import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import { TransaccionesService } from './transacciones.service';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { CreateTransaccioneDebitoDto } from './dto/create-transaccione-debito.dto';
import { CreateTransaccioneRecargaDto } from './dto/create-transaccione-recarga.dto';

@UseGuards(JwtAuthGuard)
@Controller('transacciones')
export class TransaccionesController {
  constructor(private readonly transaccionesService: TransaccionesService) {}

  // ========================================
  // 🔹 POST ROUTES - Rutas específicas primero
  // ========================================

  @Post('debito')
  createTransaccionDebito(
    @Body() createTransaccioneDebitoDto: CreateTransaccioneDebitoDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.transaccionesService.createTransaccionDebito(
      createTransaccioneDebitoDto,
      idUser,
    );
  }

  @Post('recarga')
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

  // ========================================
  // 🔹 GET ROUTES - Rutas específicas primero
  // ========================================

  @Get('list')
  async findAllListTransacciones(@Request() req): Promise<ApiResponseCommon> {
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return await this.transaccionesService.findAllListTransacciones(cliente, rol);
  }

  @Get('RECARGA/:id')
  findOneTransaccioneRecarga(@Param('id', ParseIntPipe) id: number) {
    return this.transaccionesService.findOneTransaccionRecarga(id);
  }

  @Get('DEBITO/:id')
  findOneTransaccioneDebito(@Param('id', ParseIntPipe) id: number) {
    return this.transaccionesService.findOneTransaccionDebito(id);
  }

  @Get(':page/:limit')
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
      idUser, 
      email, 
      cliente, 
      rol, 
      page, 
      limit
    );
  }
}
