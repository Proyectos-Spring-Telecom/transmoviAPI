import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Put,
} from '@nestjs/common';
import { DispositivosService } from './dispositivos.service';
import { CreateDispositivoDto } from './dto/create-dispositivo.dto';
import { UpdateDispositivoDto } from './dto/update-dispositivo.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { UpdateDispositivoEstatusDto } from './dto/update-dispositivos-estatus.dto';
@UseGuards(JwtAuthGuard)
@Controller('dispositivos')
export class DispositivosController {
  constructor(private readonly dispositivosService: DispositivosService) {}

  @Post()
  createDispositivo(@Body() createDispositivoDto: CreateDispositivoDto) {
    return this.dispositivosService.createDispositivo(createDispositivoDto);
  }

  @Get()
  findAllDispositivos() {
    return this.dispositivosService.findAllDispositivos();
  }

  @Get(':id')
  findOneDispositivo(@Param('id') id: string) {
    return this.dispositivosService.findOneDispositivo(+id);
  }

  @Patch(':id/estatus')
  updateDispositivoEstatus(
    @Param('id') id: string,
    @Body() updateDispositivoEstatusDto: UpdateDispositivoEstatusDto,
  ) {
    return this.dispositivosService.updateDispositivoEstatus(+id, updateDispositivoEstatusDto);
  }

  @Put(':id')
  updateDispositivo(
    @Param('id') id: string,
    @Body() updateDispositivoDto: UpdateDispositivoDto,
  ) {
    return this.dispositivosService.updateDispositivo(+id,updateDispositivoDto);
  }

  @Delete(':id')
  removeDispositivo(@Param('id') id: string) {
    return this.dispositivosService.removeDispositivo(+id);
  }
}
