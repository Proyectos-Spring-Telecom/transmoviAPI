import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateTurnoDto } from './dto/create-turno.dto';
import { UpdateTurnoDto } from './dto/update-turno.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Turnos } from 'src/entities/Turnos';
import { Repository } from 'typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { UpdateTurnosEstatusDto } from './dto/update-turno-estatus.dto';

@Injectable()
export class TurnosService {
  constructor(
    @InjectRepository(Turnos)
    private readonly turnosRepository: Repository<Turnos>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  async create(
    idUser: number,
    createTurnoDto: CreateTurnoDto,
  ): Promise<ApiCrudResponse> {
    try {
      //Creamos el turno
      const newTurno = await this.turnosRepository.create(createTurnoDto);
      const turnoSave = await this.turnosRepository.save(newTurno);
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Turnos',
        `Se creó el turno con ID: ${turnoSave.id}`,
        'CREATE',
        `CREATE, INSERT INTO Turnos (Id, Estatus, IdCliente, IdOperador, IdInstalacion) VALUES (${turnoSave.id}, ${turnoSave.estatus}, ${turnoSave.idCliente}, ${turnoSave.idOperador}, ${turnoSave.idInstalacion})`,
        Number(idUser),
        14,
      );
      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Turno creado correctamente',
        data: {
          id: Number(turnoSave.id),
          nombre:
            `id turno: ${turnoSave.id}, IdCliente: ${turnoSave.idCliente},  IdOperador: ${turnoSave.idOperador}, IdInstalacion: ${turnoSave.idInstalacion} ` ||
            '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: `Error al crear turno`,
        error,
      });
    }
  }

  async findAll(page: number, limit: number): Promise<ApiResponseCommon> {
    try {
      const [data, total] = await this.turnosRepository.findAndCount({
        skip: (page - 1) * limit,
        take: limit,
        relations: [
        'idCliente2',
        'idOperador2',
        'idOperador2.idUsuario2',
        'idInstalacion2',
        'idInstalacion2.dispositivos',
        'idInstalacion2.blueVoxs',
        'idInstalacion2.vehiculos',
        'idInstalacion2.idCliente2',
      ],
        select: {
        id: true,
        inicio: true,
        fin: true,
        fechaCreacion: true,
        fechaActualizacion: true,
        estatus: true,
        idCliente2: {
          id: true,
          nombre: true,
          apellidoPaterno: true,
          apellidoMaterno: true,
        },
        idOperador2: {
          id: true,
          idUsuario2: {
            id: true,
            nombre: true,
            apellidoPaterno: true,
            apellidoMaterno: true,
          },
        },
        idInstalacion2: {
          id: true,
          dispositivos: { id: true, numeroSerie: true },
          blueVoxs: { id: true, numeroSerie: true },
          vehiculos: { id: true, placa: true },
          idCliente2: {
            id: true,
            nombre: true,
            apellidoPaterno: true,
            apellidoMaterno: true,
          },
        },
      },
      });

      if (data.length === 0) {
      throw new NotFoundException('Turnos no encontrados o null');
    }

      // 🔥 Transformación con map
    const turnos = data.map((t) => ({
      ...t,
      id: Number(t.id),
      idCliente2: {
        ...t.idCliente2,
        id: Number(t.idCliente2.id),
        nombreCompleto: `${t.idCliente2.nombre ?? ''} ${t.idCliente2.apellidoPaterno ?? ''} ${t.idCliente2.apellidoMaterno ?? ''}`.trim(),
      },
      idOperador2: t.idOperador2
        ? {
            ...t.idOperador2,
            id: Number(t.idOperador2.id),
            idUsuario2: t.idOperador2.idUsuario2
              ? {
                  ...t.idOperador2.idUsuario2,
                  id: Number(t.idOperador2.idUsuario2.id),
                  nombreCompleto: `${t.idOperador2.idUsuario2.nombre ?? ''} ${t.idOperador2.idUsuario2.apellidoPaterno ?? ''} ${t.idOperador2.idUsuario2.apellidoMaterno ?? ''}`.trim(),
                }
              : null,
          }
        : null,
      idInstalacion2: t.idInstalacion2
        ? {
            ...t.idInstalacion2,
            id: Number(t.idInstalacion2.id),
            dispositivos: t.idInstalacion2.dispositivos
              ? {
                  ...t.idInstalacion2.dispositivos,
                  id: Number(t.idInstalacion2.dispositivos.id),
                }
              : null,
            blueVoxs: t.idInstalacion2.blueVoxs
              ? {
                  ...t.idInstalacion2.blueVoxs,
                  id: Number(t.idInstalacion2.blueVoxs.id),
                }
              : null,
            vehiculos: t.idInstalacion2.vehiculos
              ? {
                  ...t.idInstalacion2.vehiculos,
                  id: Number(t.idInstalacion2.vehiculos.id),
                }
              : null,
            idCliente2: t.idInstalacion2.idCliente2
              ? {
                  ...t.idInstalacion2.idCliente2,
                  id: Number(t.idInstalacion2.idCliente2.id),
                  nombreCompleto: `${t.idInstalacion2.idCliente2.nombre ?? ''} ${t.idInstalacion2.idCliente2.apellidoPaterno ?? ''} ${t.idInstalacion2.idCliente2.apellidoMaterno ?? ''}`.trim(),
                }
              : null,
          }
        : null,
    }));

      const result: ApiResponseCommon = {
        data: turnos,
        paginated: {
          total: total,
          page,
          lastPage: Math.ceil(total / limit),
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: `Error al obtener paginado de turnos`,
        error,
      });
    }
  }

async findAllList() {
  try {
    const turnos = await this.turnosRepository.find({
      relations: [
        'idCliente2',
        'idOperador2',
        'idOperador2.idUsuario2',
        'idInstalacion2',
        'idInstalacion2.dispositivos',
        'idInstalacion2.blueVoxs',
        'idInstalacion2.vehiculos',
        'idInstalacion2.idCliente2',
      ],
      where: { estatus: 1 },
      select: {
        id: true,
        inicio: true,
        fin: true,
        fechaCreacion: true,
        fechaActualizacion: true,
        estatus: true,
        idCliente2: {
          id: true,
          nombre: true,
          apellidoPaterno: true,
          apellidoMaterno: true,
        },
        idOperador2: {
          id: true,
          idUsuario2: {
            id: true,
            nombre: true,
            apellidoPaterno: true,
            apellidoMaterno: true,
          },
        },
        idInstalacion2: {
          id: true,
          dispositivos: { id: true, numeroSerie: true },
          blueVoxs: { id: true, numeroSerie: true },
          vehiculos: { id: true, placa: true },
          idCliente2: {
            id: true,
            nombre: true,
            apellidoPaterno: true,
            apellidoMaterno: true,
          },
        },
      },
    });

    if (turnos.length === 0) {
      throw new NotFoundException('Turnos no encontrados o null');
    }

    // 🔥 Transformación con map
    const data = turnos.map((t) => ({
      ...t,
      id: Number(t.id),
      idCliente2: {
        ...t.idCliente2,
        id: Number(t.idCliente2.id),
        nombreCompleto: `${t.idCliente2.nombre ?? ''} ${t.idCliente2.apellidoPaterno ?? ''} ${t.idCliente2.apellidoMaterno ?? ''}`.trim(),
      },
      idOperador2: t.idOperador2
        ? {
            ...t.idOperador2,
            id: Number(t.idOperador2.id),
            idUsuario2: t.idOperador2.idUsuario2
              ? {
                  ...t.idOperador2.idUsuario2,
                  id: Number(t.idOperador2.idUsuario2.id),
                  nombreCompleto: `${t.idOperador2.idUsuario2.nombre ?? ''} ${t.idOperador2.idUsuario2.apellidoPaterno ?? ''} ${t.idOperador2.idUsuario2.apellidoMaterno ?? ''}`.trim(),
                }
              : null,
          }
        : null,
      idInstalacion2: t.idInstalacion2
        ? {
            ...t.idInstalacion2,
            id: Number(t.idInstalacion2.id),
            dispositivos: t.idInstalacion2.dispositivos
              ? {
                  ...t.idInstalacion2.dispositivos,
                  id: Number(t.idInstalacion2.dispositivos.id),
                }
              : null,
            blueVoxs: t.idInstalacion2.blueVoxs
              ? {
                  ...t.idInstalacion2.blueVoxs,
                  id: Number(t.idInstalacion2.blueVoxs.id),
                }
              : null,
            vehiculos: t.idInstalacion2.vehiculos
              ? {
                  ...t.idInstalacion2.vehiculos,
                  id: Number(t.idInstalacion2.vehiculos.id),
                }
              : null,
            idCliente2: t.idInstalacion2.idCliente2
              ? {
                  ...t.idInstalacion2.idCliente2,
                  id: Number(t.idInstalacion2.idCliente2.id),
                  nombreCompleto: `${t.idInstalacion2.idCliente2.nombre ?? ''} ${t.idInstalacion2.idCliente2.apellidoPaterno ?? ''} ${t.idInstalacion2.idCliente2.apellidoMaterno ?? ''}`.trim(),
                }
              : null,
          }
        : null,
    }));

    const result: ApiResponseCommon = { data };
    return result;
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new InternalServerErrorException({
      message: `Error al obtener listado del turnos`,
      error,
    });
  }
}


async findOne(id: number) {
  try {
    const turno = await this.turnosRepository.findOne({
      where: { id },
      relations: [
        'idCliente2',
        'idOperador2',
        'idOperador2.idUsuario2',
        'idInstalacion2',
        'idInstalacion2.dispositivos',
        'idInstalacion2.blueVoxs',
        'idInstalacion2.vehiculos',
        'idInstalacion2.idCliente2',
      ],
      select: {
        id: true,
        inicio: true,
        fin: true,
        fechaCreacion: true,
        fechaActualizacion: true,
        estatus: true,
        idCliente2: {
          id: true,
          nombre: true,
          apellidoPaterno: true,
          apellidoMaterno: true,
        },
        idOperador2: {
          id: true,
          idUsuario2: {
            id: true,
            nombre: true,
            apellidoPaterno: true,
            apellidoMaterno: true,
          },
        },
        idInstalacion2: {
          id: true,
          dispositivos: { id: true, numeroSerie: true },
          blueVoxs: { id: true, numeroSerie: true },
          vehiculos: { id: true, placa: true },
          idCliente2: {
            id: true,
            nombre: true,
            apellidoPaterno: true,
            apellidoMaterno: true,
          },
        },
      },
    });

    if (!turno) {
      throw new NotFoundException(`turno con id: ${id} no encontrado`);
    }

    // 🔥 Transformamos el objeto antes de devolverlo
    const data = {
      ...turno,
      id: Number(turno.id),
      idCliente2: turno.idCliente2
        ? {
            ...turno.idCliente2,
            id: Number(turno.idCliente2.id),
            nombreCompleto: `${turno.idCliente2.nombre ?? ''} ${turno.idCliente2.apellidoPaterno ?? ''} ${turno.idCliente2.apellidoMaterno ?? ''}`.trim(),
          }
        : null,
      idOperador2: turno.idOperador2
        ? {
            ...turno.idOperador2,
            id: Number(turno.idOperador2.id),
            idUsuario2: turno.idOperador2.idUsuario2
              ? {
                  ...turno.idOperador2.idUsuario2,
                  id: Number(turno.idOperador2.idUsuario2.id),
                  nombreCompleto: `${turno.idOperador2.idUsuario2.nombre ?? ''} ${turno.idOperador2.idUsuario2.apellidoPaterno ?? ''} ${turno.idOperador2.idUsuario2.apellidoMaterno ?? ''}`.trim(),
                }
              : null,
          }
        : null,
      idInstalacion2: turno.idInstalacion2
        ? {
            ...turno.idInstalacion2,
            id: Number(turno.idInstalacion2.id),
            dispositivos: turno.idInstalacion2.dispositivos
              ? {
                  ...turno.idInstalacion2.dispositivos,
                  id: Number(turno.idInstalacion2.dispositivos.id),
                }
              : null,
            blueVoxs: turno.idInstalacion2.blueVoxs
              ? {
                  ...turno.idInstalacion2.blueVoxs,
                  id: Number(turno.idInstalacion2.blueVoxs.id),
                }
              : null,
            vehiculos: turno.idInstalacion2.vehiculos
              ? {
                  ...turno.idInstalacion2.vehiculos,
                  id: Number(turno.idInstalacion2.vehiculos.id),
                }
              : null,
            idCliente2: turno.idInstalacion2.idCliente2
              ? {
                  ...turno.idInstalacion2.idCliente2,
                  id: Number(turno.idInstalacion2.idCliente2.id),
                  nombreCompleto: `${turno.idInstalacion2.idCliente2.nombre ?? ''} ${turno.idInstalacion2.idCliente2.apellidoPaterno ?? ''} ${turno.idInstalacion2.idCliente2.apellidoMaterno ?? ''}`.trim(),
                }
              : null,
          }
        : null,
    };

    return { data };
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new InternalServerErrorException({
      message: `Error al obtener un turno`,
      error: error,
    });
  }
}


  async updateEstatus(
    id: number,
    idUser: number,
    updateTurnosEstatusDto: UpdateTurnosEstatusDto,
  ): Promise<ApiCrudResponse> {
    try {
      //obtenemos estatus
      const estatus = updateTurnosEstatusDto.estatus;

      //actualizamos
      await this.turnosRepository.update(id, { estatus: estatus });

      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Turnos',
        `Se cambio el estatus: ${estatus} del turno con ID: ${id}`,
        'UPDATE',
        `UPDATE Turnos SET estatus = ${estatus} WHERE id=${id}`,
        idUser,
        14,
      );

      // ----- Api response -----
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Estatus del turno actualizado correctamente',
        estatus: { estatus: estatus },
        data: {
          id: id,
          nombre: `id turno:${id} ` || '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: `Error al actualizar estatus de un turno`,
        error,
      });
    }
  }

  async update(id: number, idUser: number, updateTurnoDto: UpdateTurnoDto) {
    try {
      //actualizamos
      await this.turnosRepository.update(id, updateTurnoDto);

      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Turnos',
        `Se elimino turno con ID: ${id}`,
        'UPDATE',
        `UPDATE Turnos Values (inicio: ${updateTurnoDto.inicio}, fin: ${updateTurnoDto.fin}, idCliente: ${updateTurnoDto.idCliente}, idOperador: ${updateTurnoDto.idOperador}, idInstalacion: ${updateTurnoDto.idInstalacion} ) WHERE id=${id}`,
        idUser,
        14,
      );

      // ----- Api response -----
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Se actualizo turno correctamente',
        data: {
          id: id,
          nombre: `id turno:${id} ` || '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: `Error al actualizar turno`,
        error,
      });
    }
  }

  async remove(id: number, idUser: number) {
    try {
      //actualizamos
      await this.turnosRepository.update(id, { estatus: 0 });

      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Turnos',
        `Se elimino turno con ID: ${id}`,
        'UPDATE',
        `UPDATE Turnos WHERE id=${id}`,
        idUser,
        14,
      );

      // ----- Api response -----
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Se elimino turno correctamente',
        data: {
          id: id,
          nombre: `id turno:${id} ` || '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: `Error al eliminar turno`,
        error,
      });
    }
  }
}
