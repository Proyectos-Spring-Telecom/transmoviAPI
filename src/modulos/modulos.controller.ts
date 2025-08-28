import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  Request,
  Query,
  Res,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ModulosService } from './modulos.service';
import { CreateModuloDto } from './dto/create-modulo.dto';
import { UpdateModuloDto } from './dto/update-modulo.dto';
import { ApiTags } from '@nestjs/swagger';
import { UpdateModulosEstatusDto } from './dto/update-modulo-estatus.dto';
import { ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';

@ApiTags('Modulos')
@UseGuards(JwtAuthGuard)
@Controller('modulos')
export class ModulosController {
  constructor(private readonly modulosService: ModulosService) {}

  @Post()
  create(@Body() createModuloDto: CreateModuloDto, @Request() req) {
    const idUser = req.user.userId;
    return this.modulosService.create(createModuloDto, idUser);
  }

  @Get('list')
  findAllList(): Promise<ApiResponseCommon> {
    return this.modulosService.findAllList();
  }

  @Get('page/:page/:limit')
  findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
  ): Promise<ApiResponseCommon> {
    return this.modulosService.findAll(page, limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.modulosService.findOne(+id);
  }

  @Put()
  update(@Body() updateModuloDto: UpdateModuloDto, @Request() req) {
    const idUser = req.user.userId;
    return this.modulosService.update(updateModuloDto, idUser);
  }

  @Patch(':id/estatus')
  updateModuloEstatus(
    @Param('id') id: string,
    @Request() req,
    updateModulosEstatusDto: UpdateModulosEstatusDto,
  ) {
    const idUser = req.user.userId;
    return this.modulosService.updateModulosStatus(
      +id,
      idUser,
      updateModulosEstatusDto,
    );
  }
}
