import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Request,
  ParseIntPipe,
  UseGuards,
  Put,
} from '@nestjs/common';
import { BluevoxService } from './bluevox.service';
import { CreateBlueVoxsDto } from './dto/create-bluevox.dto';
import { UpdateBluevoxDto } from './dto/update-bluevox.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { UpdateBlueVoxEstatusDto } from './dto/update-bluevox-estatus.dto';
import { UpdateBluevoxEstadoDto } from './dto/update-bluevox.estado.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('BlueVox')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('bluevox')
export class BluevoxController {
  constructor(private readonly bluevoxService: BluevoxService) {}

  @Post()
  async create(
    @Body() createBlueVoxsDto: CreateBlueVoxsDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.bluevoxService.create(+idUser, createBlueVoxsDto);
  }

  @Get('list')
  async findAllList(@Request() req,): Promise<ApiResponseCommon> {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.bluevoxService.findAllList(+cliente, +rol);
  }

  @Get('clientes/:id')
  async findAllDispositivosClientes(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return await this.bluevoxService.findAllListClientes(id, +cliente);
  }

  @Get(':page/:limit')
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return await this.bluevoxService.findAll(+cliente, +rol, page, limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req,) {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.bluevoxService.findOne(+id, +cliente, +rol);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Request() req,
    @Body() updateVehiculoDto: UpdateBluevoxDto,
  ) {
    const idUser = req.user.userId;
    return this.bluevoxService.update(+id, +idUser, updateVehiculoDto);
  }

    @Patch('actualizar/estado/:id')
  updateEstado(
    @Param('id') id: string,
    @Body() updateBluevoxEstadoDto: UpdateBluevoxEstadoDto,
    @Request() req,
  ) {
    const idUser = req.user.userId;
    return this.bluevoxService.updateEstado(
      +id,
      +idUser,
      updateBluevoxEstadoDto,
    );
  }

  @Patch('estatus/:id')
  updateEstatus(
    @Param('id') id: string,
    @Body() updateBlueVoxEstatusDto: UpdateBlueVoxEstatusDto,
    @Request() req,
  ) {
    const idUser = req.user.userId;
    return this.bluevoxService.updateEstatus(
      +id,
      +idUser,
      updateBlueVoxEstatusDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    const idUser = req.user.userId;
    return this.bluevoxService.remove(+id, +idUser);
  }
}