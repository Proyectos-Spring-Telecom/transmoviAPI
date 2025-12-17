import { Controller, Get, UseGuards } from '@nestjs/common';
import { CatMetodoPagoService } from './cat-metodo-pago.service';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@UseGuards(JwtAuthGuard)
@ApiTags('Catálogo metodo pago')
@Controller('catmetodopago')
@ApiBearerAuth('bearer-token')
export class CatMetodoPagoController {
  constructor(private readonly catMetodoPagoService: CatMetodoPagoService) { }

  @Get('list')
  findAll() {
    return this.catMetodoPagoService.findAll();
  }

}
