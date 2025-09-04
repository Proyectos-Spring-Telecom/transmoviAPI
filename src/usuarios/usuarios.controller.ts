//Controlador Usuario
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
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UpdateUsuarioEstatusDto } from './dto/update-usuario-estatus.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiResponseCommon } from 'src/common/ApiResponse';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiCrudResponse } from 'src/common/ApiResponse';

@UseGuards(JwtAuthGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}
  //Obtener clientes paginado
  @Get('page/:page/:limit')
  @ApiOperation({ summary: 'Obtener todos los usuarios' })
  @ApiResponse({
    status: 200,
    description: 'Lista de usuarios',
    type: [CreateUsuarioDto],
  })
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
  ): Promise<ApiResponseCommon> {
    return await this.usuariosService.getAllUsuario(page, limit);
  }
  //Obtener todos los usuario
  @Get('list')
  async findAllList(): Promise<ApiResponseCommon> {
    return await this.usuariosService.getAllListUsuarios();
  }
  //Obtener los usuario por Id
  @Get('/:id')
  findOne(@Param('id') id: string) {
    return this.usuariosService.getUsuarioByID(+id);
  }
  //Crear usuario
  @Post()
  async createUsuario(
    @Body() createUsuarioDto: CreateUsuarioDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.usuariosService.createUsuario(createUsuarioDto, idUser);
  }
  //actualizar usuario
  @Put('/:id')
  async updateUsuario(
    @Param('id')
    id: string,
    @Body() updateUsuarioDto: UpdateUsuarioDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.usuariosService.updateUsuario(
      +id,
      updateUsuarioDto,
      idUser,
    );
  }
  //eliminar usuario
  @Delete('/:id')
  async deleteUsuario(
    @Param('id') id: string,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.usuariosService.deleteUsuario(+id, idUser);
  }
  //actualizar estatus del usuario
  @Patch('/:id/estatus')
  async changeUsuarioEstatus(
    @Param('id') id: string,
    @Body() updateUsuarioEstatusDto: UpdateUsuarioEstatusDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.usuariosService.updateUsuarioEstatus(
      +id,
      updateUsuarioEstatusDto,
      idUser,
    );
  }
}
