import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Request,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { UsuariosregionesService } from './usuariosregiones.service';
import { CreateUsuariosRegionesDto } from './dto/create-usuariosregione.dto';
import { UpdateUsuariosregioneDto } from './dto/update-usuariosregione.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { UpdateUsuariosRegionesEstatusDto } from './dto/update-usuariosregione-estatus.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('usuariosregiones')
export class UsuariosregionesController {
  constructor(
    private readonly usuariosregionesService: UsuariosregionesService,
  ) {}

  @Post()
  async create(
    @Body() createUsuariosRegionesDto: CreateUsuariosRegionesDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.usuariosregionesService.create(
      idUser,
      createUsuariosRegionesDto,
    );
  }

  @Get('list')
  async findAllList(): Promise<ApiResponseCommon> {
    return await this.usuariosregionesService.findAllList();
  }

  @Get('usuario/:idUsuario')
  async findOneUsuario(@Param('idUsuario') id: string) {
    return await this.usuariosregionesService.findOneUsuario(+id);
  }

  @Get(':page/:limit')
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    return await this.usuariosregionesService.findAll(page, limit);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.usuariosregionesService.findOne(+id);
  }

  @Patch('estatus/:id')
  async updateEstatus(
    @Param('id') id: string,
    @Body() updateUsuariosRegionesEstatusDto: UpdateUsuariosRegionesEstatusDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.usuariosregionesService.updateEstatus(
      +id,
      idUser,
      updateUsuariosRegionesEstatusDto,
    );
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUsuariosregioneDto: UpdateUsuariosregioneDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.usuariosregionesService.update(
      +id,
      idUser,
      updateUsuariosregioneDto,
    );
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.usuariosregionesService.remove(+id, idUser);
  }
}
