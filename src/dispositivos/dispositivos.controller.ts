import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { DispositivosService } from './dispositivos.service';
import { CreateDispositivoDto } from './dto/create-dispositivo.dto';
import { UpdateDispositivoDto } from './dto/update-dispositivo.dto';

@Controller('dispositivos')
export class DispositivosController {
  constructor(private readonly dispositivosService: DispositivosService) {}

  @Post()
  create(@Body() createDispositivoDto: CreateDispositivoDto) {
    return this.dispositivosService.create(createDispositivoDto);
  }

  @Get()
  findAll() {
    return this.dispositivosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.dispositivosService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDispositivoDto: UpdateDispositivoDto) {
    return this.dispositivosService.update(+id, updateDispositivoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.dispositivosService.remove(+id);
  }
}
