import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Put,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { OperadoresService } from './operadores.service';
import { CreateOperadoreDto } from './dto/create-operadore.dto';
import { UpdateOperadoreDto } from './dto/update-operadore.dto';
import { UpdateOperadorStatusDto } from './dto/update-operadores-estatus.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiResponseCommon } from 'src/common/ApiResponse';

@UseGuards(JwtAuthGuard)
@Controller('operadores')
export class OperadoresController {
  constructor(private readonly operadoresService: OperadoresService) {}

  @Post()
  createOperador(@Body() createOperadoreDto: CreateOperadoreDto,
@Request() req,) {
    const idUser = req.user.userId;
    return this.operadoresService.createOperador(createOperadoreDto,idUser);
  }

  @Get()
  findAllOperador(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
  ): Promise<ApiResponseCommon> {
    return this.operadoresService.findAllOperadores(page,limit);
  }

  @Get()
  findAllListOperador(): Promise<ApiResponseCommon> {
    return this.operadoresService.findAllListOperadores();
  }

  @Get(':id')
  findOneOperador(@Param('id') id: string) {
    return this.operadoresService.findOneOperador(+id);
  }

  @Patch(':id/estatus')
  updateOperadorEstatus(
    @Param('id') id: string,
    @Request() req,
    @Body() updateOperadorStatusDto: UpdateOperadorStatusDto,
  ) {
    const idUser = req.user.userId;
    return this.operadoresService.updateOperadorEstatus(
      +id,
      idUser,
      updateOperadorStatusDto,
    );
  }

  @Put(':id')
  updateOperador(
    @Param('id') id: string,
    @Request() req,
    @Body() updateOperadoreDto: UpdateOperadoreDto,
  ) {
    const idUser = req.user.userId;
    return this.operadoresService.updateOperador(+id, idUser,updateOperadoreDto);
  }

  @Delete(':id')
  removeOperador(@Param('id') id: string,@Request() req,) {
    const idUser = req.user.userId;
    return this.operadoresService.removeOperador(+id,idUser);
  }
}
