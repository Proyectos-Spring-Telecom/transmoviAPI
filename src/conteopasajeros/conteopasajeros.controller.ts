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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UpdateConteoPasajerosDto } from './dto/update-conteopasajero.dto';

@ApiTags('Conteo pasajeros')
@ApiBearerAuth('bearer-token')
@Controller('conteopasajeros')
export class ConteopasajerosController {
  constructor(
    private readonly conteopasajerosService: ConteopasajerosService,
  ) { }

  @Post()
  async create(
    @Body() createConteopasajeroDto: CreateConteoPasajerosDto,
  ): Promise<ApiCrudResponse> {
    return this.conteopasajerosService.create(createConteopasajeroDto);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateConteoPasajerosDto: UpdateConteoPasajerosDto): Promise<ApiCrudResponse> {
    return this.conteopasajerosService.update(+id, updateConteoPasajerosDto)
  }

  // RUTAS ESPECÍFICAS PRIMERO (orden correcto)
  @UseGuards(JwtAuthGuard)
  @Get('list')
  async findAllList(): Promise<ApiResponseCommon> {
    return await this.conteopasajerosService.findAllList();
  }

  @UseGuards(JwtAuthGuard)
  @Get('hoy')
  async findToday(
    @Query('page') page: number,
    @Query('limit') limit: number,
  ): Promise<ApiResponseCommon> {
    return await this.conteopasajerosService.findTodayPaginated(page, limit);
  }

  // 📅 5. OBTENER DATOS DE LA ÚLTIMA SEMANA
  // GET /conteo-pasajeros/ultima-semana
  @UseGuards(JwtAuthGuard)
  @Get('ultima-semana')
  async findLastWeek(
    @Query('page') page: number,
    @Query('limit') limit: number,
  ): Promise<ApiResponseCommon> {
    return await this.conteopasajerosService.findLastWeekPaginated(page, limit);
  }

  // 🗓️ 1. OBTENER DATOS DE UN DÍA ESPECÍFICO
  @UseGuards(JwtAuthGuard)
  @Get('fecha/:fecha')
  async findByDate(
    @Param('fecha') fecha: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ): Promise<ApiResponseCommon> {
    return await this.conteopasajerosService.findByDatePaginated(
      fecha,
      page,
      limit,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('rango/:fechaInicio/:fechaFin')
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
  @Get('fecha-hora/:fecha/:hora')
  async findByDateTime(
    @Param('fecha') fecha: string,
    @Param('hora') hora: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ): Promise<ApiResponseCommon> {
    return await this.conteopasajerosService.findByDateTimePaginated(
      fecha,
      hora,
      page,
      limit,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('bluevox/:numeroSerie/hoy')
  async findByBlueVoxToday(
    @Param('numeroSerie') numeroSerie: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ): Promise<ApiResponseCommon> {
    const today = new Date().toISOString().split('T')[0];
    return await this.conteopasajerosService.findByBlueVoxAndDatePaginated(
      numeroSerie,
      today,
      today,
      page,
      limit,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('bluevox/:numeroSerie/rango/:fechaInicio/:fechaFin')
  async findByBlueVoxAndDate(
    @Param('numeroSerie') numeroSerie: string,
    @Param('fechaInicio') fechaInicio: string,
    @Param('fechaFin') fechaFin: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ): Promise<ApiResponseCommon> {
    return await this.conteopasajerosService.findByBlueVoxAndDatePaginated(
      numeroSerie,
      fechaInicio,
      fechaFin,
      page,
      limit,
    );
  }

  // Resúmenes (sin paginación)
  @UseGuards(JwtAuthGuard)
  @Get('resumen-horas/:fecha')
  async getHourlySummary(@Param('fecha') fecha: string): Promise<any[]> {
    return await this.conteopasajerosService.getHourlySummary(fecha);
  }

  @UseGuards(JwtAuthGuard)
  @Get('resumen-diario/:year/:month')
  async getDailySummary(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
  ): Promise<any[]> {
    return await this.conteopasajerosService.getDailySummary(year, month);
  }

  // RUTAS DINÁMICAS AL FINAL
  @UseGuards(JwtAuthGuard)
  @Get(':page/:limit')
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
      limit
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.conteopasajerosService.findOne(+id);
  }
}
