import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Put,
} from '@nestjs/common';
import { OperadoresService } from './operadores.service';
import { CreateOperadoreDto } from './dto/create-operadore.dto';
import { UpdateOperadoreDto } from './dto/update-operadore.dto';
import { UpdateOperadorStatusDto } from './dto/update-operadores.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('operadores')
export class OperadoresController {
  constructor(private readonly operadoresService: OperadoresService) {}

  @Post()
  createOperador(@Body() createOperadoreDto: CreateOperadoreDto) {
    return this.operadoresService.createOperador(createOperadoreDto);
  }

  @Get()
  findAllOperador() {
    return this.operadoresService.findAllOperadores();
  }

  @Get(':id')
  findOneOperador(@Param('id') id: string) {
    return this.operadoresService.findOneOperador(+id);
  }

  @Patch(':id/estatus')
  updateOperadorEstatus(
    @Param('id') id: string,
    @Body() updateOperadorStatusDto: UpdateOperadorStatusDto,
  ) {
    return this.operadoresService.updateOperadorEstatus(
      +id,
      updateOperadorStatusDto,
    );
  }

  @Put(':id')
  updateOperador(
    @Param('id') id: string,
    @Body() updateOperadoreDto: UpdateOperadoreDto,
  ) {
    return this.operadoresService.updateOperador(+id, updateOperadoreDto);
  }

  @Delete(':id')
  removeOperador(@Param('id') id: string) {
    return this.operadoresService.removeOperador(+id);
  }
}
