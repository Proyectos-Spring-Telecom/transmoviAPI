//Controlador Usuario
import { 
  Controller, 
  Get,
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  Put 
} from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UpdateUsuarioEstatusDto } from './dto/update-usuario-estatus.dto';

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  findAll() {
    return this.usuariosService.getAllUsuario();
  }

  @Get('/:id')
  findOne(@Param('id') id: string){
    return this.usuariosService.getUsuarioByID(id);
  }

  @Post()
  createUsuario(@Body() createUsuarioDto: CreateUsuarioDto){
    console.log('Entro a crear un usuario controller');
    return this.usuariosService.createUsuario(createUsuarioDto);
  }

  @Put('/:id')
  updateUsuario(
    @Param('id')
    id: string,
    @Body() updateUsuarioDto: UpdateUsuarioDto
  ) {
    return this.usuariosService.updateUsuario(Number(id), updateUsuarioDto);
  }

  @Delete('/:id')
  deleteUsuario(@Param('id') id: string) {
    return this.usuariosService.deleteUsuario(Number(id));
  }

  @Patch('/:id/estatus')
  changeUsuarioEstatus(
    @Param('id') id: string,
    @Body() updateUsuarioEstatusDto: UpdateUsuarioEstatusDto
  ) {
    return this.usuariosService.changeUsuarioEstatus(
      Number(id),
      updateUsuarioEstatusDto
    );
  }

}
