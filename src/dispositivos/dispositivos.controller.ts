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

import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiResponseCommon } from 'src/common/ApiResponse';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ValidadoresService } from 'src/validadores/validadores.service';
import { CreateValidadorDto } from 'src/validadores/dto/create-validador.dto';
import { UpdateValidadorEstatusDto } from 'src/validadores/dto/update-validador-estatus.dto';
import { UpdateValidadorDto } from 'src/validadores/dto/update-validador.dto';
import { UpdateValidadorEstadoDto } from 'src/validadores/dto/update-validador-estado.dto';

@ApiTags('Validadores')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('dispositivos')
export class DispositivosController {
  constructor(private readonly dispositivosService: ValidadoresService) {}

  @Post()
  createDispositivo(
    @Body() createDispositivoDto: CreateValidadorDto,
    @Request() req,
  ) {
    const idUser = req.user.userId;
    return this.dispositivosService.createValidador(
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
    return await this.dispositivosService.findAllListValidadoresClientes(+id, +cliente);
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
    return this.dispositivosService.findOneValidador(+id, +cliente, +rol);
  }

    @Patch('actualizar/estado/:id')
  updateDispositivoEstado(
    @Param('id') id: string,
    @Request() req,
    @Body() updateDispositivoEstadoDto: UpdateValidadorEstadoDto,
  ) {
    const idUser = req.user.userId;
    return this.dispositivosService.updateValidadorEstado(
      +id,
      +idUser,
      updateDispositivoEstadoDto,
    );
  }

  @Patch('estatus/:id')
  updateDispositivoEstatus(
    @Param('id') id: string,
    @Request() req,
    @Body() updateDispositivoEstatusDto: UpdateValidadorEstatusDto,
  ) {
    const idUser = req.user.userId;
    return this.dispositivosService.updateValidadorEstatus(
      +id,
      +idUser,
      updateDispositivoEstatusDto,
    );
  }

  @Put(':id')
  updateDispositivo(
    @Param('id') id: string,
    @Request() req,
    @Body() updateDispositivoDto: UpdateValidadorDto,
  ) {
    const idUser = req.user.userId;
    return this.dispositivosService.updateValidador(
      +id,
      +idUser,
      updateDispositivoDto,
    );
  }

  @Delete(':id')
  removeDispositivo(@Param('id') id: string, @Request() req) {
    const idUser = req.user.userId;
    return this.dispositivosService.removeValidador(+id, +idUser);
  }
}
