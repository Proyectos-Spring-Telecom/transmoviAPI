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
import { plainToInstance } from 'class-transformer';
import { ExposeClienteDto } from './dto/expose-cliente.dto';

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
          rfc: createClienteDto.RFC,
        },
      });
      if (clienteCreate) {
        console.log(clienteCreate);
        throw new BadRequestException(
          `Cliente registrado con RFC: ${createClienteDto.RFC}, ingrese otro cliente`,
        );
      }
      const clienteData = await this.clienteRepository.create({
        idPadre: createClienteDto.IdPadre,
        rfc: createClienteDto.RFC,
        tipoPersona: createClienteDto.TipoPersona,
        estatus: createClienteDto.Estatus,
        logotipo: createClienteDto.Logotipo,
        nombre: createClienteDto.Nombre,
        apellidoPaterno: createClienteDto.ApellidoPaterno,
        apellidoMaterno: createClienteDto.ApellidoMaterno,
        telefono: createClienteDto.Telefono,
        correo: createClienteDto.Correo,
        estado: createClienteDto.Estado,
        municipio: createClienteDto.Municipio,
        colonia: createClienteDto.Colonia,
        calle: createClienteDto.Calle,
        entreCalles: createClienteDto.EntreCalles,
        numeroExterior: createClienteDto.NumeroExterior,
        numeroInterior: createClienteDto.NumeroInterior,
        cp: createClienteDto.CP,
        nombreEncargado: createClienteDto.NombreEncargado,
        telefonoEncargado: createClienteDto.TelefonoEncargado,
        emailEncargado: createClienteDto.EmailEncargado,
      });
      const clienteCreado = await this.clienteRepository.save(clienteData);
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Clientes',
        `Se creó un cliente con RFC ${createClienteDto.RFC}`,
        'CREATE',
        `INSERT INTO Clientes (...) VALUES (...) -> RFC: ${createClienteDto.RFC}`,
        Number(idUser),
      );
      const clienteExpuesto = plainToInstance(ExposeClienteDto, clienteCreado, {
        excludeExtraneousValues: true,
      });
      return { message: 'Cliente creado exitosamente', User: clienteExpuesto };
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
      const clienteExpuesto = plainToInstance(ExposeClienteDto, Clientes, {
        excludeExtraneousValues: true,
      });
      return clienteExpuesto;
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
      const clienteExpuesto = plainToInstance(ExposeClienteDto, oneCliente, {
        excludeExtraneousValues: true,
      });
      return clienteExpuesto;
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
      const Cliente = await this.clienteRepository.findOne({ where: { id } });
      if (!Cliente) {
        throw new NotFoundException(
          `El cliente con id: ${id} no fue encontrado`,
        );
      }
      const clienteData = await this.clienteRepository.create({
        idPadre: updateClienteDto.IdPadre,
        rfc: updateClienteDto.RFC,
        tipoPersona: updateClienteDto.TipoPersona,
        estatus: updateClienteDto.Estatus,
        logotipo: updateClienteDto.Logotipo,
        nombre: updateClienteDto.Nombre,
        apellidoPaterno: updateClienteDto.ApellidoPaterno,
        apellidoMaterno: updateClienteDto.ApellidoMaterno,
        telefono: updateClienteDto.Telefono,
        correo: updateClienteDto.Correo,
        estado: updateClienteDto.Estado,
        municipio: updateClienteDto.Municipio,
        colonia: updateClienteDto.Colonia,
        calle: updateClienteDto.Calle,
        entreCalles: updateClienteDto.EntreCalles,
        numeroExterior: updateClienteDto.NumeroExterior,
        numeroInterior: updateClienteDto.NumeroInterior,
        cp: updateClienteDto.CP,
        nombreEncargado: updateClienteDto.NombreEncargado,
        telefonoEncargado: updateClienteDto.TelefonoEncargado,
        emailEncargado: updateClienteDto.EmailEncargado,
      });
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
        where: { id },
      });
      const clienteExpuesto = plainToInstance(ExposeClienteDto, clientefind, {
        excludeExtraneousValues: true,
      });
      return clienteExpuesto;
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
      const Usuario = await this.clienteRepository.findOne({ where: { id } });
      if (!Usuario) {
        throw new NotFoundException(`Cliente con id: ${id} no encontrado`);
      }
      const Estatus = updateClienteEstatusDto.Estatus;
      await this.clienteRepository.update(id, { estatus: Estatus });
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
        where: { id },
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
