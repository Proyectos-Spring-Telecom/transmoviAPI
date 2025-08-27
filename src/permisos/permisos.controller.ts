import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Put,
  ParseIntPipe,
} from '@nestjs/common';
import { PermisosService } from './permisos.service';
import { CreatePermisoDto } from './dto/create-permiso.dto';
import { UpdatePermisoDto } from './dto/update-permiso.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { UpdatePermisoEstatusDto } from './dto/update-permiso-estatus.dto';
import { ApiResponseCommon } from 'src/common/ApiResponse';

@Controller('permisos')
@UseGuards(JwtAuthGuard)
export class PermisosController {
  constructor(private readonly permisosService: PermisosService) {}

  @Post()
  async createPermioso(@Body() createPermiso: CreatePermisoDto, @Req() req) {
    const idUsuario = req.user.userId;
    return this.permisosService.createPermiso(createPermiso, idUsuario);
  }

  @Get('page/:page/:limit')
  async findAll(
    @Param('page',ParseIntPipe) page: number,
    @Param('limit',ParseIntPipe) limit: number,
  ): Promise<ApiResponseCommon> {
    return await this.permisosService.findAll(page,limit);
  }

  @Get('list')
  async findAllList(): Promise<ApiResponseCommon> {
    return await this.permisosService.findAllList();
  }

  @Get('permisosAgrupados')
  async findAllAgrupado(@Req() req): Promise<any[]> {
    const idUsuario = req.user.userId;
    const permiso =
      await this.permisosService.obtenerPermisosAgrupados(idUsuario);
    return permiso;
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.permisosService.findOne(+id);
  }

  @Put()
  async update(@Body() updatePermisoDto: UpdatePermisoDto) {
    return await this.permisosService.update(updatePermisoDto);
  }

  @Patch(':id/estatus')
  async updatePermisoEstatus(
    @Param('id') id: string,
    @Body() updatePermisoEstatusDto: UpdatePermisoEstatusDto,
  ) {
    return await this.permisosService.updateEstatus(
      +id,
      updatePermisoEstatusDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.permisosService.remove(+id);
  }
}
