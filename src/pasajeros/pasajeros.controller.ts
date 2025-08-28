import { Controller, Get, Post, Body, Patch, Param, Delete, Put, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { PasajerosService } from './pasajeros.service';
import { CreatePasajeroDto } from './dto/create-pasajero.dto';
import { UpdatePasajeroDto } from './dto/update-pasajero.dto';
import { UpdatePasajeroEstatusDto } from './dto/update-pasajeros-estatus.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiResponseCommon } from 'src/common/ApiResponse';

@UseGuards(JwtAuthGuard)
@Controller('pasajeros')
export class PasajerosController {
  constructor(private readonly pasajerosService: PasajerosService) {}

  @Post()
  createPasajero(@Body() createPasajeroDto: CreatePasajeroDto,@Request()req) {
    const idUser = req.user.userId;
    return this.pasajerosService.createPasajeros(createPasajeroDto,idUser);
  }

  @Get('page/:page/:limit')
  findAllPasajero(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
  ): Promise<ApiResponseCommon> {
    return this.pasajerosService.findAllPasajeros(page,limit);
  }

  @Get()
  findAllListPasajero(): Promise<ApiResponseCommon> {
    return this.pasajerosService.findAllListPasajeros();
  }

  @Get(':id')
  findOnePasajero(@Param('id') id: string) {
    return this.pasajerosService.findOnePasajero(+id);
  }

  @Patch(':id/estatus')
  updatePasajeroEstatus(@Param('id') id: string, @Body() updatePasajeroEstatusDto: UpdatePasajeroEstatusDto,@Request()req) {
    const idUser = req.user.userId;
    return this.pasajerosService.updatePasajeroEstatus(+id, updatePasajeroEstatusDto,idUser);
  }

  @Put(':id')
  updatePasajero(@Param('id') id: string, @Body() updatePasajeroDto: UpdatePasajeroDto,@Request()req) {
    const idUser = req.user.userId;
    return this.pasajerosService.updatePasajero(+id,idUser, updatePasajeroDto);
  }

  @Delete(':id')
  removePasajero(@Param('id') id: string,@Request()req) {
    const idUser = req.user.userId;
    return this.pasajerosService.removePasajero(+id,idUser);
  }
}
