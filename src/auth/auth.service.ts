import { HttpException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuarios } from 'src/entities/Usuarios';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginAuthDto } from './dto/login-auth.dto';
import { UsuarioPermisos } from 'src/entities/UsuarioPermisos';

@Injectable()
export class AuthService {
  
  constructor(
    @InjectRepository(Usuarios)
    private readonly usuariosRepository: Repository<Usuarios>,
    private readonly jwtService: JwtService,
       @InjectRepository(UsuarioPermisos)
    private permisosRepository: Repository<UsuarioPermisos>
  ) {}
    
  async signIn(loginAuthDto: LoginAuthDto) {
    try {
      const user = await this.usuariosRepository.findOne({
        where: { userName: loginAuthDto.email },
      });
      console.log({data: user})
      if (
        !user ||
        !(await bcrypt.compare(loginAuthDto.password, user.password))
      ) {
        console.log({user: user, message: 'Entro a verificar los valores y no son iguales'})
        throw new UnauthorizedException('Credenciales invalidas');
      }

      const permisos = await this.permisosRepository.find({
        select: ['idPermiso'],
        where: { idUsuario: user.id },
      });

      const payload = { id: user.id, email: user.userName};
      return{ message: `login exitoso ${user.nombre}`,access_token: this.jwtService.sign(payload), permisos:permisos};
    } catch (error) {
      if ( error instanceof HttpException){
        throw error;
      }
      throw new InternalServerErrorException(error);
    }
  }
}
