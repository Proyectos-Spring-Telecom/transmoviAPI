import { Controller, Get, UseGuards } from '@nestjs/common';
import { CattipodescuentoService } from './cattipodescuento.service';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('cattipodescuento')
export class CattipodescuentoController {
  constructor(private readonly cattipodescuentoService: CattipodescuentoService) {}

  @Get('list')
  findAll() {
    return this.cattipodescuentoService.findAllList();
  }
}
