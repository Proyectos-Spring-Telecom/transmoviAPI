import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TransaccionesService } from './transacciones.service';
import { ViajesService } from 'src/viajes/viajes.service';
import { TurnosService } from 'src/turnos/turnos.service';

/** ID de usuario sistema para operaciones del cron (bitácora). */
const ID_USUARIO_SISTEMA = 1;

@Injectable()
export class TransaccionesCronService {
  private readonly logger = new Logger(TransaccionesCronService.name);

  constructor(
    private readonly transaccionesService: TransaccionesService,
    private readonly viajesService: ViajesService,
    private readonly turnosService: TurnosService,
  ) { }

  /**
   * Cron job que se ejecuta diariamente a las 01:30 AM.
   * Cierra transacciones débito abiertas, viajes abiertos y turnos abiertos.
   * Usa la misma lógica de createTransaccionDebitoByViajes (via viajeCierre).
   */
  @Cron('30 1 * * *', {
    name: 'cerrarTransaccionesViajesTurnosAbiertos',
    timeZone: 'America/Mexico_City',
  })
  async handleCierreAutomatico() {
    this.logger.log('Iniciando cierre automático de transacciones, viajes y turnos abiertos...');

    try {
      // 1) Cerrar transacciones débito abiertas (via viajeCierre -> createTransaccionDebitoByViajes)
      const resTrans = await this.transaccionesService.cerrarTransaccionesDebitoAbiertasCron();
      this.logger.log(`Transacciones débito cerradas: ${resTrans.viajesProcesados} viajes procesados.`);
      if (resTrans.errores.length > 0) {
        resTrans.errores.forEach((e) => this.logger.warn(`[Transacciones] ${e}`));
      }

      // 2) Cerrar viajes abiertos
      const resViajes = await this.viajesService.cerrarViajesAbiertosCron(ID_USUARIO_SISTEMA);
      this.logger.log(`Viajes cerrados: ${resViajes.viajesCerrados}.`);
      if (resViajes.errores.length > 0) {
        resViajes.errores.forEach((e) => this.logger.warn(`[Viajes] ${e}`));
      }

      // 3) Cerrar turnos abiertos (incluye cierre de viajes asociados)
      const resTurnos = await this.turnosService.cerrarTurnosAbiertosCron(ID_USUARIO_SISTEMA);
      this.logger.log(`Turnos cerrados: ${resTurnos.turnosCerrados}.`);
      if (resTurnos.errores.length > 0) {
        resTurnos.errores.forEach((e) => this.logger.warn(`[Turnos] ${e}`));
      }

      // 4) Verificar que todas las TransaccionesDebito estén en histórico, luego vaciar tabla y reiniciar contador
      await this.transaccionesService.limpiarTransaccionesDebito();
      this.logger.log('TransaccionesDebito: limpieza y reinicio de contador completados.');

      this.logger.log('Cierre automático completado.');
    } catch (error) {
      this.logger.error(
        `Error en cierre automático: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Cron job que se ejecuta diariamente a las 02:30 AM
   * Limpia la tabla TransaccionesRecarga verificando que todos los registros
   * ya existan en HistoricoTransaccionesRecarga.
   */
  @Cron('30 2 * * *', {
    name: 'limpiarTransaccionesRecarga',
    timeZone: 'America/Mexico_City',
  })
  async handleLimpiarTransaccionesRecarga() {
    this.logger.log('Iniciando limpieza automática de TransaccionesRecarga...');

    try {
      await this.transaccionesService.limpiarTransaccionesRecarga();
      this.logger.log('Limpieza automática de TransaccionesRecarga completada exitosamente.');
    } catch (error) {
      this.logger.error(
        `Error en limpieza automática de TransaccionesRecarga: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
}
