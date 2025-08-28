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
  ParseIntPipe,
} from '@nestjs/common';
import { DispositivosService } from './dispositivos.service';
import { CreateDispositivoDto } from './dto/create-dispositivo.dto';
import { UpdateDispositivoDto } from './dto/update-dispositivo.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { UpdateDispositivoEstatusDto } from './dto/update-dispositivos-estatus.dto';
import { ApiResponseCommon } from 'src/common/ApiResponse';
@UseGuards(JwtAuthGuard)
@Controller('dispositivos')
export class DispositivosController {
  constructor(private readonly dispositivosService: DispositivosService) {}

  @Post()
  createDispositivo(
    @Body() createDispositivoDto: CreateDispositivoDto,
    @Request() req,
  ) {
    const idUser = req.user.userId;
    return this.dispositivosService.createDispositivo(
      createDispositivoDto,
      idUser,
    );
  }

  @Get('page/:page/:limit')
  async findAllDispositivos(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
  ): Promise<ApiResponseCommon> {
    return this.dispositivosService.findAllDispositivos(page,limit);
  }

  @Get()
  findAllListDispositivos(): Promise<ApiResponseCommon> {
    return this.dispositivosService.findAllListDispositivos();
  }

  @Get(':id')
  findOneDispositivo(@Param('id') id: string) {
    return this.dispositivosService.findOneDispositivo(+id);
  }

  @Patch(':id/estatus')
  updateDispositivoEstatus(
    @Param('id') id: string,
    @Request() req,
    @Body() updateDispositivoEstatusDto: UpdateDispositivoEstatusDto,
  ) {
    const idUser = req.user.userId;
    return this.dispositivosService.updateDispositivoEstatus(
      +id,
      idUser,
      updateDispositivoEstatusDto,
    );
  }

  @Put(':id')
  updateDispositivo(
    @Param('id') id: string,
    @Request() req,
    @Body() updateDispositivoDto: UpdateDispositivoDto,
  ) {
    const idUser = req.user.userId;
    return this.dispositivosService.updateDispositivo(
      +id,
      idUser,
      updateDispositivoDto,
    );
  }

  @Delete(':id')
  removeDispositivo(@Param('id') id: string, @Request() req) {
    const idUser = req.user.userId;
    return this.dispositivosService.removeDispositivo(+id, idUser);
  }
}
