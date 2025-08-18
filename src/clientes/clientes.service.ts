import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { UpdateClienteEstatusDto } from './dto/update-clientes-estatus.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clientes } from 'src/entities/Clientes';

@Injectable()
export class ClientesService {
  constructor(
    @InjectRepository(Clientes)
    private readonly clienteRepository: Repository<Clientes>,
  ) {}
  //Crear cliente
  async createCliente(createClienteDto: CreateClienteDto) {
    try {
      const clienteCreate = await this.clienteRepository.findOne({
        where: {
          rfc: createClienteDto.rfc,
        },
      });
      if (clienteCreate) {
        throw new BadRequestException(
          `Cliente registrado con RFC: ${createClienteDto.rfc}, ingrese otro cliente`,
        );
      }
      const clienteCreado = await this.clienteRepository.save(createClienteDto);
      //falta el apartado de la bitacora
      return { message: 'Usuario creado exitosamente', User: clienteCreado };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al crear un cliente');
    }
  }
  //Obtener todos los clientes
  async getClientes() {
    try {
      const Clientes = await this.clienteRepository.find();
      if (Clientes.length === 0) {
        throw new NotFoundException('Clientes no encontrados');
      }
      //falta la parte de la bitacora
      return Clientes;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({ message: 'Error al obtener Clientes' });
    }
  }
  //Obtener el cliente por ID
  async getOneCliente(id: number) {
    try {
      const oneCliente = await this.clienteRepository.findOne({
        where: { id },
      });
      if (!oneCliente) {
        throw new NotFoundException(`EL cliente con id:${id} no encontrado`);
      }
      //Falata el apartado de la bitacora
      return oneCliente;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({
        message: `Error al obtener el cliente: ${id}`,
      });
    }
  }
  //Cambiar informacion del cliente
  async updateCliente(id: number, updateClienteDto: UpdateClienteDto) {
    try {
      const Cliente = await this.clienteRepository.findOne({ where: { id } });
      if (!Cliente) {
        throw new NotFoundException(
          `El cliente con id: ${id} no fue encontrado`,
        );
      }
      await this.clienteRepository.update(id, updateClienteDto);
      return await this.clienteRepository.findOne({ where: { id } });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      new InternalServerErrorException(
        `Error al cambiar la informacion del cliente con id:${id}`,
      );
    }
  }
  //Cambiar el estatus del cliente
  async updateClienteStatus(
    id: number,
    updateClienteEstatusDto: UpdateClienteEstatusDto,
  ) {
    try {
      const Usuario = await this.clienteRepository.findOne({ where: { id } });
      if (!Usuario) {
        throw new NotFoundException(`Cliente con id: ${id} no encontrado`);
      }
      const estatus = updateClienteEstatusDto.estatus;
      const result = await this.clienteRepository.update(id, { estatus });
      //Falta bitacora
      return {
        message: `Cliente con id:${id} su estatus fue actualizado a ${estatus}`,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al cambiar estatus del cliente con id: ${id}`,
      );
    }
  }
  //Eliminar cliente
  async removeCliente(id: number) {
    try {
      const clienteEliminar = await this.clienteRepository.findOne({
        where: { id },
      });
      if (!clienteEliminar) {
        throw new NotFoundException(
          `El cliente con id:${id} no fue encontrado`,
        );
      }
      await this.clienteRepository.remove(clienteEliminar);
      return `Cliente con id: ${id} eliminado exitosamente`;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al eliminar al cliente con id: ${id}`,
      );
    }
  }
}
