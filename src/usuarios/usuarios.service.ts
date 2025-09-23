//Servicio usuario
import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuarios } from 'src/entities/Usuarios';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UpdateUsuarioEstatusDto } from './dto/update-usuario-estatus.dto';
import * as bcrypt from 'bcrypt';
import moment from 'moment-timezone';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { ClientesService } from 'src/clientes/clientes.service';
import { UsuariosPermisos } from 'src/entities/UsuariosPermisos';
import { UpdateUsuarioOperadorDto } from './dto/update-usuario-operador.dto';
import { UpdateUsuarioContrasena } from './dto/update-usuario-contrasena.dto';
@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuarios)
    private readonly usuarioRepository: Repository<Usuarios>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly clientesService: ClientesService,
    @InjectRepository(UsuariosPermisos)
    private usuariosPermisosRepository: Repository<UsuariosPermisos>,
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
        FotoPerfil: u.fotoPerfil,
        FechaCreacion: u.fechaCreacion,
        FechaActualizacion: u.fechaActualizacion,
      }));

      const result: ApiResponseCommon = {
        data: dataFiltrada,
        paginated: {
          total: total,
          page,
          lastPage: Math.ceil(total / limit),
        },
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
      const usuarios = await this.usuarioRepository.find({
        where: { estatus: 1 },
      });
      if (usuarios.length === 0) {
        throw new NotFoundException('Usuarios no encontrados');
      }
      const usuariosSinPassword = usuarios.map(
        ({ passwordHash, ...rest }) => rest,
      );
      const result: ApiResponseCommon = {
        data: usuariosSinPassword,
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({ message: 'Error al obtener Usuarios' });
    }
  }

  //Obtener todos los usuarios por rol
  async getAllListUsuariosRol(): Promise<ApiResponseCommon> {
    try {
      const usuarios = await this.usuarioRepository.find({
        where: { estatus: 1, idRol: 3 },
      });
      if (usuarios.length === 0) {
        throw new NotFoundException('Usuarios no encontrados');
      }
      const usuariosSinPassword = usuarios.map(
        ({ passwordHash, ...rest }) => rest,
      );
      const result: ApiResponseCommon = {
        data: usuariosSinPassword,
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({ message: 'Error al obtener Usuarios' });
    }
  }

    //Obtener todos los usuarios por cliente
  async getAllListUsuariosCliente(id:number): Promise<ApiResponseCommon> {
    try {
      const usuarios = await this.usuarioRepository.find({
        where: { estatus: 1, idCliente: id },
      });
      if (usuarios.length === 0) {
        throw new NotFoundException('Usuarios no encontrados');
      }
      const usuariosSinPassword = usuarios.map(
        ({ passwordHash, ...rest }) => rest,
      );
      const result: ApiResponseCommon = {
        data: usuariosSinPassword,
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
      const { passwordHash: _, ...usuario } = user;
      const permiso = await this.usuariosPermisosRepository.find({
        where: { idUsuario: id, estatus: 1 },
      });
      return { data: { usuario, permiso } };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al obtener Usuario',
      });
    }
  }

  //Creacion de pin operador
  async createPin(
    userName: string,
    idUser: string,
    updateUsuarioOperadorDto: UpdateUsuarioOperadorDto,
  ): Promise<ApiCrudResponse> {
    try {
      //Buscamos al usuario
      const usuario = await this.usuarioRepository.findOne({
        where: { userName: userName, id: Number(idUser) },
      });
      console.log('entro en service usuario', usuario);
      if (!usuario) {
        throw new NotFoundException(`Usuario con ID:${userName} no encontrado`);
      }

      if (updateUsuarioOperadorDto.userName !== usuario.userName)
        throw new BadRequestException('Datos invalidas');

      //encriptamos la contraseña
      const pinPassword = await bcrypt.hash(
        updateUsuarioOperadorDto.pinHash,
        10,
      );
      updateUsuarioOperadorDto.pinHash = pinPassword;

      //Agregamos le fecha de la actualizacion
      const FechaActual = moment()
        .utcOffset(-12)
        .format('YYYY-MM-DD HH:mm:ss');
      updateUsuarioOperadorDto.actualizacionPin = FechaActual;

      //Agregamos el pin al updateUsuarioOperadorDto
      const newPin = await this.usuarioRepository.update(
        usuario.id,
        updateUsuarioOperadorDto,
      );

      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Usuarios',
        `Se creó el PIN del usuario con nombre: ${usuario.nombre}`,
        'UPDATE',
        `UPDATE INTO Usuarios (...) VALUES (...) -> username:  ${usuario.userName} nombre: ${usuario.nombre} apellido paterno: ${usuario.apellidoPaterno} apellido materno: ${usuario.apellidoMaterno}`,
        Number(idUser),
        2,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Pin creado correctamente',
        data: {
          id: Number(usuario.id),
          nombre: `${usuario.nombre} ${usuario.apellidoPaterno} ` || '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al crear pin del usuario',
        error,
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

      const newUser = await this.usuarioRepository.create(createUsuarioDto);

      const userSave = await this.usuarioRepository.save(newUser); //creamos el usuario
      console.log(newUser.id);

      if (createUsuarioDto.permisosIds.length > 0) {
        const usuariosPermisos = createUsuarioDto.permisosIds.map((permisoId) =>
          this.usuariosPermisosRepository.create({
            idUsuario: userSave.id,
            idPermiso: permisoId,
          }),
        );

        await this.usuariosPermisosRepository.save(usuariosPermisos);
      }

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
          id: Number(usuarioSinPassword.id),
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

  //Actualizar contraseña
  async updateContrasena(
    id: number,
    idUser: string,
    updateUsuarioContrasena: UpdateUsuarioContrasena,
  ) {
    try {
      const usuario = await this.usuarioRepository.findOne({
        where: { id: id },
      });
      if (!usuario) {
        throw new NotFoundException(`Usuario con ID:${id} no encontrado`);
      }
      if (
        updateUsuarioContrasena.passwordNueva ===
        updateUsuarioContrasena.passwordNuevaConfirmacion
      ) {
        if (
          !usuario ||
          !(await bcrypt.compare(
            updateUsuarioContrasena.passwordActual,
            usuario.passwordHash,
          ))
        ) {
          console.log({
            user: usuario,
            message: 'Entro a verificar los valores y no son iguales',
          });
          throw new UnauthorizedException('Credenciales invalidas');
        }
        const hashedPassword = await bcrypt.hash(
          updateUsuarioContrasena.passwordNueva,
          10,
        ); //encriptamos la contraseña
        updateUsuarioContrasena.passwordNueva = hashedPassword;
      }
      //Agregamos le fecha de la actualizacion
      const FechaActual = moment()
        .utcOffset(-12)
        .format('YYYY-MM-DD HH:mm:ss');

      //actualiza en usuario contraseña
      await this.usuarioRepository.update(id, {
        passwordHash: updateUsuarioContrasena.passwordNueva,
      });

      await this.usuarioRepository.update(id, {
        actualizacionPassword: FechaActual,
      });

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Contraseña actualizada correctamente',
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
      throw new InternalServerErrorException({
        message: 'Error al actualizar contraseña',
        error,
      });
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
        where: { id: id },
      });
      if (!usuario) {
        throw new NotFoundException(`Usuario con ID:${id} no encontrado`);
      }

      if (updateUsuarioDto.idCliente) {
        const cliente = await this.clientesService.getOneCliente(
          Number(updateUsuarioDto.idCliente),
        );
        if (!cliente) throw new BadRequestException('Cliente Invalido');
      }

      const { permisosIds, ...usuarioUpdate } = updateUsuarioDto;
      // ----- ACTUALIZACIÓN DE USUARIO -----
      await this.usuarioRepository.update(id, usuarioUpdate);
      const newUser = await this.usuarioRepository.findOne({
        where: { id: id },
      });
      if (!newUser) {
        throw new NotFoundException(`Usuario con ID:${id} no encontrado`);
      }
      const { passwordHash: _, ...usuarioSinPassword } = newUser;

      // ----- ACTUALIZACIÓN DE PERMISOS -----
      if (
        updateUsuarioDto.permisosIds &&
        Array.isArray(updateUsuarioDto.permisosIds)
      ) {
        const nuevaLista: number[] = updateUsuarioDto.permisosIds.map(Number); // lista nueva de permisos (ej. [1,2,3])

        // Permisos actuales en BD
        const creadaLista = await this.usuariosPermisosRepository.find({
          where: { idUsuario: id },
        });

        const nuevaSet = new Set<number>(nuevaLista);
        const creadaMap = new Map<number, any>(
          creadaLista.map((p) => [Number(p.idPermiso), p] as const),
        );
        // Unimos todos los ids (de la nueva lista y de la creada)
        const todosIds = new Set<number>([
          ...nuevaSet,
          ...creadaLista.map((p) => Number(p.idPermiso)),
        ]);

        for (const permisoId of todosIds) {
          const enNueva = nuevaSet.has(permisoId);
          const creado = creadaMap.get(permisoId);
          if (enNueva && creado) {
            if (creado.estatus === 0) {
              // Caso: existe en ambas y en creada estatus=0 → activar
              await this.usuariosPermisosRepository.update(creado.id, {
                estatus: 1,
              });
            } else {
              // Caso: existe en ambas y ya está activo → no hacer nada
              continue;
            }
          } else if (enNueva && !creado) {
            // Caso: existe en nueva pero no en creada → crear

            const existe = await this.usuariosPermisosRepository.findOne({
              where: { idUsuario: id, idPermiso: permisoId },
            });
            if (!existe) {
              await this.usuariosPermisosRepository.save({
                idUsuario: id,
                idPermiso: permisoId,
                estatus: 1,
              });
            }
          } else if (!enNueva && creado) {
            if (creado.estatus === 1) {
              // Caso: no está en nueva pero sí en creada activo → desactivar
              await this.usuariosPermisosRepository.update(creado.id, {
                estatus: 0,
              });
            } else {
              // Caso: ya estaba inactivo → nada que hacer
              continue;
            }
          } else {
            // Caso: no existe ni en nueva ni en creada → nada que hacer
            continue;
          }
        }
      }

      // ----- Registro en la bitácora -----
      await this.bitacoraLogger.logToBitacora(
        'Usuarios',
        `Se actualizó el usuario: ${newUser.nombre} con ID: ${newUser.id}`,
        'UPDATE',
        `UPDATE Usuarios SET UserName='${newUser.userName}', Telefono='${newUser.telefono}', Nombre='${newUser.nombre}', ApellidoPaterno='${newUser.apellidoPaterno}', ApellidoMaterno='${newUser.apellidoMaterno}', Estatus=${newUser.estatus}, IdRol=${newUser.idRol}, IdCliente=${newUser.idCliente} WHERE Id=${id}`,
        Number(idUser),
        2,
      );

      // ----- Api response -----
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Usuario actualizado correctamente',
        data: {
          id: id,
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
      //Se hacer eliminado logico
      //Cambiamos el estatus del usuario a 0
      await this.usuarioRepository.update(id, { estatus: 0 });

      //buscamos sus permisos
      const permisos = await this.usuariosPermisosRepository.find({
        where: { idUsuario: id },
      });

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
          id: id,
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
