import {
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { EstatusEnumBitcora } from 'src/common/ApiResponse';
import { HistoricoInstalaciones } from 'src/entities/historico-instalaciones';
import { IsNull, Repository } from 'typeorm';
import { UpdateHistoricoDto } from './dto/update-historico.dto';
@Injectable()
export class HistoricoinstalacionesService {
  constructor(
    @InjectRepository(HistoricoInstalaciones)
    private readonly historicoInstalacionesRepository: Repository<HistoricoInstalaciones>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  findAll() {
    return `This action returns all historicoinstalaciones`;
  }

  findOne(id: number) {
    return `This action returns a #${id} historicoinstalacione`;
  }

  //Crear un historico
  async createHistorico(
    idInstalacion: number,
    idDispositivo: number,
    idBlueVox: number,
    idVehiculo: number,
    idCliente: number,
    idUser: number,
  ) {
    try {
      const historico = {
        idInstalacion: idInstalacion,
        idDispositivo: idDispositivo,
        idBlueVox: idBlueVox,
        idVehiculo: idVehiculo,
        idCliente: idCliente,
      };

      const createHistorico =
        await this.historicoInstalacionesRepository.create(historico);
      const historicoSave =
        await this.historicoInstalacionesRepository.save(createHistorico);

      // Registro en la bitácora SUCCESS
      const querylogger = { historico };
      await this.bitacoraLogger.logToBitacora(
        'HistoricoInstalaciones',
        `El historico de la instalacion ${idInstalacion} ha sido creada exitosamente.`,
        'CREATE',
        querylogger,
        idUser,
        27,
        EstatusEnumBitcora.SUCCESS,
      );
    } catch (error) {
      console.log(error);
      // Registro en la bitácora SUCCESS
      const querylogger = {
        instalacion: idInstalacion,
        dispositivo: idDispositivo,
        bluevoxs: idBlueVox,
        vehiculo: idVehiculo,
        cliente: idCliente,
      };
      await this.bitacoraLogger.logToBitacora(
        'HistoricoInstalaciones',
        `El historico de la instalacion ${idInstalacion} ha sido creada exitosamente.`,
        'CREATE',
        querylogger,
        idUser,
        27,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: `Ocurrió un problema al intentar crear historico de la instalación con ID: ${idInstalacion}.`,
        error: error.message,
      });
    }
  }

  async updateHistorico(
    instalacion: UpdateHistoricoDto,
    idDispositivoUp: number,
    idBlueVoxUp: number,
    idVehiculoUp: number,
    idClienteUp: number,
    idUser: number,
    comentario?: string,
  ) {
    try {
      // Buscar el histórico activo (sin fechaBaja) para esta instalación
      const historicoActivo =
        await this.historicoInstalacionesRepository.findOne({
          where: {
            idInstalacion: instalacion.idInstalacion,
            fechaBaja: IsNull(),
          },
        });

      const mismoDispositivo =
        historicoActivo?.idDispositivo === idDispositivoUp;
      const mismoBlueVox = historicoActivo?.idBlueVox === idBlueVoxUp;

      // 🚫 Si no hay cambios reales, no hacer nada
      if (historicoActivo && mismoDispositivo && mismoBlueVox) {
        return;
      }

      //afiliamos el monedero al pasajero y cambiamos estatus activo
      function pad(n: number) {
        return n < 10 ? '0' + n : n;
      }

      const ahora = new Date();
      const desfaseMs = -6 * 60 * 60 * 1000; // -6 horas en milisegundos
      const fechaDesfasada = new Date(ahora.getTime() + desfaseMs);

      const fechaActual = `${fechaDesfasada.getFullYear()}-${pad(fechaDesfasada.getMonth() + 1)}-${pad(fechaDesfasada.getDate())} ${pad(fechaDesfasada.getHours())}:${pad(fechaDesfasada.getMinutes())}:${pad(fechaDesfasada.getSeconds())}`;

      // ✅ Si existe un registro activo con datos distintos, cerrarlo
      if (historicoActivo) {
        await this.historicoInstalacionesRepository.update(historicoActivo.id, {
          fechaBaja: fechaDesfasada,
          comentario: comentario,
        });
      }

      // 🆕 Insertar nuevo histórico con los datos actualizados
      const historico = this.historicoInstalacionesRepository.create({
        idInstalacion: instalacion.idInstalacion,
        idDispositivo: idDispositivoUp,
        idBlueVox: idBlueVoxUp,
        idVehiculo: idVehiculoUp, // el vehículo no cambia, pero se registra
        idCliente: idClienteUp,
      });

      const historicoSave =
        await this.historicoInstalacionesRepository.save(historico);

      // 📝 Registrar en bitácora
      const querylogger = { historico };
      await this.bitacoraLogger.logToBitacora(
        'HistoricoInstalaciones',
        `Histórico de la instalación ${historicoSave.id} actualizado correctamente.`,
        'CREATE',
        querylogger,
        idUser,
        27,
        EstatusEnumBitcora.SUCCESS,
      );
    } catch (error) {
      console.log(error);
      // Registro en la bitácora de errores
      const querylogger = {
        instalacion: instalacion.idInstalacion,
        dispositivo: idDispositivoUp,
        bluevoxs: idBlueVoxUp,
        vehiculo: idVehiculoUp,
        cliente: idClienteUp,
      };
      await this.bitacoraLogger.logToBitacora(
        'HistoricoInstalaciones',
        `Error al actualizar el histórico de la instalación ${instalacion.idInstalacion}.`,
        'CREATE',
        querylogger,
        idUser,
        27,
        EstatusEnumBitcora.ERROR,
        error.message,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException({
        message: `Error al actualizar el histórico de la instalación con ID: ${instalacion.idInstalacion}.`,
        error: error.message,
      });
    }
  }
}
