import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { MonederosService } from './monederos.service';
import { CreateMonederoDto } from './dto/create-monedero.dto';
import { UpdateMonederoDto } from './dto/update-monedero.dto';

@Controller('monederos')
export class MonederosController {
  constructor(private readonly monederosService: MonederosService) {}

  @Post()
  create(@Body() createMonederoDto: CreateMonederoDto) {
    return this.monederosService.create(createMonederoDto);
  }

  @Get()
  findAll() {
    return this.monederosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.monederosService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMonederoDto: UpdateMonederoDto) {
    return this.monederosService.update(+id, updateMonederoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.monederosService.remove(+id);
  }
}
