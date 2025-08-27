//Servicio usuario
import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuarios } from 'src/entities/Usuarios';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UpdateUsuarioEstatusDto } from './dto/update-usuario-estatus.dto';
import * as bcrypt from 'bcrypt';
import { ApiResponseCommon } from 'src/common/ApiResponse';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { ClientesService } from 'src/clientes/clientes.service';
@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuarios)
    private readonly usuarioRepository: Repository<Usuarios>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly clientesService: ClientesService,
  ) {}
  //Obtener todos los usuarios con paginacion
  async getAllUsuario(page: number, limit: number): Promise<ApiResponseCommon> {
    try {
      const [data, total] = await this.usuarioRepository.findAndCount({
        relations: ['IdCliente2'],
        skip: (page - 1) * limit,
        take: limit,
      });
      const dataFiltrada = data.map((u) => ({
        Id: u.Id,
        UserName: u.UserName,
        EmailConfirmed: u.EmailConfirmed,
        Telefono: u.Telefono,
        Nombre: u.Nombre,
        ApellidoPaterno: u.ApellidoPaterno,
        ApellidoMaterno: u.ApellidoMaterno,
        Estatus: u.Estatus,
        IdRol: u.IdRol,
        IdCliente: u.IdCliente,
        ClienteNombre: u.IdCliente2?.Nombre || null, // solo nombre del cliente
      }));
      const result: ApiResponseCommon = {
        data: dataFiltrada,
        paginated: {
          total: Math.ceil(total / limit),
          page,
          limit,
        },
        message: 'Usuarios obtenidos correctamente',
      };
      return result;
    } catch (error) {
      throw new BadRequestException(error.message || 'Error fetching data');
    }
  }
  //Obtener todos los usuarios
  async getAllListUsuarios(): Promise<ApiResponseCommon> {
    try {
      const usuarios = await this.usuarioRepository.find();
      if (usuarios.length === 0) {
        throw new NotFoundException('Usuarios no encontrados');
      }
      const usuariosSinPassword = usuarios.map(({ Password, ...rest }) => rest);
      const result: ApiResponseCommon = {
        data: usuariosSinPassword,

        message: 'Usuarios obtenidos correctamente',
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new BadRequestException({ message: 'Error al obtener Usuarios' });
    }
  }
  //Obtener el usuario por ID
  async getUsuarioByID(id: number) {
    try {
      //Cambiamos el id a number
      const user = await this.usuarioRepository.findOne({
        where: { Id: id },
      });
      if (!user) {
        throw new NotFoundException(`Usuario con ID:${id} no encontrado`);
      }
      //Falta el apartado de la bitacora
      const { Password: _, ...usuarioSinPassword } = user;
      return usuarioSinPassword;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtener Usuario',
      });
    }
  }
  //Creacion de un usuario
  async createUsuario(createUsuarioDto: CreateUsuarioDto, idUser: string) {
    try {
      const existUsuario = await this.usuarioRepository.findOne({ //Buscamos si existe usuario
        where: { UserName: createUsuarioDto.UserName },
      });
      if (existUsuario) {
        throw new BadRequestException('El usuario ya existe');
      }
      const cliente = await this.clientesService.getOneCliente(   //Buscamos si existe el cliente
        createUsuarioDto.IdCliente,
      );
      if (!cliente) throw new BadRequestException('Cliente Invalido');

      const hashedPassword = await bcrypt.hash(createUsuarioDto.Password, 10); //encriptamos la contraseña
      createUsuarioDto.Password = hashedPassword;
      
      const newUser = this.usuarioRepository.create(createUsuarioDto);
      await this.usuarioRepository.save(newUser);                             //creamos el usuario

      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Usuarios',
        `Se creó un usuarios con nombre: ${createUsuarioDto.Nombre}`,
        'CREATE',
        `INSERT INTO Usuarios (...) VALUES (...) -> username:  ${createUsuarioDto.UserName} nombre: ${createUsuarioDto.Nombre} apellido paterno: ${createUsuarioDto.ApellidoPaterno} apellido materno: ${createUsuarioDto.ApellidoMaterno}`,
        Number(idUser),
      );
      const { Password: _, ...usuarioSinPassword } = newUser;
      return {
        message: 'Usuario creado exitosamente',
        User: usuarioSinPassword,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(error);
    }
  }

  //Actualizar usuario
  async updateUsuario(
    id: number,
    updateUsuarioDto: UpdateUsuarioDto,
    idUser: string,
  ) {
    try {
      const usuario = await this.usuarioRepository.findOne({    //Buscamos si existe el usuario
        where: { Id: id },
      });
      if (!usuario) {
        throw new NotFoundException(`Usuario con ID:${id} no encontrado`);
      }
      if (updateUsuarioDto.IdCliente) {                     //Si existe IdRol lo busca si es existente
      const cliente = await this.clientesService.getOneCliente(Number(updateUsuarioDto.IdCliente))
      if (!cliente) throw new BadRequestException('Cliente Invalido');
      }
      if (updateUsuarioDto.Password) {
        updateUsuarioDto.Password = await bcrypt.hash(
          updateUsuarioDto.Password,
          10,
        );
      }

      await this.usuarioRepository.update(id, updateUsuarioDto);
      const newUser = await this.usuarioRepository.findOne({
        where: { Id: id },
      });
      if (!newUser) {
        throw new NotFoundException(`Usuario con ID:${id} no encontrado`);
      }
      const { Password: _, ...usuarioSinPassword } = newUser;
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Modulos',
        `Se actualizo el usuario: ${newUser.Nombre} con ID; ${newUser.Id}`,
        'UPDATE',
        `UPDATE Usuarios SET UserName='${newUser.UserName}', Telefono='${newUser.Telefono}', Nombre='${newUser.Nombre}', ApellidoPaterno='${newUser.ApellidoPaterno}', ApellidoMaterno='${newUser.ApellidoMaterno}', Estatus=${newUser.Estatus}, IdRol=${newUser.IdRol}, IdCliente=${newUser.IdCliente} WHERE Id=${id}`,
        Number(idUser),
      );
      return usuarioSinPassword;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al actualizar usuario',error
      });
    }
  }

  //Actualizar Estatus
  async updateUsuarioEstatus(
    id: number,
    updateUsuarioEstatusDto: UpdateUsuarioEstatusDto,
    idUser: string,
  ) {
    try {
      const usuario = await this.usuarioRepository.findOne({
        where: { Id: id },
      });
      if (!usuario) {
        throw new NotFoundException(`Usuario con ID:${id} no encontrado`);
      }
      const { Estatus } = updateUsuarioEstatusDto;

      await this.usuarioRepository.update(id, { Estatus });
      const usuarioResult = await this.usuarioRepository.findOne({
        where: { Id: id },
      });
      if (!usuarioResult) {
        throw new NotFoundException(`Usuario con ID:${id} no encontrado`);
      }
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Modulos',
        `Se cambio del modulo ${usuarioResult.Nombre} con id: ${id} a estatus: ${Estatus}`,
        'UPDATE',
        `UPDATE Modulos SET Estatus = ${Estatus} WHERE id = ${id}`,
        Number(idUser),
      );
      return { message: `Estatus actualizado correctamente a ${Estatus}` };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al actualizar estatus',
      });
    }
  }

  //Eliminamos usuario
  async deleteUsuario(id: number, idUser: string) {
    try {
      const usuario = await this.usuarioRepository.findOne({
        where: { Id: id },
      });
      if (!usuario) {
        throw new NotFoundException(`Usuario con ${id} no encontrado`);
      }
      await this.usuarioRepository.remove(usuario);
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Usuarios',
        `Se eliminó el usuario con ID: ${id}`,
        'DELETE',
        `DELETE FROM Usuarios WHERE Id=${id}`,
        Number(idUser),
      );
      return `Usuario con ${id} eliminado exitosamente`;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al eliminar el usuario');
    }
  }
}
