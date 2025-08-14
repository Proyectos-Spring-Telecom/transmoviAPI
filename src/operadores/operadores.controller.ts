import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { OperadoresService } from './operadores.service';
import { CreateOperadoreDto } from './dto/create-operadore.dto';
import { UpdateOperadoreDto } from './dto/update-operadore.dto';

@Controller('operadores')
export class OperadoresController {
  constructor(private readonly operadoresService: OperadoresService) {}

  @Post()
  create(@Body() createOperadoreDto: CreateOperadoreDto) {
    return this.operadoresService.create(createOperadoreDto);
  }

  @Get()
  findAll() {
    return this.operadoresService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.operadoresService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateOperadoreDto: UpdateOperadoreDto) {
    return this.operadoresService.update(+id, updateOperadoreDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.operadoresService.remove(+id);
  }
}
