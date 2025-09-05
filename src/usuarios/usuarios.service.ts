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
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { ClientesService } from 'src/clientes/clientes.service';
import { UsuariosPermisos } from 'src/entities/UsuariosPermisos';
@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuarios)
    private readonly usuarioRepository: Repository<Usuarios>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly clientesService: ClientesService,
    @InjectRepository(UsuariosPermisos)
    private permisosRepository: Repository<UsuariosPermisos>,
  ) {}
  // Obtener todos los usuarios con paginación
  async getAllUsuario(page: number, limit: number): Promise<ApiResponseCommon> {
    try {
      const [data, total] = await this.usuarioRepository.findAndCount({
        relations: ['idCliente2', 'idRol2'],
        skip: (page - 1) * limit,
        take: limit,
      });

      const dataFiltrada = data.map((u) => ({
        Id: u.id,
        UserName: u.userName,
        EmailConfirmado: u.emailConfirmado,
        Telefono: u.telefono,
        Nombre: u.nombre,
        ApellidoPaterno: u.apellidoPaterno,
        ApellidoMaterno: u.apellidoMaterno,
        Estatus: u.estatus,
        IdRol: u.idRol,
        RolNombre: u.idRol2?.nombre || null, // solo nombre del rol
        IdCliente: u.idCliente,
        ClienteNombre: u.idCliente2?.nombre || null, // solo nombre del cliente
        UltimoLogin: u.ultimoLogin,
        ActualizacionPassword: u.actualizacionPassword,
        ActualizacionPin: u.actualizacionPin,
        DispositivoId: u.dispositivoId,
        FechaCreacion: u.fechaCreacion,
        FechaActualizacion: u.fechaActualizacion,
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
      throw new BadRequestException(
        error.message || 'Error al obtener usuarios',
      );
    }
  }

  //Obtener todos los usuarios
  async getAllListUsuarios(): Promise<ApiResponseCommon> {
    try {
      const usuarios = await this.usuarioRepository.find();
      if (usuarios.length === 0) {
        throw new NotFoundException('Usuarios no encontrados');
      }
      const usuariosSinPassword = usuarios.map(
        ({ passwordHash, ...rest }) => rest,
      );
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
      const user = await this.usuarioRepository.findOne({
        where: { id: id },
      });
      if (!user) {
        throw new NotFoundException(`Usuario con ID:${id} no encontrado`);
      }
      //Falta el apartado de la bitacora
      const { passwordHash: _, ...usuarioSinPassword } = user;
      return { usuarioSinPassword };
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
  async createUsuario(
    createUsuarioDto: CreateUsuarioDto,
    idUser: string,
  ): Promise<ApiCrudResponse> {
    try {
      const existUsuario = await this.usuarioRepository.findOne({
        //Buscamos si existe usuario
        where: { userName: createUsuarioDto.userName },
      });
      if (existUsuario) {
        throw new BadRequestException('El usuario ya existe');
      }
      const cliente = await this.clientesService.getOneCliente(
        //Buscamos si existe el cliente
        createUsuarioDto.idCliente,
      );
      if (!cliente) throw new BadRequestException('Cliente Invalido');


      const hashedPassword = await bcrypt.hash(
        createUsuarioDto.passwordHash,
        10,
      ); //encriptamos la contraseña
      createUsuarioDto.passwordHash = hashedPassword;

      const newUser = this.usuarioRepository.create(createUsuarioDto);

      await this.usuarioRepository.save(newUser); //creamos el usuario

      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Usuarios',
        `Se creó un usuarios con nombre: ${createUsuarioDto.nombre}`,
        'CREATE',
        `INSERT INTO Usuarios (...) VALUES (...) -> username:  ${createUsuarioDto.userName} nombre: ${createUsuarioDto.nombre} apellido paterno: ${createUsuarioDto.apellidoPaterno} apellido materno: ${createUsuarioDto.apellidoMaterno}`,
        Number(idUser),
        2,
      );
      const { passwordHash: _, ...usuarioSinPassword } = newUser;

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Usuario creado correctamente',
        data: {
          id: usuarioSinPassword.id,
          nombre:
            `${usuarioSinPassword.nombre} ${usuarioSinPassword.apellidoPaterno} ` ||
            '',
        },
      };
      return result;
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
  ): Promise<ApiCrudResponse> {
    try {
      const usuario = await this.usuarioRepository.findOne({
        //Buscamos si existe el usuario
        where: { id: id },
      });
      if (!usuario) {
        throw new NotFoundException(`Usuario con ID:${id} no encontrado`);
      }
      if (updateUsuarioDto.idCliente) {
        //Si existe IdRol lo busca si es existente
        const cliente = await this.clientesService.getOneCliente(
          Number(updateUsuarioDto.idCliente),
        );
        if (!cliente) throw new BadRequestException('Cliente Invalido');
      }
      if (updateUsuarioDto.passwordHash) {
        updateUsuarioDto.passwordHash = await bcrypt.hash(
          updateUsuarioDto.passwordHash,
          10,
        );
      }
      //*-*-*-*-*-*-*-*-*-*-*-**-*-*-*-*-*--*

      await this.usuarioRepository.update(id, updateUsuarioDto);
      const newUser = await this.usuarioRepository.findOne({
        where: { id: id },
      });
      if (!newUser) {
        throw new NotFoundException(`Usuario con ID:${id} no encontrado`);
      }
      const { passwordHash: _, ...usuarioSinPassword } = newUser;
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Usuarios',
        `Se actualizo el usuario: ${newUser.nombre} con ID; ${newUser.id}`,
        'UPDATE',
        `UPDATE Usuarios SET UserName='${newUser.userName}', Telefono='${newUser.telefono}', Nombre='${newUser.nombre}', ApellidoPaterno='${newUser.apellidoPaterno}', ApellidoMaterno='${newUser.apellidoMaterno}', Estatus=${newUser.estatus}, IdRol=${newUser.idRol}, IdCliente=${newUser.idCliente} WHERE Id=${id}`,
        Number(idUser),
        2,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Usuario actualizado correctamente',
        data: {
          id: usuarioSinPassword.id,
          nombre:
            `${usuarioSinPassword.nombre} ${usuarioSinPassword.apellidoPaterno} ` ||
            '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al actualizar usuario',
        error,
      });
    }
  }

  //Actualizar Estatus
  async updateUsuarioEstatus(
    id: number,
    updateUsuarioEstatusDto: UpdateUsuarioEstatusDto,
    idUser: string,
  ): Promise<ApiCrudResponse> {
    try {
      const usuario = await this.usuarioRepository.findOne({
        where: { id: id },
      });
      if (!usuario) {
        throw new NotFoundException(`Usuario con ID:${id} no encontrado`);
      }
      const { estatus } = updateUsuarioEstatusDto;

      await this.usuarioRepository.update(id, { estatus: estatus });
      const usuarioResult = await this.usuarioRepository.findOne({
        where: { id: id },
      });
      if (!usuarioResult) {
        throw new NotFoundException(`Usuario con ID:${id} no encontrado`);
      }
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Usuarios',
        `Se cambio estatus del usuario ${usuarioResult.nombre} con id: ${id} a estatus: ${estatus}`,
        'UPDATE',
        `UPDATE Usuarios SET Estatus = ${estatus} WHERE id = ${id}`,
        Number(idUser),
        2,
      );
      //Api Response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Estatus usuario actualizado correctamente',
        estatus: {
          estatus: estatus,
        },
        data: {
          id: id,
          nombre:
            `${usuarioResult.nombre} ${usuarioResult.apellidoPaterno} ` || '',
        },
      };
      return result;
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
  async deleteUsuario(id: number, idUser: string): Promise<ApiCrudResponse> {
    try {
      const usuario = await this.usuarioRepository.findOne({
        where: { id: id },
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
        2,
      );
      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Usuario eliminado correctamente',
        data: {
          id: usuario.id,
          nombre: `${usuario.nombre} ${usuario.apellidoPaterno} ` || '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al eliminar el usuario');
    }
  }
}
