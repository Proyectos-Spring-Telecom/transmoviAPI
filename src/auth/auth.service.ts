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
import moment from 'moment-timezone';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuarios)
    private readonly usuariosRepository: Repository<Usuarios>,
    private readonly jwtService: JwtService,
    @InjectRepository(UsuariosPermisos)
    private permisosRepository: Repository<UsuariosPermisos>,
  ) {}

  async signIn(loginAuthDto: LoginAuthDto) {
    try {
      const user = await this.usuariosRepository.findOne({
        relations: ['idRol2'],
        where: { userName: loginAuthDto.userName },
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
        where: { idUsuario: user.id },
      });

      const payload = { id: user.id, email: user.userName };

      const ultimoLogin = moment()
        .tz('America/Mexico_City')
        .format('YYYY-MM-DD HH:mm:ss');
      await this.usuariosRepository.update(user.id,{ultimoLogin:ultimoLogin})

      return {
        message: `login exitoso`,
        nombre: `${user.nombre}`,
        apellidoPaterno: `${user.apellidoPaterno}`,
        apellidoMaterno: `${user.apellidoMaterno}`,
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
