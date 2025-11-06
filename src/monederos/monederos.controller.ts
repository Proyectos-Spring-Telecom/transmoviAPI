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

@UseGuards(JwtAuthGuard)
@Controller('monederos')
export class MonederosController {
  constructor(private readonly monederosService: MonederosService) {}

  // ========================================
  // 🔹 POST ROUTES
  // ========================================

  @Post('reporte/extravio')
  reportarExtravio(@Body() updateMonederoExtravioDto: UpdateMonederoExtravioDto, @Request() req) {
    const idUser = req.user.userId;
    return this.monederosService.reportarExtravio(+idUser, updateMonederoExtravioDto);
  }

  @Post()
  createMonedero(@Body() createMonederoDto: CreateMonederoDto, @Request() req) {
    const idUser = req.user.userId;
    return this.monederosService.createMonedero(createMonederoDto, idUser);
  }

  // ========================================
  // 🔹 GET ROUTES - Rutas específicas primero
  // ========================================

  @Get('list')
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

  @Get('numero/serie/:numeroSerie')
  findOneMonederoBySerie(
    @Param('numeroSerie') numeroSerie: string,
    @Request() req,
  ) {
    return this.monederosService.findOneMonederoBySerie(numeroSerie);
  }

  @Get(':page/:limit')
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
      idUser,
      email,
      cliente,
      rol,
      page,
      limit,
    );
  }

  @Get(':id')
  findOneMonedero(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.monederosService.findOneMonedero(id);
  }

  // ========================================
  // 🔹 PUT ROUTES - Rutas específicas primero
  // ========================================

  @Put(':id')
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
  removeMonedero(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const idUser = req.user.userId;
    return this.monederosService.removeMonedero(id, idUser);
  }
}
