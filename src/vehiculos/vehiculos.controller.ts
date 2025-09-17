import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
  Request,
  Put,
} from '@nestjs/common';
import { VehiculosService } from './vehiculos.service';
import { CreateVehiculoDto } from './dto/create-vehiculo.dto';
import { UpdateVehiculoDto } from './dto/update-vehiculo.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiResponseCommon } from 'src/common/ApiResponse';
import { UpdateVehiculoEstatusDto } from './dto/update-vehiculos-estatus.dto';

@UseGuards(JwtAuthGuard)
@Controller('vehiculos')
export class VehiculosController {
  constructor(private readonly vehiculosService: VehiculosService) {}

  @Post()
  create(@Body() createVehiculoDto: CreateVehiculoDto, @Request() req) {
    const idUser = req.user.userId;
    return this.vehiculosService.create(createVehiculoDto, idUser);
  }

  @Get('list')
  async findAllList(): Promise<ApiResponseCommon> {
    return await this.vehiculosService.findAllList();
  }

  @Get('clientes/:id')
  async findAllDispositivosClientes(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponseCommon> {
    return await this.vehiculosService.findAllListClientes(id);
  }

  @Get(':page/:limit')
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
  ): Promise<ApiResponseCommon> {
    return await this.vehiculosService.findAll(page, limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vehiculosService.findOne(+id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Request() req,
    @Body() updateVehiculoDto: UpdateVehiculoDto,
  ) {
    const idUser = req.user.userId;
    return this.vehiculosService.update(+id, idUser, updateVehiculoDto);
  }

  @Patch('estatus/:id')
  updateEstatus(
    @Param('id') id: string,
    @Body() UpdateVehiculoEstatusDto: UpdateVehiculoEstatusDto,
    @Request() req,
  ) {
    const idUser = req.user.userId;
    return this.vehiculosService.updateEstatus(
      +id,
      idUser,
      UpdateVehiculoEstatusDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    const idUser = req.user.userId;
    return this.vehiculosService.remove(+id, idUser);
  }
}