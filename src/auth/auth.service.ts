import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuarios } from 'src/entities/Usuarios';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginAuthDto } from './dto/login-auth.dto';
import { UsuariosPermisos } from 'src/entities/UsuariosPermisos';
import { LoginAuthPinDto } from './dto/login-pin.dto';
import { MailService } from 'src/mail/mail.service';
import { LoginAuthConfirmacionDto } from './dto/login-confirmacion.dto';
import { LoginAuthResetDto } from './dto/login-recuperacion.dto';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { EstatusEnumBitcora } from 'src/common/ApiResponse';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuarios)
    private readonly usuariosRepository: Repository<Usuarios>,
    private readonly jwtService: JwtService,
    @InjectRepository(UsuariosPermisos)
    private permisosRepository: Repository<UsuariosPermisos>,
    private readonly emailService: MailService,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  async singInPin(loginAuthPin: LoginAuthPinDto) {
    try {
      const user = await this.usuariosRepository.findOne({
        relations: ['idRol2'],
        where: {
          userName: loginAuthPin.userName,
          dispositivoId: loginAuthPin.dispositivoId,
          estatus: 1,
        },
      });
      console.log({ data: user });
      if (
        !user ||
        !user.pinHash ||
        !(await bcrypt.compare(loginAuthPin.pinHash, user.pinHash))
      ) {
        throw new UnauthorizedException('Credenciales invalidas');
      }
      const permisos = await this.permisosRepository.find({
        select: ['idPermiso'],
        where: { idUsuario: user.id, estatus: 1 },
      });

      const payload = {
        id: user.id,
        email: user.userName,
        cliente: user.idCliente,
        rol: user.idRol,
      };

      function pad(n: number) {
        return n < 10 ? '0' + n : n;
      }
      const ahora = new Date();
      const fechaActual = `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())} ${pad(ahora.getHours())}:${pad(ahora.getMinutes())}:${pad(ahora.getSeconds())}`;
      console.log(fechaActual);

      await this.usuariosRepository.update(user.id, {
        ultimoLogin: fechaActual,
      });
      return {
        message: `login exitoso`,
        id: Number(`${user.id}`),
        idCliente: Number(`${user.idCliente}`),
        nombre: `${user.nombre}`,
        apellidoPaterno: `${user.apellidoPaterno}`,
        apellidoMaterno: `${user.apellidoMaterno}`,
        telefono: `${user.telefono}`,
        ultimoLogin: `${user.ultimoLogin}`,
        fechaCreacion: `${user.fechaCreacion}`,
        fotoPerfil: `${user.fotoPerfil}`,
        userName: `${user.userName}`,
        rol: user.idRol2,
        token: this.jwtService.sign(payload),
        permisos: permisos,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(error);
    }
  }

  async signIn(loginAuthDto: LoginAuthDto) {
    try {
      const user = await this.usuariosRepository.findOne({
        relations: ['idRol2'],
        where: { userName: loginAuthDto.userName, estatus: 1 },
      });
      console.log({ data: user });
      if (
        !user ||
        !(await bcrypt.compare(loginAuthDto.password, user.passwordHash))
      ) {
        console.log({
          user: user,
          message: 'Entro a verificar los valores y no son iguales',
        });
        throw new UnauthorizedException('Credenciales invalidas');
      }

      const permisos = await this.permisosRepository.find({
        select: ['idPermiso'],
        where: { idUsuario: user.id, estatus: 1 },
      });

      const payload = {
        id: user.id,
        email: user.userName,
        cliente: user.idCliente,
        rol: user.idRol,
      };

      function pad(n: number) {
        return n < 10 ? '0' + n : n;
      }
      const ahora = new Date();
      const fechaActual = `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())} ${pad(ahora.getHours())}:${pad(ahora.getMinutes())}:${pad(ahora.getSeconds())}`;
      console.log(fechaActual);

      await this.usuariosRepository.update(user.id, {
        ultimoLogin: fechaActual,
      });
      return {
        message: `login exitoso`,
        id: Number(`${user.id}`),
        idCliente: Number(`${user.idCliente}`),
        nombre: `${user.nombre}`,
        apellidoPaterno: `${user.apellidoPaterno}`,
        apellidoMaterno: `${user.apellidoMaterno}`,
        telefono: `${user.telefono}`,
        ultimoLogin: `${user.ultimoLogin}`,
        fechaCreacion: `${user.fechaCreacion}`,
        fotoPerfil: `${user.fotoPerfil}`,
        userName: `${user.userName}`,
        rol: user.idRol2,
        token: this.jwtService.sign(payload),
        permisos: permisos,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(error);
    }
  }

  //confirmacion de correo
  async verifyUser(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      const user = await this.usuariosRepository.findOne({
        where: { id: payload.id, userName: payload.email },
      });
      if (!user) throw new BadRequestException('Usuario no encontrado');
      await this.usuariosRepository.update(user.id, { emailConfirmado: 1 });
      console.log(`Se verifico el usuario: ${payload.email}`);

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { id: user.id, EmailConfirmado: 1 };
      await this.bitacoraLogger.logToBitacora(
        'Usuarios',
        `Se verifico un usuarios con nombre: ${user.nombre}`,
        'CREATE',
        querylogger,
        Number(user.id),
        2,
        EstatusEnumBitcora.SUCCESS,
      );

      return `La verificación del usuario ${user.nombre} se ha completado con éxito.
Muchas gracias por su preferencia.`;
    } catch (error) {
      const payload = this.jwtService.verify(token);
      //-----Registro en la bitacora----- ERROR
      const querylogger = { id: payload.id, EmailConfirmado: 1 };
      await this.bitacoraLogger.logToBitacora(
        'Usuarios',
        `Se verifico un usuarios con ID: ${payload.id}`,
        'CREATE',
        querylogger,
        Number(payload.id),
        2,
        EstatusEnumBitcora.ERROR,
        error.message,
      );

      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException(
          'Este enlace de autenticación ya no es válido. Los enlaces generados para autenticación tienen un tiempo de validez limitado. Le recomendamos generar uno nuevo para completar su acceso.',
        );
      } else if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Token inválido');
      }
      throw new UnauthorizedException('Error al verificar el usuario');
    }
  }

  //enviar correo para recuperar contraseña
  async recuperarContrasena(
    loginAuthConfirmacionDto: LoginAuthConfirmacionDto,
  ) {
    try {
      const user = await this.usuariosRepository.findOne({
        where: { userName: loginAuthConfirmacionDto.userName },
      });
      if (!user) throw new BadRequestException('Usuario no encontrado');

      const payload = {
        id: user.id,
        email: user.userName,
      };
      const token = this.jwtService.sign(payload, {
        expiresIn: `${process.env.JWT_CONFIRMACION}`,
      });
      const name = `${user.nombre} ${user.apellidoPaterno} ${user.apellidoMaterno}`;
      await this.emailService.sendResetPasswordEmail(
        user.userName,
        name,
        token,
      );
      return token;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException({
        message: 'Ocurrió un error al recuperar contraseña del usuario.',
        error: error.message,
      });
    }
  }

  //recuperar la confirmacion de correo
  async recuperarConfirmacion(
    loginAuthConfirmacionDto: LoginAuthConfirmacionDto,
  ) {
    try {
      const user = await this.usuariosRepository.findOne({
        where: { userName: loginAuthConfirmacionDto.userName },
      });
      if (!user) throw new BadRequestException('Usuario no encontrado');

      const payload = {
        id: user.id,
        email: user.userName,
      };
      const token = this.jwtService.sign(payload, {
        expiresIn: `${process.env.JWT_CONFIRMACION}`,
      });
      const name = `${user.nombre} ${user.apellidoPaterno} ${user.apellidoMaterno}`;
      await this.emailService.sendConfirmationEmail(user.userName, name, token);
      return token;
    } catch (error) {
      throw new InternalServerErrorException({
        message: 'Ocurrió un error al confirmar el usuario.',
        error: error.message,
      });
    }
  }

  //actualizar contraseña
  async resetPassword(loginAuthResetDto: LoginAuthResetDto) {
    try {
      const user = await this.usuariosRepository.findOne({
        where: { userName: loginAuthResetDto.userName },
      });
      if (!user) throw new BadRequestException('Usuario no encontrado');

      const hashedPassword = await bcrypt.hash(loginAuthResetDto.password, 10); //encriptamos la contraseña
      loginAuthResetDto.password = hashedPassword;
      await this.usuariosRepository.update(user.id, {
        passwordHash: hashedPassword,
      });
      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { id: user.id, EmailConfirmado: 1 };
      await this.bitacoraLogger.logToBitacora(
        'Usuarios',
        `Se actualizo la contraseña del usuarios con ID: ${user.id}`,
        'CREATE',
        querylogger,
        Number(user.id),
        2,
        EstatusEnumBitcora.SUCCESS,
      );
      return `La contraseña del usuario ${user.nombre} ha sido actualizada exitosamente.`;
    } catch (error) {
      throw new InternalServerErrorException({
        message: 'Ocurrió un error al actualizar contraseña del usuario.',
        error: error.message,
      });
    }
  }
}
