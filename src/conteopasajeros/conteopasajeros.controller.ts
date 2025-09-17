import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import { ConteopasajerosService } from './conteopasajeros.service';
import { CreateConteoPasajerosDto } from './dto/create-conteopasajero.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';

@UseGuards(JwtAuthGuard)
@Controller('conteopasajeros')
export class ConteopasajerosController {
  constructor(
    private readonly conteopasajerosService: ConteopasajerosService,
  ) {}

  @Post()
  async create(
    @Body() createConteopasajeroDto: CreateConteoPasajerosDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.conteopasajerosService.create(idUser, createConteopasajeroDto);
  }

  @Get(':page/:limit')
  findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
  ): Promise<ApiResponseCommon> {
    return this.conteopasajerosService.findAll(page, limit);
  }

  @Get('list')
  async findAllList(): Promise<ApiResponseCommon> {
    return await this.conteopasajerosService.findAllList();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.conteopasajerosService.findOne(+id);
  }
}
