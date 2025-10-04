import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Request,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ViajesService } from './viajes.service';
import { CreateViajeDto } from './dto/create-viaje.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('viajes')
export class ViajesController {
  constructor(private readonly viajesService: ViajesService) {}

  @Post()
  create(@Body() createViajeDto: CreateViajeDto, @Request() req) {
    const idUser = req.user.userId;
    return this.viajesService.create(+idUser, createViajeDto);
  }

  @Get('list')
  findAllList() {
    return this.viajesService.findAllList();
  }

  @Get(':page/:limit')
  findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
  ) {
    return this.viajesService.findAll(page,limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.viajesService.findOne(+id);
  }

}
