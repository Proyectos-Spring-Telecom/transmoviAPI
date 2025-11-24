import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { KpiDto } from './dto/kpi.dto';

@ApiTags('Dashboard')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) { }

  @Post('kpi')
  findKpi(
    @Body() kpiDto: KpiDto,
    @Request() req
  ) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.dashboardService.dashboardkpiPrueba(kpiDto, +rol, +cliente);
  }

  @Get('kpi/:filtro')
  findAll(
    @Param('page', ParseIntPipe) filtro: number,
    @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return `this.dashboardService.dashboardkpi( +cliente);`
  }


}
