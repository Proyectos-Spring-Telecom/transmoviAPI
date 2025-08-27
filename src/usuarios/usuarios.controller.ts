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
@UseGuards(JwtAuthGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get('page/:page/:limit')
  @ApiOperation({ summary: 'Obtener todos los usuarios' })
  @ApiResponse({ status: 200, description: 'Lista de usuarios', type: [CreateUsuarioDto] })
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
  ): Promise<ApiResponseCommon> {
    return await this.usuariosService.getAllUsuario(page,limit);
  }

  @Get('list')
  async findAllList():Promise <ApiResponseCommon>{
    
    return await this.usuariosService.getAllListUsuarios();
  }

  @Get('/:id')
  findOne(@Param('id') id: string) {
    return this.usuariosService.getUsuarioByID(+id);
  }

  @Post()
  createUsuario(@Body() createUsuarioDto: CreateUsuarioDto,@Request()req) {
    const idUser = req.user.userId;
    return this.usuariosService.createUsuario(createUsuarioDto,idUser);
  }

  @Put('/:id')
  updateUsuario(
    @Param('id')
    id: string,
    @Body() updateUsuarioDto: UpdateUsuarioDto,
    @Request() req
  ) {
    const idUser = req.user.userId;
    return this.usuariosService.updateUsuario(+id, updateUsuarioDto,idUser);
  }

  @Delete('/:id')
  deleteUsuario(@Param('id') id: string,@Request() req) {
    const idUser = req.user.userId;
    return this.usuariosService.deleteUsuario(+id,idUser);
  }

  @Patch('/:id/estatus')
  changeUsuarioEstatus(
    @Param('id') id: string,
    @Body() updateUsuarioEstatusDto: UpdateUsuarioEstatusDto,
    @Request() req
  ) {
    const idUser = req.user.userId;
    return this.usuariosService.updateUsuarioEstatus(
      +id,
      updateUsuarioEstatusDto,
      idUser
    );
  }
}
