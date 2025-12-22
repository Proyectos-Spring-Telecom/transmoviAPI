import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { TokenizeCardDto } from './dto/tokenize-card.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { AssignCardDto } from './dto/assign-card.dto';
import { Confirm3DSDto } from './dto/confirm-3ds.dto';
import { CancelRefundDto } from './dto/cancel-refund.dto';
import { ProcessPaymentWithTokenDto } from './dto/process-payment-with-token.dto';
import {
  NetpayTokenResponse,
  NetpayReferenceIdResponse,
  NetpayCheckInResponse,
  NetpayPaymentResponse,
  NetpayCustomerResponse,
  NetpayCardResponse,
  NetpayTransactionDetailResponse,
  NetpayErrorResponse,
} from './interfaces/netpay-response.interface';

@Injectable()
export class NetpayService {
  private readonly baseUrl: string;
  private readonly publicKey: string;
  private readonly privateKey: string;
  private readonly isProduction: boolean;
  private readonly httpClient: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.isProduction = this.configService.get<string>('NETPAY_ENVIRONMENT') === 'production';
    
    // Permitir URL personalizada o usar defaults
    const customUrl = this.configService.get<string>('NETPAY_BASE_URL');
    if (customUrl) {
      // Asegurar que la URL base no incluya rutas/endpoints
      // Si el usuario incluyó un endpoint, lo removemos
      this.baseUrl = customUrl.replace(/\/gateway-ecommerce.*$/, '').replace(/\/v\d+.*$/, '').replace(/\/$/, '');
    } else {
      // URLs por defecto según el curl de ejemplo de Netpay
      this.baseUrl = this.isProduction
        ? 'https://gateway.netpay.com.mx' // Producción
        : 'https://gateway-154.netpaydev.com'; // Sandbox/Desarrollo
    }
    
    // Validar que la URL base sea correcta para sandbox
    if (!this.isProduction && !this.baseUrl.includes('gateway-154.netpaydev.com') && !customUrl) {
      console.warn('⚠️  URL base de sandbox puede ser incorrecta. Debería ser: https://gateway-154.netpaydev.com');
    }
    
    this.publicKey = this.configService.get<string>('NETPAY_PUBLIC_KEY') || '';
    this.privateKey = this.configService.get<string>('NETPAY_PRIVATE_KEY') || '';

    // Validar que las llaves estén configuradas
    if (!this.privateKey) {
      console.warn('⚠️  NETPAY_PRIVATE_KEY no está configurada');
    }
    if (!this.publicKey) {
      console.warn('⚠️  NETPAY_PUBLIC_KEY no está configurada');
    }

    // Solo mostrar logs en desarrollo, no en producción
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔧 Netpay Service inicializado:', {
        baseUrl: this.baseUrl,
        environment: this.isProduction ? 'production' : 'sandbox',
        hasPublicKey: !!this.publicKey,
        hasPrivateKey: !!this.privateKey,
        customUrlProvided: !!customUrl,
        originalCustomUrl: customUrl,
      });
    }

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Obtiene los headers de autenticación para las peticiones
   * Según la documentación de Netpay, usa Authorization header con la private key
   */
  private getAuthHeaders(): Record<string, string> {
    return {
      'Authorization': this.privateKey, // Netpay usa la key directamente, no Bearer
      'Content-Type': 'application/json',
      'accept': 'application/json',
      'User-Agent': 'NestJS-Netpay-Integration/1.0',
    };
  }

  /**
   * Maneja errores de la API de Netpay
   */
  private handleError(error: any, context?: string): never {
    // Log detallado para depuración solo en desarrollo
    if (process.env.NODE_ENV !== 'production') {
      console.error(`❌ Error en Netpay${context ? ` (${context})` : ''}:`, {
        message: error.message,
        code: error.code,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        method: error.config?.method,
        hasResponse: !!error.response,
        hasRequest: !!error.request,
      });
    }

    if (error.response) {
      // El servidor respondió con un código de estado de error
      const status = error.response.status;
      const errorData: NetpayErrorResponse = error.response.data;
      
      if (process.env.NODE_ENV !== 'production') {
        console.error('📋 Respuesta del servidor:', {
          status,
          data: errorData,
          headers: error.response.headers,
        });
      }

      throw new BadRequestException(
        errorData.message || `Error en la petición a Netpay (${status})`,
      );
    }
    
    if (error.request) {
      // La petición se hizo pero no se recibió respuesta
      if (process.env.NODE_ENV !== 'production') {
        console.error('📡 Detalles de la petición fallida:', {
          url: `${error.config?.baseURL}${error.config?.url}`,
          method: error.config?.method,
          timeout: error.config?.timeout,
          code: error.code,
        });
      }

      const errorMessage = error.code === 'ECONNREFUSED'
        ? `No se pudo conectar al servidor de Netpay. Verifica la URL: ${this.baseUrl}`
        : error.code === 'ETIMEDOUT'
        ? 'La petición a Netpay expiró (timeout)'
        : error.code === 'ENOTFOUND'
        ? `No se pudo resolver el host de Netpay. Verifica la URL: ${this.baseUrl}`
        : `No se recibió respuesta del servidor de Netpay. Código: ${error.code || 'UNKNOWN'}`;

      throw new InternalServerErrorException(errorMessage);
    }
    
    // Error al configurar la petición
    throw new InternalServerErrorException(
      `Error al procesar la petición: ${error.message}`,
    );
  }

  /**
   * Obtiene la public key para usar en NetpayJS (frontend)
   * @returns Public key de Netpay
   */
  getPublicKey(): { publicKey: string; environment: string } {
    return {
      publicKey: this.publicKey,
      environment: this.isProduction ? 'production' : 'sandbox',
    };
  }

  /**
   * Verifica la conectividad con el servidor de Netpay
   * @returns Información de la conexión
   */
  async testConnection(): Promise<{
    success: boolean;
    baseUrl: string;
    environment: string;
    message: string;
  }> {
    try {
      // Intentar una petición simple para verificar conectividad
      await this.httpClient.get('/health', { timeout: 5000 });
      return {
        success: true,
        baseUrl: this.baseUrl,
        environment: this.isProduction ? 'production' : 'sandbox',
        message: 'Conexión exitosa',
      };
    } catch (error) {
      return {
        success: false,
        baseUrl: this.baseUrl,
        environment: this.isProduction ? 'production' : 'sandbox',
        message: error.code || 'Error de conexión',
      };
    }
  }

  /**
   * Tokeniza una tarjeta de crédito/débito
   * Nota: Según la documentación de Netpay, la tokenización normalmente se hace desde el frontend
   * con NetpayJS. Este método intenta hacerlo desde el backend usando la API REST.
   * @param tokenizeCardDto Datos de la tarjeta a tokenizar
   * @returns Token de la tarjeta
   */
  async tokenizeCard(
    tokenizeCardDto: TokenizeCardDto,
  ): Promise<NetpayTokenResponse> {
    // Preparar el payload según la documentación de Netpay
    const payload: any = {
      cardNumber: tokenizeCardDto.cardNumber,
      expMonth: tokenizeCardDto.expMonth,
      expYear: tokenizeCardDto.expYear,
      cvv2: tokenizeCardDto.cvv2,
    };

    // Campos opcionales según documentación
    if (tokenizeCardDto.vault !== undefined) {
      payload.vault = tokenizeCardDto.vault;
    }
    if (tokenizeCardDto.simpleUse !== undefined) {
      payload.simpleUse = tokenizeCardDto.simpleUse;
    }
    if (tokenizeCardDto.deviceFingerPrint) {
      payload.deviceFingerPrint = tokenizeCardDto.deviceFingerPrint;
    }

    // Endpoints posibles según diferentes versiones de la API
    const possibleEndpoints = [
      '/v1/tokens',
      '/api/v1/tokens',
      '/api/v1/tokenization',
      '/tokens',
      '/v1.2.1/tokens', // Versión específica de la API
    ];

    // Métodos de autenticación - NetpayJS usa public key
    const authMethods = [
      { usePublicKey: true, useApiKeyHeader: false, name: 'public key + Bearer' },
      { usePublicKey: true, useApiKeyHeader: true, name: 'public key + x-netpay-api-key' },
      { usePublicKey: false, useApiKeyHeader: false, name: 'private key + Bearer' },
      { usePublicKey: false, useApiKeyHeader: true, name: 'private key + x-netpay-api-key' },
    ];

    let lastError: any = null;

    // Intentar con diferentes combinaciones de endpoint y autenticación
    for (const endpoint of possibleEndpoints) {
      for (const authMethod of authMethods) {
        try {
          if (process.env.NODE_ENV !== 'production') {
            console.log(`🔄 Intentando tokenización: ${endpoint} con ${authMethod.name}`);
          }

          const response = await this.httpClient.post<NetpayTokenResponse>(
            endpoint,
            payload,
            { 
              headers: this.getAuthHeaders(),
              timeout: 15000,
            },
          );
          
          if (process.env.NODE_ENV !== 'production') {
            console.log(`✅ Tokenización exitosa: ${endpoint} con ${authMethod.name}`);
          }
          return response.data;
        } catch (error) {
          lastError = error;
          
          // Si recibimos una respuesta del servidor
          if (error.response) {
            const status = error.response.status;
            
            // Si es 401/403, probar siguiente método de auth
            if (status === 401 || status === 403) {
              if (process.env.NODE_ENV !== 'production') {
                console.log(`⚠️  Autenticación fallida (${status}), probando siguiente método...`);
              }
              continue;
            }
            
            // Si es 404, el endpoint no existe, probar siguiente
            if (status === 404) {
              if (process.env.NODE_ENV !== 'production') {
                console.log(`⚠️  Endpoint no encontrado (404), probando siguiente...`);
              }
              break; // Probar siguiente endpoint
            }
            
            // Si es otro error de respuesta (400, 422, etc.), puede ser error de validación
            if (process.env.NODE_ENV !== 'production') {
              console.log(`⚠️  Error ${status}:`, error.response.data);
            }
            
            // Si no es 404, puede ser que el endpoint existe pero hay error de datos
            // Continuar probando otros métodos pero guardar el error
            continue;
          }
          
          // Si es timeout o error de conexión, continuar probando
          if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            if (process.env.NODE_ENV !== 'production') {
              console.log(`⚠️  Timeout en ${endpoint}, probando siguiente...`);
            }
            continue;
          }
        }
      }
    }

    // Si llegamos aquí, todos los intentos fallaron
    if (lastError) {
      // Si el último error tiene información útil, mostrarla
      if (lastError.response) {
        this.handleError(lastError, 'tokenizeCard');
      } else {
        throw new InternalServerErrorException(
          `No se pudo tokenizar la tarjeta. Verifica la URL base (${this.baseUrl}) y las llaves de API. ` +
          `Nota: La tokenización normalmente se hace desde el frontend con NetpayJS. ` +
          `Si necesitas tokenizar desde el backend, verifica con Netpay si hay un endpoint REST disponible.`
        );
      }
    }
    
    throw new InternalServerErrorException('No se pudo tokenizar la tarjeta después de intentar múltiples métodos');
  }

  /**
   * Obtiene un Reference ID para checkout
   * @returns Reference ID
   */
  async getReferenceId(): Promise<NetpayReferenceIdResponse> {
    try {
      const response = await this.httpClient.post<NetpayReferenceIdResponse>(
        '/v1/reference-id',
        {},
        { headers: this.getAuthHeaders() },
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Realiza check-in para checkout
   * @param referenceId Reference ID del checkout
   * @param amount Monto del pago
   * @param currency Moneda (MXN, USD, etc.)
   * @returns Información del checkout
   */
  async checkIn(
    referenceId: string,
    amount: number,
    currency: string = 'MXN',
  ): Promise<NetpayCheckInResponse> {
    try {
      const response = await this.httpClient.post<NetpayCheckInResponse>(
        '/v1/check-in',
        {
          referenceId,
          amount,
          currency,
        },
        { headers: this.getAuthHeaders() },
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Realiza check-out para checkout
   * @param referenceId Reference ID del checkout
   * @returns Información del checkout
   */
  async checkOut(referenceId: string): Promise<NetpayCheckInResponse> {
    try {
      const response = await this.httpClient.post<NetpayCheckInResponse>(
        '/v1/check-out',
        { referenceId },
        { headers: this.getAuthHeaders() },
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Procesa un pago con token generado desde NetpayJS (frontend)
   * Este es el método recomendado cuando la tokenización se hace en el cliente
   * @param processPaymentDto Datos del pago incluyendo token de NetpayJS
   * @returns Información de la transacción
   */
  async processPaymentWithToken(
    processPaymentDto: ProcessPaymentWithTokenDto,
  ): Promise<NetpayPaymentResponse> {
    try {
      // Preparar payload según el formato real de Netpay v3.5/charges
      // Según el curl de ejemplo: paymentMethod es string "card", y el token va en otro campo
      const payload: any = {
        transactionType: 'Auth',
        amount: processPaymentDto.amount,
        description: processPaymentDto.description,
        paymentMethod: 'card', // String, no objeto
        token: processPaymentDto.token, // Token generado por NetpayJS va directamente en el payload
        currency: processPaymentDto.currency,
        saveCard: processPaymentDto.saveCard || 'false', // Netpay espera string ("true" o "false")
      };

      // Agregar información de dispositivo para 3DS 2.0
      if (processPaymentDto.deviceFingerPrint) {
        payload.deviceFingerPrint = processPaymentDto.deviceFingerPrint;
      }
      if (processPaymentDto.sessionId) {
        payload.sessionId = processPaymentDto.sessionId;
      } else if (processPaymentDto.deviceFingerPrint) {
        // Si no hay sessionId pero hay deviceFingerPrint, usar el mismo valor
        payload.sessionId = processPaymentDto.deviceFingerPrint;
      }
      if (processPaymentDto.deviceInformation) {
        payload.deviceInformation = processPaymentDto.deviceInformation;
      }
      if (processPaymentDto.referenceID) {
        payload.referenceID = processPaymentDto.referenceID;
      }
      if (processPaymentDto.billing) {
        payload.billing = processPaymentDto.billing;
      }

      // URL completa para procesar pagos - ignorar baseUrl del .env
      const paymentUrl = this.isProduction
        ? 'https://gateway.netpay.com.mx/gateway-ecommerce/v3.5/charges'
        : 'https://gateway-154.netpaydev.com/gateway-ecommerce/v3.5/charges';

      if (process.env.NODE_ENV !== 'production') {
        console.log(`🔄 Procesando pago con token en: ${paymentUrl}`);
        console.log('📋 Payload:', JSON.stringify(payload, null, 2));
      }

      // Usar axios directamente con la URL completa, no el httpClient que tiene baseUrl
      const response = await axios.post<NetpayPaymentResponse>(
        paymentUrl,
        payload,
        { 
          headers: this.getAuthHeaders(),
          timeout: 30000,
        },
      );

      if (process.env.NODE_ENV !== 'production') {
        console.log('✅ Pago procesado exitosamente');
      }
      return response.data;
    } catch (error) {
      this.handleError(error, 'processPaymentWithToken');
    }
  }

  /**
   * Procesa un pago con token de un solo uso
   * @param createPaymentDto Datos del pago
   * @returns Información de la transacción
   */
  async processPayment(
    createPaymentDto: CreatePaymentDto,
  ): Promise<NetpayPaymentResponse> {
    try {
      const payload = {
        token: createPaymentDto.token,
        amount: createPaymentDto.amount,
        currency: createPaymentDto.currency,
        description: createPaymentDto.description,
        saveCard: createPaymentDto.saveCard ? String(createPaymentDto.saveCard) : 'false', // Netpay espera string
        deviceInformation: createPaymentDto.deviceInformation,
        ...(createPaymentDto.referenceId && { referenceId: createPaymentDto.referenceId }),
      };

      const response = await this.httpClient.post<NetpayPaymentResponse>(
        '/v1/charges',
        payload,
        { headers: this.getAuthHeaders() },
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Crea un cliente en Netpay
   * @param createCustomerDto Datos del cliente
   * @returns Información del cliente creado
   */
  async createCustomer(
    createCustomerDto: CreateCustomerDto,
  ): Promise<NetpayCustomerResponse> {
    try {
      const payload = {
        firstName: createCustomerDto.firstName,
        lastName: createCustomerDto.lastName,
        email: createCustomerDto.email,
        ...(createCustomerDto.phone && { phone: createCustomerDto.phone }),
        ...(createCustomerDto.token && { token: createCustomerDto.token }),
      };

      const response = await this.httpClient.post<NetpayCustomerResponse>(
        '/v1/customers',
        payload,
        { headers: this.getAuthHeaders() },
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Asigna una tarjeta a un cliente existente
   * @param assignCardDto Datos para asignar la tarjeta
   * @returns Información de la tarjeta asignada
   */
  async assignCardToCustomer(
    assignCardDto: AssignCardDto,
  ): Promise<NetpayCardResponse> {
    try {
      const response = await this.httpClient.put<NetpayCardResponse>(
        `/v1/customers/${assignCardDto.customerId}/cards`,
        { token: assignCardDto.token },
        { headers: this.getAuthHeaders() },
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Consulta información de un cliente
   * @param customerId ID del cliente
   * @returns Información del cliente
   */
  async getCustomer(customerId: string): Promise<NetpayCustomerResponse> {
    try {
      const response = await this.httpClient.get<NetpayCustomerResponse>(
        `/v1/customers/${customerId}`,
        { headers: this.getAuthHeaders() },
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Elimina una tarjeta de un cliente
   * @param customerId ID del cliente
   * @param cardId ID de la tarjeta
   * @returns Confirmación de eliminación
   */
  async deleteCard(
    customerId: string,
    cardId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.httpClient.delete(
        `/v1/customers/${customerId}/cards/${cardId}`,
        { headers: this.getAuthHeaders() },
      );
      return { success: true, message: 'Tarjeta eliminada correctamente' };
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Procesa un pago con token guardado
   * @param createPaymentDto Datos del pago (debe incluir customerId y cardId)
   * @returns Información de la transacción
   */
  async processPaymentWithSavedCard(
    createPaymentDto: CreatePaymentDto,
  ): Promise<NetpayPaymentResponse> {
    if (!createPaymentDto.customerId || !createPaymentDto.cardId) {
      throw new BadRequestException(
        'customerId y cardId son requeridos para pagos con tarjeta guardada',
      );
    }

    try {
      const payload = {
        customerId: createPaymentDto.customerId,
        cardId: createPaymentDto.cardId,
        amount: createPaymentDto.amount,
        currency: createPaymentDto.currency,
        description: createPaymentDto.description,
        deviceInformation: createPaymentDto.deviceInformation,
      };

      const response = await this.httpClient.post<NetpayPaymentResponse>(
        '/v1/charges',
        payload,
        { headers: this.getAuthHeaders() },
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Confirma una transacción después de 3D Secure
   * @param confirm3DSDto Datos de confirmación 3DS
   * @returns Información de la transacción confirmada
   */
  async confirm3DSPayment(
    confirm3DSDto: Confirm3DSDto,
  ): Promise<NetpayPaymentResponse> {
    try {
      const response = await this.httpClient.post<NetpayPaymentResponse>(
        '/v1/3ds/confirm',
        {
          transactionId: confirm3DSDto.transactionId,
          referenceId: confirm3DSDto.referenceId,
        },
        { headers: this.getAuthHeaders() },
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Consulta los detalles de una transacción
   * @param transactionId ID de la transacción
   * @returns Detalles de la transacción
   */
  async getTransactionDetails(
    transactionId: string,
  ): Promise<NetpayTransactionDetailResponse> {
    try {
      const response = await this.httpClient.get<NetpayTransactionDetailResponse>(
        `/v1/transactions/${transactionId}`,
        { headers: this.getAuthHeaders() },
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Cancela o reembolsa una transacción
   * @param cancelRefundDto Datos para cancelar/reembolsar
   * @returns Información de la transacción cancelada/reembolsada
   */
  async cancelOrRefund(
    cancelRefundDto: CancelRefundDto,
  ): Promise<NetpayTransactionDetailResponse> {
    try {
      const payload: any = {
        transactionId: cancelRefundDto.transactionId,
      };

      if (cancelRefundDto.amount) {
        payload.amount = cancelRefundDto.amount;
      }

      if (cancelRefundDto.reason) {
        payload.reason = cancelRefundDto.reason;
      }

      const response = await this.httpClient.put<NetpayTransactionDetailResponse>(
        `/v1/transactions/${cancelRefundDto.transactionId}/refund`,
        payload,
        { headers: this.getAuthHeaders() },
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }
}
