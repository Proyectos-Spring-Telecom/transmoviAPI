import { Controller, Get, Param, Delete, UseGuards } from '@nestjs/common';
import { AdministracionService } from './administracion.service';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';

@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('administracion')
export class AdministracionController {
  constructor(private readonly administracionService: AdministracionService) {}


  @Get()
  findAll() {
    return this.administracionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.administracionService.findOne(+id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.administracionService.remove(+id);
  }
}
