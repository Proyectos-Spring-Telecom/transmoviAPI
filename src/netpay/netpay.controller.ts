import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { NetpayService } from './netpay.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { AssignCardDto } from './dto/assign-card.dto';
import { Confirm3DSDto } from './dto/confirm-3ds.dto';
import { CancelRefundDto } from './dto/cancel-refund.dto';
import { ProcessPaymentWithTokenDto } from './dto/process-payment-with-token.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';

@ApiTags('Netpay - Integración Backend')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('netpay')
export class NetpayController {
  constructor(private readonly netpayService: NetpayService) {}

  @Get('test-connection')
  @ApiOperation({ summary: 'Verifica la conectividad con Netpay' })
  @ApiResponse({ status: 200, description: 'Estado de la conexión' })
  async testConnection() {
    return this.netpayService.testConnection();
  }

  @Get('public-key')
  @ApiOperation({
    summary: 'Obtiene la public key para usar en NetpayJS (frontend)',
    description: 'Este endpoint devuelve la public key que debe usarse en el frontend con NetpayJS para tokenizar tarjetas de forma segura.',
  })
  @ApiResponse({ status: 200, description: 'Public key de Netpay' })
  getPublicKey() {
    return this.netpayService.getPublicKey();
  }

  @Post('payment/with-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Procesa un pago con token generado desde NetpayJS (frontend) - RECOMENDADO',
    description:
      'Este endpoint recibe el token generado por NetpayJS en el frontend y procesa el pago. ' +
      'Este es el método RECOMENDADO para procesar pagos. ' +
      'La tokenización debe hacerse en el frontend usando NetpayJS (ver FRONTEND_INTEGRATION.md). ' +
      'Incluye soporte completo para 3DS 2.0 con deviceFingerPrint y deviceInformation.',
  })
  @ApiResponse({ status: 200, description: 'Pago procesado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o pago rechazado' })
  async processPaymentWithToken(@Body() processPaymentDto: ProcessPaymentWithTokenDto) {
    return this.netpayService.processPaymentWithToken(processPaymentDto);
  }

  @Post('customers')
  @ApiOperation({
    summary: 'Crea un cliente en Netpay',
    description: 'Crea un perfil de cliente en Netpay. Útil para guardar tarjetas y procesar pagos recurrentes.',
  })
  @ApiResponse({ status: 201, description: 'Cliente creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  async createCustomer(@Body() createCustomerDto: CreateCustomerDto) {
    return this.netpayService.createCustomer(createCustomerDto);
  }

  @Get('customers')
  @ApiOperation({ 
    summary: 'Consulta información de un cliente',
    description: 'Consulta información de un cliente usando su customerId (puede ser id string o clientId número) como query parameter.',
  })
  @ApiResponse({ status: 200, description: 'Información del cliente' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  async getCustomer(@Query('customerId') customerId: string) {
    if (!customerId) {
      throw new BadRequestException('El parámetro customerId es requerido');
    }
    return this.netpayService.getCustomer(customerId);
  }

  @Put('customers/:customerId/token')
  @ApiOperation({ 
    summary: 'Asigna una tarjeta (token) a un cliente existente',
    description: 'Asigna un token de tarjeta generado por NetpayJS a un cliente existente. Acepta clientId (número) o id (string).',
  })
  @ApiResponse({ status: 200, description: 'Tarjeta asignada exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  async assignCardToCustomer(
    @Param('customerId') customerId: string,
    @Body() assignCardDto: AssignCardDto,
  ) {
    return this.netpayService.assignCardToCustomer({
      ...assignCardDto,
      customerId,
    });
  }

  @Put('customers/:customerId/cards')
  @ApiOperation({ 
    summary: 'Asigna una tarjeta (token) a un cliente existente (alias)',
    description: 'Alias para /token. Asigna un token de tarjeta generado por NetpayJS a un cliente existente. Acepta clientId (número) o id (string).',
  })
  @ApiResponse({ status: 200, description: 'Tarjeta asignada exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  async assignCardToCustomerAlias(
    @Param('customerId') customerId: string,
    @Body() assignCardDto: AssignCardDto,
  ) {
    return this.netpayService.assignCardToCustomer({
      ...assignCardDto,
      customerId,
    });
  }

  @Delete('customers/:customerId/cards/:cardId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Elimina una tarjeta de un cliente' })
  @ApiResponse({ status: 200, description: 'Tarjeta eliminada exitosamente' })
  @ApiResponse({ status: 404, description: 'Tarjeta no encontrada' })
  async deleteCard(
    @Param('customerId') customerId: string,
    @Param('cardId') cardId: string,
  ) {
    return this.netpayService.deleteCard(customerId, cardId);
  }

  @Post('payment/saved-card')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Procesa un pago con tarjeta guardada',
    description:
      'Procesa un pago usando una tarjeta previamente guardada asociada a un cliente. ' +
      'Requiere customerId y cardId. El cliente debe haber sido creado previamente y tener tarjetas guardadas.',
  })
  @ApiResponse({ status: 200, description: 'Pago procesado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o pago rechazado' })
  async processPaymentWithSavedCard(@Body() createPaymentDto: CreatePaymentDto) {
    return this.netpayService.processPaymentWithSavedCard(createPaymentDto);
  }

  @Post('3ds/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirma una transacción después de 3D Secure' })
  @ApiResponse({ status: 200, description: 'Transacción confirmada exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  async confirm3DSPayment(@Body() confirm3DSDto: Confirm3DSDto) {
    return this.netpayService.confirm3DSPayment(confirm3DSDto);
  }

  @Get('transactions/:transactionId')
  @ApiOperation({ summary: 'Consulta los detalles de una transacción' })
  @ApiResponse({ status: 200, description: 'Detalles de la transacción' })
  @ApiResponse({ status: 404, description: 'Transacción no encontrada' })
  async getTransactionDetails(@Param('transactionId') transactionId: string) {
    return this.netpayService.getTransactionDetails(transactionId);
  }

  @Put('transactions/:transactionId/refund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancela o reembolsa una transacción' })
  @ApiResponse({ status: 200, description: 'Transacción cancelada/reembolsada exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  async cancelOrRefund(
    @Param('transactionId') transactionId: string,
    @Body() cancelRefundDto: CancelRefundDto,
  ) {
    return this.netpayService.cancelOrRefund({
      ...cancelRefundDto,
      transactionId,
    });
  }
}
