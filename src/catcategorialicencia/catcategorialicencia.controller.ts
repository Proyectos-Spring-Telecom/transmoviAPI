import { Controller, Get, UseGuards } from '@nestjs/common';
import { CatcategorialicenciaService } from './catcategorialicencia.service';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('catcategorialicencia')
export class CatcategorialicenciaController {
  constructor(private readonly catcategorialicenciaService: CatcategorialicenciaService) {}

  @Get('list')
  findAll() {
    return this.catcategorialicenciaService.findAllList();
  }
}
