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
  Request,
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
    const idUser ="1"
    return this.dispositivosService.createDispositivo(createDispositivoDto,idUser);
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
    const idUser ="1"
    return this.dispositivosService.updateDispositivoEstatus(+id, idUser,updateDispositivoEstatusDto);
  }

  @Put(':id')
  updateDispositivo(
    @Param('id') id: string,
    @Body() updateDispositivoDto: UpdateDispositivoDto,
  ) {
    const idUser ="1"
    return this.dispositivosService.updateDispositivo(+id,idUser,updateDispositivoDto);
  }

  @Delete(':id')
  removeDispositivo(@Param('id') id: string) {
    const idUser ="1"
    return this.dispositivosService.removeDispositivo(+id,idUser);
  }

  @Get('prueba')
  prueba() {
    console.log('prueba');
    
    return 'Hola mundo'; 
  }
}
