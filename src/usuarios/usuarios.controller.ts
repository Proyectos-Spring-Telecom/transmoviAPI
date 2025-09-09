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
import { UpdateUsuarioOperadorDto } from './dto/update-usuario-operador.dto';
import { UpdateUsuarioContrasena } from './dto/update-usuario-contrasena.dto';

@UseGuards(JwtAuthGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  //Obtener clientes paginado
  @Get('page/:page/:limit')
  @ApiOperation({ summary: 'Obtener todos los usuarios' })
  @ApiResponse({
    status: 200,
    description: 'Lista de usuarios'
  })
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
  ): Promise<ApiResponseCommon> {
    return await this.usuariosService.getAllUsuario(page, limit);
  }

  //actualizar o crear pin
  @Put('operador')
  async updatePin(@Body()updateUsuarioOperadorDto:UpdateUsuarioOperadorDto,@Request() req): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    const userName = req.user.email;
    return await this.usuariosService.createPin(userName,idUser,updateUsuarioOperadorDto)
  }

  //actualizar estatus del usuario
  @Patch('estatus/:id')
  async changeUsuarioEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUsuarioEstatusDto: UpdateUsuarioEstatusDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.usuariosService.updateUsuarioEstatus(
      id,
      updateUsuarioEstatusDto,
      idUser,
    );
  }

  //Cambiar contraseña
  @Put('actualizar/contrasena/:id')
  async updateContrasena(
    @Param('id', ParseIntPipe)id: number,
    @Body()updateUsuarioContrasena: UpdateUsuarioContrasena,
    @Request()req
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId
    return await this.usuariosService.updateContrasena(id,idUser,updateUsuarioContrasena)
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

  //actualizar usuario
  @Put(':id')
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

  //Crear usuario
  @Post()
  async createUsuario(
    @Body() createUsuarioDto: CreateUsuarioDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.usuariosService.createUsuario(createUsuarioDto, idUser);
  }
}
