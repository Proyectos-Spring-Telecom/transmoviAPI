import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ViajesconteosService } from './viajesconteos.service';
import { CreateViajesconteoDto } from './dto/create-viajesconteo.dto';

@Controller('viajesconteos')
export class ViajesconteosController {
  constructor(private readonly viajesconteosService: ViajesconteosService) {}

  @Post()
  create(@Body() createViajesconteoDto: CreateViajesconteoDto) {
    return this.viajesconteosService.create(createViajesconteoDto);
  }

  @Get()
  findAll() {
    return this.viajesconteosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.viajesconteosService.findOne(+id);
  }


}
