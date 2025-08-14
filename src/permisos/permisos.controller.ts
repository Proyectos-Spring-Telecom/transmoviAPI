import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PermisosService } from './permisos.service';
import { CreatePermisoDto } from './dto/create-permiso.dto';
import { UpdatePermisoDto } from './dto/update-permiso.dto';

@Controller('permisos')
export class PermisosController {
  constructor(private readonly permisosService: PermisosService) {}

  @Post()
  create(@Body() createPermisoDto: CreatePermisoDto) {
    return this.permisosService.create(createPermisoDto);
  }

  @Get(':page/:limit')
  findAll(@Param('page') page: number, @Param('limit') limit:number) {
    return this.permisosService.findAll(page,limit);
  }

    @Get('list')
    async findAllList(): Promise<any[]> {
        const permiso = await this.permisosService.findAllList();
        return permiso;
    }


  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.permisosService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePermisoDto: UpdatePermisoDto) {
    return this.permisosService.update(+id, updatePermisoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.permisosService.remove(+id);
  }
}
