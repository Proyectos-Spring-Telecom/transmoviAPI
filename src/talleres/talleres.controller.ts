import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TalleresService } from './talleres.service';
import { CreateTallereDto } from './dto/create-tallere.dto';
import { UpdateTallereDto } from './dto/update-tallere.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';

@Controller('talleres')
@UseGuards(JwtAuthGuard)
export class TalleresController {
  constructor(private readonly talleresService: TalleresService) {}

  @Post()
  create(@Body() createTallereDto: CreateTallereDto, @Req() req: any) {
    console.log(req.user.userId);
    createTallereDto.idCliente = req.user.idCliente;
    return this.talleresService.create(createTallereDto, req.user.userId);
  }

  @Get()
  findAll(@Req() req:any) {
    return this.talleresService.findAll(req);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.talleresService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTallereDto: UpdateTallereDto,@Req() req) {
    return this.talleresService.update(+id, updateTallereDto,req.user.id);
  }

  @Patch('desactivar/:id')
  remove(@Param('id') id: number,@Req() req:any) {
    return this.talleresService.remove(+id,Number(req.user.id));
  }
  @Patch('activar/:id')
  activar(@Param('id') id: number,@Req() req:any) {
    return this.talleresService.activar(+id,Number(req.user.id));
  }
}
