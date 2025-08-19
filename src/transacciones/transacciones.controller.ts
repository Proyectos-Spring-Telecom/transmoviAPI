import { Controller, Get, Post, Body, Patch, Param, Delete, Put } from '@nestjs/common';
import { TransaccionesService } from './transacciones.service';
import { CreateTransaccioneDto } from './dto/create-transaccione.dto';
import { UpdateTransaccioneDto } from './dto/update-transaccione.dto';
import { UpdateTransaccionEstatusDto } from './dto/update-transaccione-status.dto';

@Controller('transacciones')
export class TransaccionesController {
  constructor(private readonly transaccionesService: TransaccionesService) {}

  @Post()
  createTransaccion(@Body() createTransaccioneDto: CreateTransaccioneDto) {
    return this.transaccionesService.createTransaccion(createTransaccioneDto);
  }

  @Get()
  findAllTransacciones() {
    return this.transaccionesService.findAllTransacciones();
  }

  @Get(':id')
  findOneTransaccione(@Param('id') id: string) {
    return this.transaccionesService.findOneTransaccion(+id);
  }

  @Patch(':id')
  updateTransaccioneStatus(@Param('id') id: string, @Body() updateTransaccionEstatusDto: UpdateTransaccionEstatusDto) {
    return this.transaccionesService.updateTransaccionEstatus(+id, updateTransaccionEstatusDto);
  }

  @Put(':id')
  updateTransaccione(@Param('id') id: string, @Body() updateTransaccioneDto: UpdateTransaccioneDto) {
    return this.transaccionesService.updateTransaccions(+id, updateTransaccioneDto);
  }

  @Delete(':id')
  removeTransaccione(@Param('id') id: string) {
    return this.transaccionesService.removeTransaccion(+id);
  }
}
