import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { MonitoreoService } from './monitoreo.service';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Monitoreo')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('monitoreo')
export class MonitoreoController {
  constructor(private readonly monitoreoService: MonitoreoService) {}

  @Get('list')
  findAllList(@Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.monitoreoService.findAllList(+idUser, +cliente, +rol);
  }

  @Get()
  findAll() {
    return this.monitoreoService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.monitoreoService.findOne(+id);
  }
}
