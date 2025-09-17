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
    return await this.bluevoxService.create(idUser, createBlueVoxsDto);
  }

  @Get('list')
  async findAllList(): Promise<ApiResponseCommon> {
    return this.bluevoxService.findAllList();
  }

  @Get('clientes/:id')
  async findAllDispositivosClientes(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponseCommon> {
    return await this.bluevoxService.findAllListClientes(id);
  }

  // ✅ RUTAS CON PARÁMETROS DINÁMICOS DESPUÉS
  @Get(':page/:limit')
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
  ): Promise<ApiResponseCommon> {
    return await this.bluevoxService.findAll(page, limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bluevoxService.findOne(+id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Request() req,
    @Body() updateVehiculoDto: UpdateBluevoxDto,
  ) {
    const idUser = req.user.userId;
    return this.bluevoxService.update(+id, idUser, updateVehiculoDto);
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
      idUser,
      updateBlueVoxEstatusDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    const idUser = req.user.userId;
    return this.bluevoxService.remove(+id, idUser);
  }
}