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
import { TransaccionesService } from './transacciones.service';
import { CreateTransaccioneDto } from './dto/create-transaccione.dto';
import { UpdateTransaccioneDto } from './dto/update-transaccione.dto';
import { UpdateTransaccionEstatusDto } from './dto/update-transaccione-status.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiResponseCommon } from 'src/common/ApiResponse';

@UseGuards(JwtAuthGuard)
@Controller('transacciones')
export class TransaccionesController {
  constructor(private readonly transaccionesService: TransaccionesService) {}

  @Post()
  createTransaccion(@Body() createTransaccioneDto: CreateTransaccioneDto,@Request()req) {
    const idUser = req.user.userId;
    return this.transaccionesService.createTransaccion(createTransaccioneDto,idUser);
  }

  @Get('page/:page/:limit')
  async findAllTransacciones(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
  ): Promise<ApiResponseCommon> {
    return await this.transaccionesService.findAllTransacciones(page, limit);
  }

  @Get('list')
  async findAllListTransacciones(): Promise<ApiResponseCommon> {
    return await this.transaccionesService.findAllListTransacciones();
  }

  @Get(':id')
  findOneTransaccione(@Param('id') id: string) {
    return this.transaccionesService.findOneTransaccion(+id);
  }
}
