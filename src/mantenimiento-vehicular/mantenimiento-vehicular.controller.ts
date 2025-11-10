import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Request,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { MantenimientoVehicularService } from './mantenimiento-vehicular.service';
import { CreateMantenimientoVehicularDto } from './dto/create-mantenimiento-vehicular.dto';
import { UpdateMantenimientoVehicularDto } from './dto/update-mantenimiento-vehicular.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';

@ApiTags('Mantenimiento Vehicular')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('mantenimiento-vehicular')
export class MantenimientoVehicularController {
  constructor(
    private readonly mantenimientoVehicularService: MantenimientoVehicularService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Crear un nuevo mantenimiento vehicular',
    description: 'Crea un nuevo registro de mantenimiento vehicular con toda la información del servicio realizado.',
  })
  @ApiBody({
    type: CreateMantenimientoVehicularDto,
    description: 'Datos del mantenimiento vehicular a crear',
  })
  @ApiResponse({
    status: 201,
    description: 'Mantenimiento vehicular creado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async create(
    @Body() createMantenimientoVehicularDto: CreateMantenimientoVehicularDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.mantenimientoVehicularService.create(
      createMantenimientoVehicularDto,
      idUser,
    );
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Obtener mantenimientos vehiculares paginados',
    description: 'Obtiene un listado paginado de mantenimientos vehiculares con sus relaciones.',
  })
  @ApiParam({
    name: 'page',
    type: Number,
    description: 'Número de página',
    example: 1,
  })
  @ApiParam({
    name: 'limit',
    type: Number,
    description: 'Cantidad de registros por página',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Listado paginado de mantenimientos vehiculares obtenido exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
  ): Promise<ApiResponseCommon> {
    return this.mantenimientoVehicularService.findAll(page, limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un mantenimiento vehicular por ID',
    description: 'Obtiene los detalles completos de un mantenimiento vehicular específico por su ID, incluyendo todas sus relaciones.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID del mantenimiento vehicular',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Mantenimiento vehicular encontrado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Mantenimiento vehicular no encontrado',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ApiResponseCommon> {
    return this.mantenimientoVehicularService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar un mantenimiento vehicular',
    description: 'Actualiza los datos de un mantenimiento vehicular existente. Solo se actualizan los campos proporcionados.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID del mantenimiento vehicular a actualizar',
    example: 1,
  })
  @ApiBody({
    type: UpdateMantenimientoVehicularDto,
    description: 'Datos del mantenimiento vehicular a actualizar',
  })
  @ApiResponse({
    status: 200,
    description: 'Mantenimiento vehicular actualizado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación',
  })
  @ApiResponse({
    status: 404,
    description: 'Mantenimiento vehicular no encontrado',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMantenimientoVehicularDto: UpdateMantenimientoVehicularDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.mantenimientoVehicularService.update(
      id,
      updateMantenimientoVehicularDto,
      idUser,
    );
  }

  @Patch(':id/desactivar')
  @ApiOperation({
    summary: 'Desactivar un mantenimiento vehicular',
    description: 'Desactiva un mantenimiento vehicular cambiando su estatus a 0.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID del mantenimiento vehicular a desactivar',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Mantenimiento vehicular desactivado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Mantenimiento vehicular no encontrado',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async desactivar(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.mantenimientoVehicularService.desactivar(id, idUser);
  }

  @Patch(':id/activar')
  @ApiOperation({
    summary: 'Activar un mantenimiento vehicular',
    description: 'Activa un mantenimiento vehicular cambiando su estatus a 1 si estaba previamente en 0.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID del mantenimiento vehicular a activar',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Mantenimiento vehicular activado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'El mantenimiento vehicular ya está activo',
  })
  @ApiResponse({
    status: 404,
    description: 'Mantenimiento vehicular no encontrado',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async activar(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.mantenimientoVehicularService.activar(id, idUser);
  }
}
