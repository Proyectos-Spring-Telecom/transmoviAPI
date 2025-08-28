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
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { ApiResponseCommon } from 'src/common/ApiResponse';

@Injectable()
export class ClientesService {
  constructor(
    @InjectRepository(Clientes)
    private readonly clienteRepository: Repository<Clientes>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}
  //Crear cliente
  async createCliente(createClienteDto: CreateClienteDto, idUser: string) {
    try {
      const clienteCreate = await this.clienteRepository.findOne({
        where: {
          RFC: createClienteDto.RFC,
        },
      });
      if (clienteCreate) {
        throw new BadRequestException(
          `Cliente registrado con RFC: ${createClienteDto.RFC}, ingrese otro cliente`,
        );
      }
      const clienteData = await this.clienteRepository.create(createClienteDto);
      const clienteCreado = await this.clienteRepository.save(clienteData);
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Clientes',
        `Se creó un cliente con RFC ${createClienteDto.RFC}`,
        'CREATE',
        `INSERT INTO Clientes (...) VALUES (...) -> RFC: ${createClienteDto.RFC}`,
        Number(idUser),
      );
      return { message: 'Cliente creado exitosamente', Data: clienteCreado };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al crear un cliente');
    }
  }
  //Obtener todos los clientes
  async getAllClientes(page: number, limit: number): Promise<ApiResponseCommon> {
    try {
      const Clientes = await this.clienteRepository.find();
      if (Clientes.length === 0) {
        throw new NotFoundException('Clientes no encontrados');
      }
      const [data, total] = await this.clienteRepository.findAndCount({
        relations:[],         //Falta la relacion
        skip: (page - 1) * limit,
        take: limit,
        
      });
      const result: ApiResponseCommon = {
        data,
        paginated: {
          total: Math.ceil(total/limit),
          page,
          limit,
        },
        message: 'Clientes obtenidos correctamente',
      }
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({ message: 'Error al obtener Clientes' });
    }
  }

    //Obtener todos los clientes
  async getAllListClientes(): Promise<ApiResponseCommon> {
    try {
      const Clientes = await this.clienteRepository.find();
      if (Clientes.length === 0) {
        throw new NotFoundException('Clientes no encontrados');
      }
      const result: ApiResponseCommon = {
        data:Clientes,

        message: 'Clientes obtenidos correctamente',
      }
      return result;
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
      const cliente = await this.clienteRepository.findOne({
        where: { Id:id },
      });
      if (!cliente) {
        throw new NotFoundException(`EL cliente con id:${id} no encontrado`);
      }
      return cliente;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({
        message: `Error al obtener el cliente: ${id}`,
      });
    }
  }
  //Actualizar informacion del cliente
  async updateCliente(
    id: number,
    idUser: string,
    updateClienteDto: UpdateClienteDto,
  ) {
    try {
      const Cliente = await this.clienteRepository.findOne({ where: { Id:id } });
      if (!Cliente) {
        throw new NotFoundException(
          `El cliente con id: ${id} no fue encontrado`,
        );
      }
      const clienteData = await this.clienteRepository.create(updateClienteDto);
      await this.clienteRepository.update(id, clienteData);
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Clientes',
        `Se actualizó el cliente con ID: ${idUser}`,
        'UPDATE',
        `UPDATE Clientes SET ... WHERE Id=${idUser}`,
        Number(idUser),
      );
      //Hacemos un expose que convierta los atributos en PascalCase
      const clientefind = await this.clienteRepository.findOne({
        where: { Id:id },
      });
      return clientefind;
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
    idUser: string,
    updateClienteEstatusDto: UpdateClienteEstatusDto,
  ) {
    try {
      const Usuario = await this.clienteRepository.findOne({ where: { Id:id } });
      if (!Usuario) {
        throw new NotFoundException(`Cliente con id: ${id} no encontrado`);
      }
      const Estatus = updateClienteEstatusDto.Estatus;
      await this.clienteRepository.update(id, { Estatus });
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Clientes',
        `Se cambio el estatus del cliente: ${id} a estatus: ${Estatus}`,
        'UPDATE',
        `UPDATE CLIENTE SET Estatus = ${Estatus} WHERE id = ${id}`,
        Number(idUser),
      );
      return {
        message: `Cliente con id:${id} su estatus fue actualizado a ${Estatus}`,
        Estatus: Number(Estatus),
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
  async removeCliente(id: number, idUser: string) {
    try {
      const clienteEliminar = await this.clienteRepository.findOne({
        where: { Id:id },
      });
      if (!clienteEliminar) {
        throw new NotFoundException(
          `El cliente con id:${id} no fue encontrado`,
        );
      }
      await this.clienteRepository.remove(clienteEliminar);
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Clientes',
        `Se eliminó el cliente con ID: ${id}`,
        'DELETE',
        `DELETE FROM Clientes WHERE Id=${id}`,
        Number(idUser),
      );
      return {
        message: `Cliente con id: ${id} eliminado exitosamente`,
        Id: Number(id),
      };
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
