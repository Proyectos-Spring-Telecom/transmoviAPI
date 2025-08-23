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
} from '@nestjs/common';
import { ModulosService } from './modulos.service';
import { CreateModuloDto } from './dto/create-modulo.dto';
import { UpdateModuloDto } from './dto/update-modulo.dto';
import { ApiTags } from '@nestjs/swagger';
import { UpdateModulosEstatusDto } from './dto/update-modulo-estatus.dto';

@ApiTags('Modulos')
@Controller('modulos')
export class ModulosController {
  constructor(private readonly modulosService: ModulosService) {}

  @Post()
  create(@Body() createModuloDto: CreateModuloDto, @Request() req) {
    const idUser = req.user.userId;
    return this.modulosService.create(createModuloDto, idUser);
  }

  @Get()
  findAll() {
    return this.modulosService.findAll();
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
