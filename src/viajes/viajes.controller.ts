import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Request,
  ParseIntPipe,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { ViajesService } from './viajes.service';
import { CreateViajeDto } from './dto/create-viaje.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';
import { UpdateViajeDto } from './dto/update-viaje.dto';

@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('viajes')
export class ViajesController {
  constructor(private readonly viajesService: ViajesService) { }

  @Post()
  create(@Body() createViajeDto: CreateViajeDto, @Request() req) {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.viajesService.create(+idUser, createViajeDto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: number,
    @Body() updateViajeDto: UpdateViajeDto,
    @Request() req,
  ) {
    const idUser = req.user.userId;
    return this.viajesService.update(+idUser, +id, updateViajeDto);
  }

  @Get('list')
  findAllList(@Request() req) {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.viajesService.findAllList(+cliente, +cliente,);
  }

  @Get(':page/:limit')
  findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req
  ) {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.viajesService.findAll(+cliente, +rol, page, limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.viajesService.findOne(+id, +cliente, +rol,);
  }

}
