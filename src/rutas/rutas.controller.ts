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
import { RutasService } from './rutas.service';
import { CreateRutaDto } from './dto/create-ruta.dto';
import { UpdateRutaDto } from './dto/update-ruta.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { UpdateRutasEstatusDto } from './dto/update-ruta-estatus.dto';

@UseGuards(JwtAuthGuard)
@Controller('rutas')
export class RutasController {
  constructor(private readonly rutasService: RutasService) {}

  @Post()
  async create(@Body() createRutaDto: CreateRutaDto, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    return await this.rutasService.create(+idUser, +cliente, createRutaDto);
  }

  @Get('list')
  findAllList(@Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    return this.rutasService.findAllList(+idUser, +cliente);
  }

  @Get(':page/:limit')
  findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
  ) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    return this.rutasService.findAll(+cliente,+idUser,page,limit);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req,) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    return this.rutasService.findOne(id, +idUser, +cliente);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateRutaDto: UpdateRutaDto, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    return this.rutasService.update(id, idUser, cliente, updateRutaDto);
  }

  @Patch('estatus/:id')
  updateEstatus(@Param('id', ParseIntPipe)id: number, @Body() updateRutasEstatusDto: UpdateRutasEstatusDto, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    return this.rutasService.updateEstatus(id,+idUser,+cliente,updateRutasEstatusDto)
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    return this.rutasService.remove(id, idUser);
  }
}
