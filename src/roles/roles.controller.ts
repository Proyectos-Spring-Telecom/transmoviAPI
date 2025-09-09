import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Request,
  Put,
  UseGuards,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRolDto } from './dto/create-rol.dto'; 
import { UpdateRoleDto } from './dto/update-role.dto';
import { ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';

@Controller('roles')
@UseGuards(JwtAuthGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  create(
    @Body() createRoleDto: CreateRolDto,
    @Request()req
  ) {
    const idUser = req.user.userId;
    return this.rolesService.create(idUser,createRoleDto);
  }

  @Get(':page/:limit')
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
  ): Promise<ApiResponseCommon> {
    return await this.rolesService.findAll(page, limit);
  }

  @Get('list')
  async findAllList(): Promise<ApiResponseCommon> {
    return await this.rolesService.findAllList();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.findOne(id);
  }

  @Put(':id')
  update(@Param('id',ParseIntPipe) id: number, @Body() updateRoleDto: UpdateRoleDto,@Request()req) {
    const idUser = req.user.userId;
    return this.rolesService.update(id,idUser, updateRoleDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string,@Request()req) {
    const idUser = req.user.userId;
    return this.rolesService.remove(+id,idUser);
  }
}
