import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  ParseIntPipe,
  Put,
} from '@nestjs/common';
import { DerroterosService } from './derroteros.service';
import { CreateDerroteroDto } from './dto/create-derrotero.dto';
import { UpdateDerroteroDto } from './dto/update-derrotero.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { UpdateDerroterosEstatusDto } from './dto/update-derrotero-estatus.dto';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

@ApiTags('Derroteros')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('derroteros')
export class DerroterosController {
  constructor(private readonly derroterosService: DerroterosService) {}

  @Post()
  create(@Body() createDerroteroDto: CreateDerroteroDto, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.derroterosService.create(+idUser, +cliente, +rol, createDerroteroDto);
  }

  @Get('list')
  findAllList(@Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.derroterosService.findAllList(+idUser, +cliente, +rol);
  }

  @Get('by-ruta/:idRuta')
  @ApiOperation({
    summary: 'Listar derroteros por ID de ruta',
    description: 'Obtiene todos los derroteros activos pertenecientes únicamente a la ruta especificada.',
  })
  @ApiParam({
    name: 'idRuta',
    type: Number,
    description: 'ID de la ruta de la cual se desean obtener los derroteros',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Derroteros obtenidos exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
  })
  async findByRuta(
    @Param('idRuta', ParseIntPipe) idRuta: number,
    @Request() req,
  ) {
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return await this.derroterosService.findByRuta(+idRuta, +idUser, +rol);
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
    return this.derroterosService.findAll(+idUser, +cliente, +rol, page, limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.derroterosService.findOne(+id, +idUser, +cliente, +rol);
  }

  @Patch('estatus/:id')
  updateEstatus(
    @Param('id') id: string,
    @Body() updateDerroterosEstatusDto: UpdateDerroterosEstatusDto,
    @Request() req,
  ) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.derroterosService.updateEstatus(+id, +idUser, +cliente, +rol, updateDerroterosEstatusDto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateDerroteroDto: UpdateDerroteroDto,
    @Request() req,
  ) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.derroterosService.update(+id, +idUser, +cliente, +rol, updateDerroteroDto);
  }

  @Delete('eliminado/total/:id')
  removeTotal(@Param('id') id: string, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.derroterosService.removeTotal(+id, +idUser, +cliente, +rol);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.derroterosService.remove(+id, +idUser, +cliente, +rol);
  }

}
