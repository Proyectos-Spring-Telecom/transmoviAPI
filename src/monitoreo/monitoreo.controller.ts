import { Controller, Get, Param, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { MonitoreoService } from './monitoreo.service';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Monitoreo')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('monitoreo')
export class MonitoreoController {
  constructor(private readonly monitoreoService: MonitoreoService) {}

  @Get('list/:cliente')
  findListPosiciones(
    @Param('cliente', ParseIntPipe) cliente: number,
    @Request() req) {
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.monitoreoService.monitoreoListado(+idUser, +cliente, +rol);
  }

}
