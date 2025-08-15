import { HttpException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuarios } from 'src/entities/Usuarios';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginAuthDto } from './dto/login-auth.dto';

@Injectable()
export class AuthService {
  
  constructor(
    @InjectRepository(Usuarios)
    private readonly usuariosRepository: Repository<Usuarios>,
    private readonly jwtService: JwtService,
  ) {}
    
  async signIn(loginAuthDto: LoginAuthDto) {
    try {
      const user = await this.usuariosRepository.findOne({
        where: { userName: loginAuthDto.email },
      });

      if (
        !user ||
        !(await bcrypt.compare(loginAuthDto.password, user.password))
      ) {
        throw new UnauthorizedException('Credenciales invalidas');
      }

      const payload = { id: user.id, email: user.userName};
      return{ message: `login exitoso ${user.nombre}`,access_token: this.jwtService.sign(payload)};
    } catch (error) {
      if ( error instanceof HttpException){
        throw error;
      }
      throw new InternalServerErrorException(error);
    }
  }
}
