import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Request,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { BluevoxService } from './bluevox.service';
import { CreateBlueVoxsDto } from './dto/create-bluevox.dto';
import { UpdateBluevoxDto } from './dto/update-bluevox.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('bluevox')
export class BluevoxController {
  constructor(private readonly bluevoxService: BluevoxService) {}

  @Post()
  async create(
    @Body() createBlueVoxsDto: CreateBlueVoxsDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.bluevoxService.create(idUser, createBlueVoxsDto);
  }

  @Get(':page/:limit')
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
  ): Promise<ApiResponseCommon> {
    return await this.bluevoxService.findAll(page, limit);
  }

  @Get('list')
  async findAllList(): Promise<ApiResponseCommon> {
    return this.bluevoxService.findAllList();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bluevoxService.findOne(+id);
  }
}
