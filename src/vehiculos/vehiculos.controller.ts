import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe, Request, Put } from '@nestjs/common';
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
  create(@Body() createVehiculoDto: CreateVehiculoDto,@Request()req) {
    const idUser = req.user.userId;
    return this.vehiculosService.create(createVehiculoDto,idUser);
  }

  @Get(':page/:limit')
  async findAll(
    @Param('page',ParseIntPipe)page: number,
    @Param('limit',ParseIntPipe)limit: number,
  ): Promise<ApiResponseCommon> {
    return await this.vehiculosService.findAll(page,limit);
  }

  @Get('list')
  async findAllList(): Promise<ApiResponseCommon> {
    return await this.vehiculosService.findAllList();
  }

  @Get(':id')
  findOne(@Param('id') Id: string) {
    return this.vehiculosService.findOne(+Id);
  }

  @Put(':id')
  update(@Param('id') Id: string, @Request() req ,@Body() updateVehiculoDto: UpdateVehiculoDto) {
    const idUser = req.user.userId;
    return this.vehiculosService.update(+Id, idUser,updateVehiculoDto);
  }

  @Patch(':id/estatus')
  updateEstatus(
    @Param('id')id:string,
    @Body()UpdateVehiculoEstatusDto:UpdateVehiculoEstatusDto,
    @Request() req
  ) {
    const idUser = req.user.userId;
    return this.vehiculosService.updateEstatus(+id,idUser,UpdateVehiculoEstatusDto)
  }

  @Delete(':id')
  remove(@Param('id') Id: string,@Request()req) {
    const idUser = req.user.userId;
    return this.vehiculosService.remove(+Id, idUser);
  }
}
