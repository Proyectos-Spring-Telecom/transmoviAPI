import {
  Controller,
  Post,
  Body,
  HttpCode,
  Get,
  Query,
  UseGuards,
  Patch,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginAuthDto } from './dto/login-auth.dto';
import { LoginAuthPinDto } from './dto/login-pin.dto';
import { LoginAuthConfirmacionDto } from './dto/login-confirmacion.dto';
import { LoginAuthResetDto } from './dto/login-recuperacion.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { CodigoPasajeroAutenticacion } from './dto/login-autenticacion.dto';
import { CreateAltaPasajaroDto } from './dto/create-pasajero.dto';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('Autenticación')
@ApiBearerAuth('bearer-token')
@Controller('login')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Inicio de sesión con correo y contraseña.
   * Para usuarios administrativos (administrador, cliente, reportes, etc.).
   */
  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Login con usuario y contraseña',
    description:
      'Autentica usuarios por correo electrónico y contraseña. Devuelve token JWT y datos del usuario (nombre, cliente, rol, permisos). Requiere que el usuario tenga email confirmado y estatus activo.',
  })
  @ApiBody({
    type: LoginAuthDto,
    description: 'Credenciales de acceso',
    examples: {
      ejemplo: {
        value: { userName: 'usuario@ejemplo.com', password: 'MiContraseña123' },
        summary: 'Credenciales de ejemplo',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Login exitoso. Retorna token y datos del usuario.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'login exitoso' },
        id: { type: 'number', description: 'ID del usuario' },
        nombre: { type: 'string' },
        apellidoPaterno: { type: 'string' },
        apellidoMaterno: { type: 'string' },
        idCliente: { type: 'number' },
        nombreCliente: { type: 'string' },
        logotipo: { type: 'string' },
        telefono: { type: 'string' },
        ultimoLogin: { type: 'string' },
        fechaCreacion: { type: 'string' },
        fotoPerfil: { type: 'string' },
        userName: { type: 'string' },
        token: { type: 'string', description: 'JWT para usar en Authorization header' },
        permisos: { type: 'array', items: { type: 'object' } },
        rol: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async login(@Body() loginAuthDto: LoginAuthDto) {
    return this.authService.signIn(loginAuthDto);
  }

  /**
   * Login de operadores usando correo, PIN y dispositivo.
   */
  @Post('operador/login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Login de operador con PIN',
    description:
      'Autentica operadores con correo, PIN de 6 u 8 dígitos y deviceId. El PIN no puede ser consecutivo ni todos los dígitos iguales. Retorna token, datos del operador y licencias.',
  })
  @ApiBody({
    type: LoginAuthPinDto,
    description: 'Credenciales del operador',
    examples: {
      ejemplo: {
        value: {
          userName: 'operador@ejemplo.com',
          pinHash: '482915',
          deviceId: '15aBW',
        },
        summary: 'Credenciales de operador',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Login exitoso. Retorna token, datos del operador y licencias.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'login exitoso' },
        id: { type: 'number' },
        nombre: { type: 'string' },
        apellidoPaterno: { type: 'string' },
        apellidoMaterno: { type: 'string' },
        idCliente: { type: 'number' },
        nombreCliente: { type: 'string' },
        logotipo: { type: 'string' },
        telefono: { type: 'string' },
        token: { type: 'string', description: 'JWT para Authorization header' },
        pinExist: { type: 'number', description: '1 si tiene PIN, 0 si no' },
        Licencias: { type: 'array' },
        permisos: { type: 'array' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  @ApiResponse({ status: 404, description: 'Operador no encontrado' })
  async loginPin(@Body() loginAuthPinDto: LoginAuthPinDto) {
    return this.authService.singInPin(loginAuthPinDto);
  }

  /**
   * Solicitar recuperación de contraseña.
   * Envía un correo con el código para restablecer.
   */
  @Post('usuario/recuperar/acceso')
  @ApiOperation({
    summary: 'Solicitar recuperación de contraseña',
    description:
      'Envía un correo al usuario con un código para restablecer su contraseña. El usuario debe existir en el sistema.',
  })
  @ApiBody({
    type: LoginAuthConfirmacionDto,
    description: 'Correo del usuario que olvidó su contraseña',
    examples: {
      ejemplo: { value: { userName: 'usuario@ejemplo.com' }, summary: 'Correo' },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Correo enviado correctamente',
    schema: {
      type: 'string',
      example: 'Se ha enviado un correo con el codigo.',
    },
  })
  @ApiResponse({ status: 400, description: 'Usuario no encontrado' })
  async email(@Body() loginAuthConfirmacionDto: LoginAuthConfirmacionDto) {
    return await this.authService.recuperarContrasena(loginAuthConfirmacionDto);
  }

  /**
   * Solicitar código de confirmación de correo.
   * Para usuarios que aún no han verificado su cuenta.
   */
  @Post('recuperar/confirmacion')
  @ApiOperation({
    summary: 'Solicitar código de confirmación de correo',
    description:
      'Envía un correo con el código de autenticación para confirmar el correo electrónico del usuario.',
  })
  @ApiBody({
    type: LoginAuthConfirmacionDto,
    description: 'Correo del usuario',
    examples: {
      ejemplo: { value: { userName: 'usuario@ejemplo.com' }, summary: 'Correo' },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Correo enviado correctamente',
    schema: {
      type: 'string',
      example: 'Se ha enviado un correo con el codigo de autenticación.',
    },
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async recuperacionConfirmacion(
    @Body() loginAuthConfirmacionDto: LoginAuthConfirmacionDto,
  ) {
    return await this.authService.recuperarConfirmacion(
      loginAuthConfirmacionDto,
    );
  }

  /**
   * Registro de nuevo pasajero (afiliación).
   * Crea usuario, pasajero y asocia monedero.
   */
  @Post('pasajero/registro')
  @ApiOperation({
    summary: 'Registro de pasajero (afiliación)',
    description:
      'Registra un nuevo pasajero en el sistema. Crea el usuario para inicio de sesión, el pasajero y lo asocia al monedero indicado. Envía correo de confirmación. El monedero no debe estar ligado a otro pasajero.',
  })
  @ApiBody({ type: CreateAltaPasajaroDto })
  @ApiResponse({
    status: 201,
    description: 'Pasajero registrado. Se envió correo de confirmación.',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        message: { type: 'string' },
        data: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Monedero ya ligado o usuario ya existe' })
  async createPasajero(@Body() createAltaPasajaroDto: CreateAltaPasajaroDto) {
    return this.authService.createPasajero(createAltaPasajaroDto);
  }

  /**
   * Cambiar contraseña (requiere token JWT).
   */
  @Post('cambiar/accesso')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Cambiar contraseña',
    description: 'Actualiza la contraseña del usuario. Requiere autenticación con token Bearer.',
  })
  @ApiBody({
    type: LoginAuthResetDto,
    description: 'Usuario y nueva contraseña',
    examples: {
      ejemplo: {
        value: {
          userName: 'usuario@ejemplo.com',
          password: 'NuevaContraseña123',
        },
        summary: 'Cambio de contraseña',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Contraseña actualizada exitosamente',
    schema: {
      type: 'string',
      example: 'La contraseña del usuario Juan ha sido actualizada exitosamente.',
    },
  })
  @ApiResponse({ status: 400, description: 'Usuario no encontrado' })
  @ApiResponse({ status: 401, description: 'Token inválido o expirado' })
  async resetPassword(@Body() loginAuthResetDto: LoginAuthResetDto) {
    return await this.authService.resetPassword(loginAuthResetDto);
  }

  /**
   * Verificar código de autenticación enviado por correo.
   */
  @Patch('verify')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verificar código de autenticación',
    description:
      'Valida el código que el usuario recibió por correo para confirmar su cuenta o completar el flujo de recuperación.',
  })
  @ApiBody({
    type: CodigoPasajeroAutenticacion,
    description: 'Código de 4 dígitos recibido por correo',
    examples: {
      ejemplo: { value: { codigo: '1234' }, summary: 'Código de verificación' },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Verificación completada',
    schema: {
      type: 'string',
      example:
        'La verificación del usuario Juan se ha completado con éxito. Muchas gracias por su preferencia.',
    },
  })
  @ApiResponse({ status: 400, description: 'Código inválido o expirado' })
  async verifyUser(
    @Body() codigoPasajeroAutenticacion: CodigoPasajeroAutenticacion,
  ) {
    return await this.authService.verifyUser(codigoPasajeroAutenticacion);
  }
}
