import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TransaccionesService } from './transacciones.service';

@Injectable()
export class TransaccionesCronService {
  private readonly logger = new Logger(TransaccionesCronService.name);

  constructor(private readonly transaccionesService: TransaccionesService) {}

  /**
   * Cron job que se ejecuta diariamente a las 02:00 AM
   * Limpia la tabla TransaccionesRecarga verificando que todos los registros
   * ya existan en HistoricoTransaccionesRecarga.
   * 
   * Expresión cron: '0 2 * * *' = A las 02:00 AM todos los días
   */
  @Cron('0 2 * * *', {
    name: 'limpiarTransaccionesRecarga',
    timeZone: 'America/Mexico_City', // Ajusta según tu zona horaria
  })
  async handleLimpiarTransaccionesRecarga() {
    this.logger.log('Iniciando limpieza automática de TransaccionesRecarga...');
    
    try {
      await this.transaccionesService.limpiarTransaccionesRecarga();
      this.logger.log('Limpieza automática de TransaccionesRecarga completada exitosamente.');
    } catch (error) {
      this.logger.error(
        `Error en limpieza automática de TransaccionesRecarga: ${error.message}`,
        error.stack,
      );
    }
  }
}
