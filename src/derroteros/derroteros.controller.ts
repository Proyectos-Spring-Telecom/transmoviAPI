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
} from '@nestjs/common';
import { DerroterosService } from './derroteros.service';
import { CreateDerroteroDto } from './dto/create-derrotero.dto';
import { UpdateDerroteroDto } from './dto/update-derrotero.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';

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
    return this.derroterosService.findAllList(+cliente, +idUser);
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
    return this.derroterosService.findAll(+cliente, +idUser, page, limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.derroterosService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDerroteroDto: UpdateDerroteroDto,
    @Request() req,
  ) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.derroterosService.update(+id, updateDerroteroDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.derroterosService.remove(+id);
  }
}
