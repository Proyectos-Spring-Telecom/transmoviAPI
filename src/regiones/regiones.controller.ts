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

@UseGuards(JwtAuthGuard)
@Controller('regiones')
export class RegionesController {
  constructor(private readonly regionesService: RegionesService) {}

  @Post()
  create(@Body() createRegionesDto: CreateRegionesDto, @Request() req) {
    const idUser = req.user.userId;
    return this.regionesService.create(idUser, createRegionesDto);
  }

  @Get('list')
  async findAllList(@Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    return await this.regionesService.findAllList(+cliente, +idUser);
  }

  @Get(':page/:limit')
  findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
  ) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    return this.regionesService.findAll(+cliente,+idUser,page,limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    return this.regionesService.findOne(+idUser, +id, +cliente);
  }

  @Patch('estatus/:id')
  async updateEstatus(
    @Param('id') id: string,
    @Body() updateRegionesEstatusDto: UpdateRegionesEstatusDto,
    @Request() req
  ) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    return await this.regionesService.updateEstatus(+id, +idUser, +cliente, updateRegionesEstatusDto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateRegioneDto: UpdateRegioneDto,@Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    return this.regionesService.update(+id,+cliente, +idUser, updateRegioneDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string,@Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    return this.regionesService.remove(+id,+cliente,+idUser);
  }
}
