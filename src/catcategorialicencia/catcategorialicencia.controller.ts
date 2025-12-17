import { Controller, Get, UseGuards } from '@nestjs/common';
import { CatcategorialicenciaService } from './catcategorialicencia.service';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@UseGuards(JwtAuthGuard)
@ApiTags('Catálogo categoría licencia')
@Controller('catcategorialicencia')
@ApiBearerAuth('bearer-token')
export class CatcategorialicenciaController {
  constructor(private readonly catcategorialicenciaService: CatcategorialicenciaService) {}

  @Get('list')
  findAll() {
    return this.catcategorialicenciaService.findAllList();
  }
}
