import { Controller, Get, UseGuards } from '@nestjs/common';
import { CattipolicenciaService } from './cattipolicencia.service';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';

@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('cattipolicencia')
export class CattipolicenciaController {
  constructor(private readonly cattipolicenciaService: CattipolicenciaService) {}

  @Get('list')
  findAllList() {
    return this.cattipolicenciaService.findAllList();
  }

}
