import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Put,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { DispositivosService } from './dispositivos.service';
import { CreateDispositivoDto } from './dto/create-dispositivo.dto';
import { UpdateDispositivoDto } from './dto/update-dispositivo.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { UpdateDispositivoEstatusDto } from './dto/update-dispositivos-estatus.dto';
import { ApiResponseCommon } from 'src/common/ApiResponse';
import { UpdateDispositivoEstadoDto } from './dto/update-dispositivo-estado.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Dispositivos')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('dispositivos')
export class DispositivosController {
  constructor(private readonly dispositivosService: DispositivosService) {}

  @Post()
  createDispositivo(
    @Body() createDispositivoDto: CreateDispositivoDto,
    @Request() req,
  ) {
    const idUser = req.user.userId;
    return this.dispositivosService.createDispositivo(
      createDispositivoDto,
      +idUser,
    );
  }

  @Get('list')
  findAllListDispositivos(@Request() req): Promise<ApiResponseCommon> {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.dispositivosService.findAllList(+cliente, +rol);
  }

  @Get('by-cliente/:idCliente')
  async findByCliente(
    @Param('idCliente', ParseIntPipe) idCliente: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return await this.dispositivosService.findAllListDispositivosClientes(idCliente, +cliente);
  }

  @Get('clientes/:id')
  async findAllDispositivosClientes(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return await this.dispositivosService.findAllListDispositivosClientes(+id, +cliente);
  }

  @Get(':page/:limit')
  async findAllDispositivos(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.dispositivosService.findAll(+cliente, +rol, page, limit);
  }

  @Get(':id')
  findOneDispositivo(@Param('id') id: string, @Request() req) {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.dispositivosService.findOneDispositivo(+id, +cliente, +rol);
  }

    @Patch('actualizar/estado/:id')
  updateDispositivoEstado(
    @Param('id') id: string,
    @Request() req,
    @Body() updateDispositivoEstadoDto: UpdateDispositivoEstadoDto,
  ) {
    const idUser = req.user.userId;
    return this.dispositivosService.updateDispositivoEstado(
      +id,
      +idUser,
      updateDispositivoEstadoDto,
    );
  }

  @Patch('estatus/:id')
  updateDispositivoEstatus(
    @Param('id') id: string,
    @Request() req,
    @Body() updateDispositivoEstatusDto: UpdateDispositivoEstatusDto,
  ) {
    const idUser = req.user.userId;
    return this.dispositivosService.updateDispositivoEstatus(
      +id,
      +idUser,
      updateDispositivoEstatusDto,
    );
  }

  @Put(':id')
  updateDispositivo(
    @Param('id') id: string,
    @Request() req,
    @Body() updateDispositivoDto: UpdateDispositivoDto,
  ) {
    const idUser = req.user.userId;
    return this.dispositivosService.updateDispositivo(
      +id,
      +idUser,
      updateDispositivoDto,
    );
  }

  @Delete(':id')
  removeDispositivo(@Param('id') id: string, @Request() req) {
    const idUser = req.user.userId;
    return this.dispositivosService.removeDispositivo(+id, +idUser);
  }
}
