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
import { ZonasService } from './zonas.service';
import { CreateZonasDto } from './dto/create-zona.dto';
import { UpdateZonaDto } from './dto/update-zona.dto';
import { UpdateZonasEstatusDto } from './dto/update-zona-estatus.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('zonas')
export class ZonasController {
  constructor(private readonly zonasService: ZonasService) {}

  @Post()
  create(    @Body() createZonasDto: CreateZonasDto, @Request() req) {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.zonasService.create(
      +idUser,
      +cliente,
      +rol,
      createZonasDto,
    );
  }

  @Get('list')
  async findAllList(@Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return await this.zonasService.findAllList(+cliente, +idUser, +rol);
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
    return this.zonasService.findAll(+cliente, +idUser, +rol, page, limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.zonasService.findOne(+idUser, +id, +cliente, +rol);
  }

  @Patch('estatus/:id')
  async updateEstatus(
    @Param('id') id: string,
    @Body() updateZonasEstatusDto: UpdateZonasEstatusDto,
    @Request() req,
  ) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return await this.zonasService.updateEstatus(
      +id,
      +idUser,
      +cliente,
      +rol,
      updateZonasEstatusDto,
    );
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateZonaDto: UpdateZonaDto,
    @Request() req,
  ) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.zonasService.update(
      +id,
      +cliente,
      +idUser,
      +rol,
      updateZonaDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.zonasService.remove(+id, +cliente, +idUser, +rol);
  }
}
