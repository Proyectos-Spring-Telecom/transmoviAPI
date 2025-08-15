import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuarios } from 'src/entities/Usuarios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports:[
    ConfigModule,
    JwtModule.registerAsync({
      imports:[ConfigModule],
      inject:[ConfigService],
      useFactory:(config: ConfigService)=>({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {expiresIn: config.get<string>('JWT_EXPIRES_IN')}
      })
    }),
    TypeOrmModule.forFeature([Usuarios]),],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
