import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { BitacoraService } from './bitacora.service';
import { CreateBitacoraDto } from './dto/create-bitacora.dto';
import { UpdateBitacoraDto } from './dto/update-bitacora.dto';

@Controller('bitacora')
export class BitacoraController {
  constructor(private readonly bitacoraService: BitacoraService) {}

  @Post()
  create(@Body() createBitacoraDto: CreateBitacoraDto) {
    return this.bitacoraService.create(createBitacoraDto);
  }

  @Get()
  findAll() {
    return this.bitacoraService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bitacoraService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBitacoraDto: UpdateBitacoraDto) {
    return this.bitacoraService.update(+id, updateBitacoraDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bitacoraService.remove(+id);
  }
}
