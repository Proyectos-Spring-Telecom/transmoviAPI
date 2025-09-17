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
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';

@Injectable()
export class ClientesService {
  constructor(
    @InjectRepository(Clientes)
    private readonly clienteRepository: Repository<Clientes>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}
  //Crear cliente
  async createCliente(
    createClienteDto: CreateClienteDto,
    idUser: string,
  ): Promise<ApiCrudResponse> {
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
      const clienteData = await this.clienteRepository.create(createClienteDto);
      const clienteCreado = await this.clienteRepository.save(clienteData);
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Clientes',
        `Se creó un cliente con RFC ${createClienteDto.rfc}`,
        'CREATE',
        `INSERT INTO Clientes (...) VALUES (...) -> RFC: ${createClienteDto.rfc}`,
        Number(idUser),
        1,
      );
      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Cliente creado correctamente',
        data: {
          id: clienteCreado.id,
          nombre:
            `${clienteCreado.nombre} ${clienteCreado.apellidoPaterno} ` || '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al crear un cliente');
    }
  }
  //Obtener todos los clientes
  async getAllClientes(
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    try {
      const Clientes = await this.clienteRepository.find();
      if (Clientes.length === 0) {
        throw new NotFoundException('Clientes no encontrados');
      }
      const [data, total] = await this.clienteRepository.findAndCount({
        relations: [], //Falta la relacion
        skip: (page - 1) * limit,
        take: limit,select:{
          id:true,
          rfc:true,
          tipoPersona:true,
          nombre:true,
          apellidoPaterno:true,
          apellidoMaterno:true,
          telefono:true,
          correo:true,
          estado:true,
          municipio:true,
          colonia:true,
          calle:true,
          entreCalles:true,
          numeroExterior:true,
          numeroInterior:true,
          cp:true,
          nombreEncargado:true,
          telefonoEncargado:true,
          correoEncargado:true,
          constanciaSituacionFiscal:true,
          comprobanteDomicilio:true,
          actaConstitutiva:true,
          logotipo:true,
          estatus:true,
        }
      });
      const result: ApiResponseCommon = {
        data,
        paginated: {
          total:total,
          page,
          lastPage: Math.ceil(total / limit),
        },
      };
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
      const Clientes = await this.clienteRepository.find({
        select: {
          id: true,
          nombre: true,
          apellidoPaterno: true,
          apellidoMaterno: true,
        },
        where: { estatus: 1 },
      });
      if (Clientes.length === 0) {
        throw new NotFoundException('Clientes no encontrados');
      }
      const result: ApiResponseCommon = {
        data: Clientes,
      };
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
        where: { id: id },
      });
      if (!cliente) {
        throw new NotFoundException(`EL cliente con id:${id} no encontrado`);
      }
      return {data: cliente};
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
  ): Promise<ApiCrudResponse> {
    try {
      const Cliente = await this.clienteRepository.findOne({
        where: { id: id },
      });
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
        1,
      );
      //Hacemos un expose que convierta los atributos en PascalCase
      const clientefind = await this.clienteRepository.findOne({
        where: { id: id },
      });
      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Cliente actualizado correctamente',
        data: {
          id: id,
          nombre:
            `${clientefind?.nombre} ${clientefind?.apellidoPaterno} ` || '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al cambiar la informacion del cliente con id:${id}`,
      );
    }
  }
  //Cambiar el estatus del cliente
  async updateClienteStatus(
    id: number,
    idUser: string,
    updateClienteEstatusDto: UpdateClienteEstatusDto,
  ): Promise<ApiCrudResponse> {
    try {
      const usuario = await this.clienteRepository.findOne({
        where: { id: id },
      });
      if (!usuario) {
        throw new NotFoundException(`Cliente con id: ${id} no encontrado`);
      }
      const estatus = updateClienteEstatusDto.estatus;
      await this.clienteRepository.update(id, { estatus });
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Clientes',
        `Se cambio el estatus del cliente: ${id} a estatus: ${estatus}`,
        'UPDATE',
        `UPDATE CLIENTE SET Estatus = ${estatus} WHERE id = ${id}`,
        Number(idUser),
        1,
      );
      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Estatus cliente actualizado correctamente',
        estatus:{estatus:estatus},
        data: {
          id: id,
          nombre: `${usuario.nombre} ${usuario.apellidoPaterno} ` || '',
        },
      };
      return result;
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
  async removeCliente(id: number, idUser: string): Promise<ApiCrudResponse> {
    try {
      const clienteEliminar = await this.clienteRepository.findOne({
        where: { id: id },
      });
      if (!clienteEliminar) {
        throw new NotFoundException(
          `El cliente con id:${id} no fue encontrado`,
        );
      }
      await this.clienteRepository.update(id, { estatus: 0 });
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Clientes',
        `Se eliminó el cliente con ID: ${id}`,
        'DELETE',
        `DELETE FROM Clientes WHERE Id=${id}`,
        Number(idUser),
        1,
      );
      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Cliente creado correctamente',
        data: {
          id: id,
          nombre:
            `${clienteEliminar.nombre} ${clienteEliminar.apellidoPaterno} ` ||
            '',
        },
      };
      return result;
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
