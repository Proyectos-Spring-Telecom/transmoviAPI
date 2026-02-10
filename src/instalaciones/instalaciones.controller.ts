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
  ParseIntPipe,
  Put,
} from '@nestjs/common';
import { InstalacionesService } from './instalaciones.service';
import { CreateInstalacionesDto } from './dto/create-instalacione.dto';
import { UpdateInstalacioneDto } from './dto/update-instalacione.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { UpdateInstalacioneEstatusDto } from './dto/update-instalacione-estatus.dto';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Instalaciones')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('instalaciones')
export class InstalacionesController {
  constructor(private readonly instalacionesService: InstalacionesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear instalación' })
  @ApiResponse({ status: 201, description: 'Instalación creada' })
  async create(
    @Body() createInstalacioneDto: CreateInstalacionesDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    return await this.instalacionesService.create(
      +idUser,
      +cliente,
      createInstalacioneDto,
    );
  }

  @Get(':page/:limit')
  @ApiOperation({ summary: 'Obtener instalaciones paginadas' })
  @ApiParam({ name: 'page', type: Number })
  @ApiParam({ name: 'limit', type: Number })
  @ApiResponse({ status: 200, description: 'Paginación de instalaciones' })
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
  ) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return await this.instalacionesService.findAll(+idUser, +cliente, +rol, page, limit);
  }

  @Get('list')
  @ApiOperation({ summary: 'Obtener listado de instalaciones' })
  @ApiResponse({ status: 200, description: 'Listado de instalaciones' })
  async findAllList(@Request() req): Promise<ApiResponseCommon> {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return await this.instalacionesService.findAllList(+idUser, +cliente, +rol);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una instalación por ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Instalación' })
  async findOne(@Param('id') id: string, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return await this.instalacionesService.findOne(+id,+idUser,+cliente, +rol);
  }

  @Patch('estatus/:id')
  @ApiOperation({ 
    summary: 'Actualizar estatus de una instalación',
    description: 'Actualiza el estatus de una instalación (activa/inactiva) y ajusta automáticamente el estado de los componentes asociados (Dispositivo, Vehículo, BlueVoxs). Soporta múltiples BlueVoxs por instalación.'
  })
  @ApiParam({ 
    name: 'id', 
    type: Number, 
    description: 'ID de la instalación a actualizar' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Estatus de la instalación actualizado exitosamente',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        message: { type: 'string', example: 'El estatus de las instalaciones ha sido actualizado con éxito.' },
        estatus: { 
          type: 'object',
          properties: {
            estatus: { type: 'number', example: 1 }
          }
        },
        data: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            nombre: { type: 'string', example: '1 dispositivo:5 vehiculo: 10' }
          }
        }
      }
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Instalación no encontrada' 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Conflictos de uso o componentes no disponibles' 
  })
  updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateInstalacioneEstatusDto: UpdateInstalacioneEstatusDto,
    @Request() req,
  ) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.instalacionesService.updateEstatus(
      id,
      +idUser,
      +cliente,
      +rol,
      updateInstalacioneEstatusDto,
    );
  }

  @Put(':id')
  @ApiOperation({ 
    summary: 'Actualizar una instalación',
    description: 'Actualiza los componentes de una instalación (Dispositivo, Vehículo, BlueVoxs). Soporta actualización de múltiples BlueVoxs mediante matriz de decisiones (similar a usuarios-permisos). Los BlueVoxs se gestionan mediante la tabla intermedia InstalacionesBlueVoxs.'
  })
  @ApiParam({ 
    name: 'id', 
    type: Number, 
    description: 'ID de la instalación a actualizar' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Instalación actualizada exitosamente',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        message: { type: 'string', example: 'Las instalaciones se actualizaron con éxito.' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            nombre: { type: 'string', example: 'Instalación 1 asociada a Dispositivo: 5 y Vehículo: 10.' }
          }
        }
      }
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Instalación no encontrada' 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Error de validación o BlueVoxs inválidos' 
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateInstalacioneDto: UpdateInstalacioneDto,
    @Request() req,
  ) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return await this.instalacionesService.update(
      id,
      +idUser,
      +cliente,
      +rol,
      updateInstalacioneDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    const cliente = req.user.cliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.instalacionesService.remove(+id, +cliente, +idUser, +rol);
  }
}
