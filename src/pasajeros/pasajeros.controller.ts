import { Controller, Get, Post, Body, Patch, Param, Delete, Put, UseGuards } from '@nestjs/common';
import { PasajerosService } from './pasajeros.service';
import { CreatePasajeroDto } from './dto/create-pasajero.dto';
import { UpdatePasajeroDto } from './dto/update-pasajero.dto';
import { UpdatePasajeroEstatusDto } from './dto/update-pasajeros-estatus.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('pasajeros')
export class PasajerosController {
  constructor(private readonly pasajerosService: PasajerosService) {}

  @Post()
  createPasajero(@Body() createPasajeroDto: CreatePasajeroDto) {
    return this.pasajerosService.createPasajeros(createPasajeroDto);
  }

  @Get()
  findAllPasajero() {
    return this.pasajerosService.findAllPasajeros();
  }

  @Get(':id')
  findOnePasajero(@Param('id') id: string) {
    return this.pasajerosService.findOnePasajero(+id);
  }

  @Patch(':id/estatus')
  updatePasajeroEstatus(@Param('id') id: string, @Body() updatePasajeroEstatusDto: UpdatePasajeroEstatusDto) {
    return this.pasajerosService.updatePasajeroEstatus(+id, updatePasajeroEstatusDto);
  }

  @Put(':id')
  updatePasajero(@Param('id') id: string, @Body() updatePasajeroDto: UpdatePasajeroDto) {
    return this.pasajerosService.updatePasajero(+id, updatePasajeroDto);
  }

  @Delete(':id')
  removePasajero(@Param('id') id: string) {
    return this.pasajerosService.removePasajero(+id);
  }
}
