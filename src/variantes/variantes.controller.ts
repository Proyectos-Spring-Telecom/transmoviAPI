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
import { VariantesService } from './variantes.service';
import { CreateVarianteDto } from './dto/create-variante.dto';
import { UpdateVarianteDto } from './dto/update-variante.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { UpdateVariantesEstatusDto } from './dto/update-variante-estatus.dto';
import { ApiBearerAuth } from '@nestjs/swagger';

@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('variantes')
export class VariantesController {
  constructor(private readonly variantesService: VariantesService) {}

  @Post()
  create(@Body() createVarianteDto: CreateVarianteDto, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.variantesService.create(+idUser, +cliente, +rol, createVarianteDto);
  }

  @Get('list')
  findAllList(@Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.variantesService.findAllList(+idUser, +cliente, +rol);
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
    return this.variantesService.findAll(+idUser, +cliente, +rol, page, limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.variantesService.findOne(+id, +idUser, +cliente, +rol);
  }

  @Patch('estatus/:id')
  updateEstatus(
    @Param('id') id: string,
    @Body() updateVariantesEstatusDto: UpdateVariantesEstatusDto,
    @Request() req,
  ) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.variantesService.updateEstatus(+id, +idUser, +cliente, +rol, updateVariantesEstatusDto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateVarianteDto: UpdateVarianteDto,
    @Request() req,
  ) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.variantesService.update(+id, +idUser, +cliente, +rol, updateVarianteDto);
  }

  @Delete('eliminado/total/:id')
  removeTotal(@Param('id') id: string, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.variantesService.removeTotal(+id, +idUser, +cliente, +rol);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.variantesService.remove(+id, +idUser, +cliente, +rol);
  }

}
