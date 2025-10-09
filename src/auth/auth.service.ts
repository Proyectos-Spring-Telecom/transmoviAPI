import {
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

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuarios)
    private readonly usuariosRepository: Repository<Usuarios>,
    private readonly jwtService: JwtService,
    @InjectRepository(UsuariosPermisos)
    private permisosRepository: Repository<UsuariosPermisos>,
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
        rol: user.idRol
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
        idCliente:Number(`${user.idCliente}`),
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
        rol: user.idRol
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
        idCliente:Number(`${user.idCliente}`), 
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
}
