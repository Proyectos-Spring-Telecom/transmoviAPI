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
} from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { UpdateClienteEstatusDto } from './dto/update-clientes-estatus.dto';
@UseGuards(JwtAuthGuard)
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}
  //Crear cliente
  @Post()
  createCliente(@Body() createClienteDto: CreateClienteDto) {
    console.log('Entro a crear cliente controller');
    return this.clientesService.createCliente(createClienteDto);
  }
  //Obtener todos los clientes
  @Get('')
  getClientes() {
    return this.clientesService.getClientes();
  }
  //Obtener solo un cliente
  @Get(':id')
  getOneCliente(@Param('id') id: string) {
    return this.clientesService.getOneCliente(+id);
  }
  //Actualizar un cliente
  @Put(':id')
  updateCliente(
    @Param('id') id: string,
    @Body() updateClienteDto: UpdateClienteDto,
  ) {
    return this.clientesService.updateCliente(+id, updateClienteDto);
  }
  //Actualizar el estatus del cliente
  @Patch(':id/estatus')
  updateEstatusClientes(
    @Param('id') id: string,
    @Body() updateClienteEstatusDto: UpdateClienteEstatusDto,
  ) {
    return this.clientesService.updateClienteStatus(
      +id,
      updateClienteEstatusDto,
    );
  }
  //Eliminar Cliente
  @Delete(':id')
  removeClientes(@Param('id') id: string) {
    return this.clientesService.removeCliente(+id);
  }
}
