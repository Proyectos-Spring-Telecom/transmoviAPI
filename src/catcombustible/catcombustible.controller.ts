import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { CatcombustibleService } from './catcombustible.service';
import { CreateCatTipoCombustibleDto } from './dto/create-catcombustible.dto';
import { UpdateCatcombustibleDto } from './dto/update-catcombustible.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('catcombustible')
export class CatcombustibleController {
  constructor(private readonly catcombustibleService: CatcombustibleService) {}

  @Post()
  create(@Body() createCatTipoCombustibleDto: CreateCatTipoCombustibleDto) {
    return this.catcombustibleService.create(createCatTipoCombustibleDto);
  }

  @Get('list')
  findAllList(@Request() req) {
    return this.catcombustibleService.findAllList();
  }

  @Get()
  findAll() {
    return this.catcombustibleService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.catcombustibleService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCatcombustibleDto: UpdateCatcombustibleDto) {
    return this.catcombustibleService.update(+id, updateCatcombustibleDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.catcombustibleService.remove(+id);
  }
}
