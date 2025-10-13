import { Controller, Post, Body, HttpCode, Get, Query, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginAuthDto } from './dto/login-auth.dto';
import { LoginAuthPinDto } from './dto/login-pin.dto';
import { LoginAuthConfirmacionDto } from './dto/login-confirmacion.dto';
import { LoginAuthResetDto } from './dto/login-recuperacion.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';

@Controller('login')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('verify')
  async verifyUser(@Query('token') token: string) {
    return await this.authService.verifyUser(token);
  }

  // ========================================
  // 🔹 POST ROUTES - Rutas específicas primero
  // ========================================

  @Post('usuario/recuperar/acceso')
  async email(@Body() loginAuthConfirmacionDto: LoginAuthConfirmacionDto) {
    return await this.authService.recuperarContrasena(loginAuthConfirmacionDto);
  }

  @Post('recuperar/confirmacion')
  async recuperacionConfirmacion(
    @Body() loginAuthConfirmacionDto: LoginAuthConfirmacionDto,
  ) {
    return await this.authService.recuperarConfirmacion(
      loginAuthConfirmacionDto,
    );
  }

  @Post('cambiar/accesso')
  @UseGuards(JwtAuthGuard)
  async resetPassword(@Body() loginAuthResetDto: LoginAuthResetDto) {
    return await this.authService.resetPassword(loginAuthResetDto);
  }

  @Post('operador')
  async loginPin(@Body() loginAuthPinDto: LoginAuthPinDto) {
    return this.authService.singInPin(loginAuthPinDto);
  }

  @Post()
  async login(@Body() loginAuthDto: LoginAuthDto) {
    return this.authService.signIn(loginAuthDto);
  }
}
