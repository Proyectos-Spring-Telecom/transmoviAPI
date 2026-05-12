import {
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { EstatusEnumBitcora } from 'src/common/ApiResponse';
import { HistoricoInstalaciones } from 'src/entities/historico-instalaciones';
import { EntityManager, IsNull, Repository } from 'typeorm';
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
    dispositivosSnapshot: {
      Id: number;
      NumeroSerie: string;
      Principal: number | null;
    }[],
    blueVoxs: Array<{ Id: number; NumeroSerie: string }>,
    idVehiculo: number,
    idCliente: number,
    idUser: number,
    manager?: EntityManager,
  ) {
    try {
      const historico = {
        idInstalacion: idInstalacion,
        idDispositivo: dispositivosSnapshot,
        idsBlueVoxs: blueVoxs,
        idVehiculo: idVehiculo,
        idCliente: idCliente,
      };

      const repo = manager
        ? manager.getRepository(HistoricoInstalaciones)
        : this.historicoInstalacionesRepository;

      const createHistorico = await repo.create(historico as any);
      const historicoSave = await repo.save(createHistorico as any);

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
        dispositivos: dispositivosSnapshot,
        bluevoxs: blueVoxs,
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
    dispositivosSnapshot: {
      Id: number;
      NumeroSerie: string;
      Principal: number | null;
    }[],
    blueVoxsUp: Array<{ Id: number; NumeroSerie: string }>,
    idVehiculoUp: number,
    idClienteUp: number,
    idUser: number,
    comentario?: string,
    manager?: EntityManager,
  ) {
    try {
      const repo = manager
        ? manager.getRepository(HistoricoInstalaciones)
        : this.historicoInstalacionesRepository;

      // Buscar el histórico activo (sin fechaBaja) para esta instalación
      const historicoActivo = await repo.findOne({
        where: {
          idInstalacion: instalacion.idInstalacion,
          fechaBaja: IsNull(),
        },
      });

      const mismoDispositivos =
        JSON.stringify(historicoActivo?.idDispositivo ?? null) ===
        JSON.stringify(dispositivosSnapshot);
      const mismoBlueVoxs =
        JSON.stringify(historicoActivo?.idsBlueVoxs ?? null) ===
        JSON.stringify(blueVoxsUp);

      // 🚫 Si no hay cambios reales, no hacer nada
      if (historicoActivo && mismoDispositivos && mismoBlueVoxs) {
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
        await repo.update(historicoActivo.id, {
          fechaBaja: fechaDesfasada,
          comentario: comentario,
        });
      }

      // 🆕 Insertar nuevo histórico con los datos actualizados
      const historico = repo.create({
        idInstalacion: instalacion.idInstalacion,
        idDispositivo: dispositivosSnapshot,
        idsBlueVoxs: blueVoxsUp,
        idVehiculo: idVehiculoUp, // el vehículo no cambia, pero se registra
        idCliente: idClienteUp,
      });

      const historicoSave = await repo.save(historico as any);

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
        dispositivos: dispositivosSnapshot,
        bluevoxs: blueVoxsUp,
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
