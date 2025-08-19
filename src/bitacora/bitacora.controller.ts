import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { BitacoraLoggerService } from './bitacora.service';
import { CreateBitacoraDto } from './dto/create-bitacora.dto';
import { UpdateBitacoraDto } from './dto/update-bitacora.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
//@UseGuards(JwtAuthGuard)
@Controller('bitacora')
export class BitacoraController {
  constructor(private readonly bitacoraService: BitacoraLoggerService) {}

  @Post()
  create(@Body() createBitacoraDto: CreateBitacoraDto) {
    return this.bitacoraService.createBitacora(createBitacoraDto);
  }

  @Get()
  findAllBitacora() {
    return this.bitacoraService.findAllBitacora();
  }

}
