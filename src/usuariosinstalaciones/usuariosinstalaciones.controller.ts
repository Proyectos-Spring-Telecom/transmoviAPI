import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UsuariosinstalacionesService } from './usuariosinstalaciones.service';
import { CreateUsuariosInstalacionesDto } from './dto/create-usuariosinstalacione.dto';
import { UpdateUsuariosinstalacioneDto } from './dto/update-usuariosinstalacione.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiCrudResponse } from 'src/common/ApiResponse';

@UseGuards(JwtAuthGuard)
@Controller('usuariosinstalaciones')
export class UsuariosinstalacionesController {
  constructor(
    private readonly usuariosinstalacionesService: UsuariosinstalacionesService,
  ) {}

  @Post()
  async create(
    @Body() createUsuariosInstalacionesDto: CreateUsuariosInstalacionesDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.usuariosinstalacionesService.create(
      idUser,
      createUsuariosInstalacionesDto,
    );
  }

  @Get()
  async findAll() {
    return this.usuariosinstalacionesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.usuariosinstalacionesService.findOne(+id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUsuariosinstalacioneDto: UpdateUsuariosinstalacioneDto,
  ) {
    return this.usuariosinstalacionesService.update(
      +id,
      updateUsuariosinstalacioneDto,
    );
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.usuariosinstalacionesService.remove(+id);
  }
}
