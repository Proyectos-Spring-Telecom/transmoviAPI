import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  UseGuards,
  Request,
} from '@nestjs/common';
import { MonederosService } from './monederos.service';
import { CreateMonederoDto } from './dto/create-monedero.dto';
import { UpdateMonederoDto } from './dto/update-monedero.dto';
import { UpdateMonederoEstatusDto } from './dto/update-monedero-estatus.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { UpdateMonederoSaldoDto } from './dto/update-monedero-saldo.dto';
@UseGuards(JwtAuthGuard)
@Controller('monederos')
export class MonederosController {
  constructor(private readonly monederosService: MonederosService) {}

  @Post()
  createMonedero(@Body() createMonederoDto: CreateMonederoDto, @Request() req) {
    const idUser = req.user.userId;
    return this.monederosService.createMonedero(createMonederoDto, idUser);
  }

  @Get()
  findAllMonederos() {
    return this.monederosService.findAllMonederos();
  }

  @Get(':id')
  findOneMonedero(@Param('id') id: string) {
    return this.monederosService.findOneMonedero(+id);
  }

  @Get('numero/serie/:numeroSerie')
  findOneMonederoBySerie(@Param('numeroSerie') id: string) {
    return this.monederosService.findOneMonederoBySerie(id);
  }

  @Patch(':id/estatus')
  updateMonederoEstatus(
    @Param('id') id: string,
    @Request() req,
    @Body() updateMonederoEstatusDto: UpdateMonederoEstatusDto,
  ) {
    const idUser = req.user.userId;
    return this.monederosService.updateMonederoEstatus(
      +id,
      idUser,
      updateMonederoEstatusDto,
    );
  }

  @Patch(':id/saldo')
  updateMonederoSaldo(
    @Param('id') id: string,
    @Request() req,
    @Body() updateMonederoSaldoDto: UpdateMonederoSaldoDto,
  ) {
    const idUser = req.user.userId;
    return this.monederosService.updateMonederoSaldo(
      +id,
      idUser,
      updateMonederoSaldoDto,
    );
  }

  @Put(':id')
  updateMonedero(
    @Param('id') id: string,
    @Request() req,
    @Body() updateMonederoDto: UpdateMonederoDto,
  ) {
    const idUser = req.user.userId;
    return this.monederosService.updateMonedero(+id, idUser, updateMonederoDto);
  }

  @Delete(':id')
  removeMonedero(@Param('id') id: string, @Request() req) {
    const idUser = req.user.userId;
    return this.monederosService.removeMonedero(+id, idUser);
  }
}
