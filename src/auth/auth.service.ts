import { Injectable } from '@nestjs/common';
import { LoginAuthDto } from './dto/login-auth.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {

  async signIn(loginAuthDto: LoginAuthDto) {
    return `This action returns all auth`;
  }


}
