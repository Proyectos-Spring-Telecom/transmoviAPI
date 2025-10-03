import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ViajestransaccionesService } from './viajestransacciones.service';
import { CreateViajestransaccioneDto } from './dto/create-viajestransaccione.dto';
import { UpdateViajestransaccioneDto } from './dto/update-viajestransaccione.dto';

@Controller('viajestransacciones')
export class ViajestransaccionesController {
  constructor(private readonly viajestransaccionesService: ViajestransaccionesService) {}

  @Post()
  create(@Body() createViajestransaccioneDto: CreateViajestransaccioneDto) {
    return this.viajestransaccionesService.create(createViajestransaccioneDto);
  }

  @Get()
  findAll() {
    return this.viajestransaccionesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.viajestransaccionesService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateViajestransaccioneDto: UpdateViajestransaccioneDto) {
    return this.viajestransaccionesService.update(+id, updateViajestransaccioneDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.viajestransaccionesService.remove(+id);
  }
}
