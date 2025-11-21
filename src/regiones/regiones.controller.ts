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
import { RegionesService } from './regiones.service';
import { CreateRegionesDto } from './dto/create-regione.dto';
import { UpdateRegioneDto } from './dto/update-regione.dto';
import { UpdateRegionesEstatusDto } from './dto/update-regione-estatus.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

@ApiTags('Regiones')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('regiones')
export class RegionesController {
  constructor(private readonly regionesService: RegionesService) {}

  @Post()
  create(@Body() createRegionesDto: CreateRegionesDto, @Request() req) {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.regionesService.create(
      +idUser,
      +cliente,
      +rol,
      createRegionesDto,
    );
  }

  @Get('list')
  async findAllList(@Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return await this.regionesService.findAllList(+cliente, +idUser, +rol);
  }

  @Get('by-cliente/:idCliente')
  @ApiOperation({
    summary: 'Listar regiones por ID de cliente',
    description: 'Obtiene todas las regiones activas pertenecientes únicamente al cliente especificado (sin incluir clientes hijos).',
  })
  @ApiParam({
    name: 'idCliente',
    type: Number,
    description: 'ID del cliente del cual se desean obtener las regiones',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Regiones obtenidas exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
  })
  async findByCliente(
    @Param('idCliente', ParseIntPipe) idCliente: number,
    @Request() req,
  ) {
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return await this.regionesService.findByCliente(+idCliente, +idUser, +rol);
  }

  @Get(':page/:limit')
  findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
  ) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.regionesService.findAll(+cliente, +idUser, +rol, page, limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.regionesService.findOne(+idUser, +id, +cliente, +rol);
  }

  @Patch('estatus/:id')
  async updateEstatus(
    @Param('id') id: string,
    @Body() updateRegionesEstatusDto: UpdateRegionesEstatusDto,
    @Request() req,
  ) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return await this.regionesService.updateEstatus(
      +id,
      +idUser,
      +cliente,
      +rol,
      updateRegionesEstatusDto,
    );
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateRegioneDto: UpdateRegioneDto,
    @Request() req,
  ) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.regionesService.update(
      +id,
      +cliente,
      +idUser,
      +rol,
      updateRegioneDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.regionesService.remove(+id, +cliente, +idUser, +rol);
  }
}
