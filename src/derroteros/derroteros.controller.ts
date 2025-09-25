import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { DerroterosService } from './derroteros.service';
import { CreateDerroteroDto } from './dto/create-derrotero.dto';
import { UpdateDerroteroDto } from './dto/update-derrotero.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('derroteros')
export class DerroterosController {
  constructor(private readonly derroterosService: DerroterosService) {}

  @Post()
  create(@Body() createDerroteroDto: CreateDerroteroDto) {
    return this.derroterosService.create(createDerroteroDto);
  }

  @Get()
  findAll() {
    return this.derroterosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.derroterosService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDerroteroDto: UpdateDerroteroDto) {
    return this.derroterosService.update(+id, updateDerroteroDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.derroterosService.remove(+id);
  }
}
