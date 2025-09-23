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

  // ===== CREATE =====
  @Post()
  @ApiOperation({ summary: 'Crear nuevo usuario' })
  async createUsuario(
    @Body() createUsuarioDto: CreateUsuarioDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.usuariosService.createUsuario(createUsuarioDto, idUser);
  }

  // ===== READ =====
  @Get(':page/:limit')
  @ApiOperation({ summary: 'Obtener usuarios paginados' })
  @ApiResponse({ status: 200, description: 'Lista de usuarios' })
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
  ): Promise<ApiResponseCommon> {
    return await this.usuariosService.getAllUsuario(page, limit);
  }

  @Get('list')
  @ApiOperation({ summary: 'Obtener todos los usuarios' })
  async findAllList(): Promise<ApiResponseCommon> {
    return await this.usuariosService.getAllListUsuarios();
  }

  @Get('list/rol/operador')
  @ApiOperation({ summary: 'Obtener usuarios con rol operador' })
  async findAllListOperador(): Promise<ApiResponseCommon> {
    return await this.usuariosService.getAllListUsuariosRol();
  }

  @Get('list/cliente/:id')
  @ApiOperation({ summary: 'Obtener usuarios por cliente' })
  async findAllListUsuarioCliente(@Param('id', ParseIntPipe) id: number): Promise<ApiResponseCommon> {
    return await this.usuariosService.getAllListUsuariosCliente(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener usuario por ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.getUsuarioByID(id);
  }

  // ===== UPDATE =====
  @Put(':id')
  @ApiOperation({ summary: 'Actualizar usuario' })
  async updateUsuario(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUsuarioDto: UpdateUsuarioDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.usuariosService.updateUsuario(id, updateUsuarioDto, idUser);
  }

  @Put('operador')
  @ApiOperation({ summary: 'Actualizar o crear PIN de operador' })
  async updatePin(
    @Body() updateUsuarioOperadorDto: UpdateUsuarioOperadorDto,
    @Request() req
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    const userName = req.user.email;
    return await this.usuariosService.createPin(userName, idUser, updateUsuarioOperadorDto);
  }

  @Put('actualizar/contrasena/:id')
  @ApiOperation({ summary: 'Cambiar contraseña de usuario' })
  async updateContrasena(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUsuarioContrasena: UpdateUsuarioContrasena,
    @Request() req
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.usuariosService.updateContrasena(id, idUser, updateUsuarioContrasena);
  }

  @Patch('estatus/:id')
  @ApiOperation({ summary: 'Cambiar estatus del usuario' })
  async changeUsuarioEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUsuarioEstatusDto: UpdateUsuarioEstatusDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.usuariosService.updateUsuarioEstatus(id, updateUsuarioEstatusDto, idUser);
  }

  // ===== DELETE =====
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar usuario' })
  async deleteUsuario(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.usuariosService.deleteUsuario(id, idUser);
  }
}