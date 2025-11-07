import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { CatcombustibleService } from './catcombustible.service';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('catcombustible')
export class CatcombustibleController {
  constructor(private readonly catcombustibleService: CatcombustibleService) {}

  @Get('list')
  findAllList(@Request() req) {
    return this.catcombustibleService.findAllList();
  }
}
