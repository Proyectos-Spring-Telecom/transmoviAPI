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
  Request,
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
  createCliente(@Body() createClienteDto: CreateClienteDto,
  @Request()req
) {
    const idUser ="1"
    return this.clientesService.createCliente(createClienteDto,idUser);
  }
  //Obtener todos los clientes
  @Get('')
  getClientes() {
    const idUser ="1"
    return this.clientesService.getClientes();
  }
  //Obtener solo un cliente
  @Get(':id')
  getOneCliente(@Param('id') id: string) {
    const idUser ="1"
    return this.clientesService.getOneCliente(+id);
  }
  //Actualizar un cliente
  @Put(':id')
  updateCliente(
    @Param('id') id: string,
    @Body() updateClienteDto: UpdateClienteDto,
  ) {
    const idUser ="1"
    return this.clientesService.updateCliente(+id, idUser,updateClienteDto);
  }
  //Actualizar el estatus del cliente
  @Patch(':id/estatus')
  updateEstatusClientes(
    @Param('id') id: string,
    @Body() updateClienteEstatusDto: UpdateClienteEstatusDto,
  ) {
    const idUser ="1"
    return this.clientesService.updateClienteStatus(
      +id,
      idUser,//falta
      updateClienteEstatusDto,
    );
  }
  //Eliminar Cliente
  @Delete(':id')
  removeClientes(@Param('id') id: string) {
    const idUser ="1" //falta
    return this.clientesService.removeCliente(+id,idUser);
  }
}
