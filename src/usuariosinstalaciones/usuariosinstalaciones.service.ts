import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateUsuariosInstalacionesDto } from './dto/create-usuariosinstalacione.dto';
import { UpdateUsuariosinstalacioneDto } from './dto/update-usuariosinstalacione.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { UsuariosInstalaciones } from 'src/entities/UsuariosInstalaciones';
import { Repository } from 'typeorm';
import { Instalaciones } from 'src/entities/Instalaciones';
import { Usuarios } from 'src/entities/Usuarios';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { ApiCrudResponse } from 'src/common/ApiResponse';

@Injectable()
export class UsuariosinstalacionesService {
  constructor(
    @InjectRepository(UsuariosInstalaciones)
    private readonly usuariosinstalacionesRepository: Repository<UsuariosInstalaciones>,
    @InjectRepository(Instalaciones)
    private readonly instalacionesRepository: Repository<Instalaciones>,
    @InjectRepository(Usuarios)
    private readonly usuariosRepository: Repository<Usuarios>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  async create(
    idUser: string,
    createUsuariosInstalacionesDto: CreateUsuariosInstalacionesDto,
  ) {
    try {
      const usuario = await this.usuariosRepository.findOne({
        where: {
          id: createUsuariosInstalacionesDto.idUsuario,
        },
        select: { idCliente: true },
      });
      if (!usuario) {
        throw new NotFoundException(
          `Usuario con ID ${createUsuariosInstalacionesDto.idUsuario} no encontrado`,
        );
      }
      const idUsuarioCliente = usuario.idCliente;

      for (const i of createUsuariosInstalacionesDto.idsInstalaciones) {
        const region = await this.instalacionesRepository.findOne({
          where: { id: i },
          select: { idCliente: true },
        });
        if (!region) {
          throw new NotFoundException(`Región con ID ${i} no encontrada`);
        }
        if (idUsuarioCliente !== region.idCliente) {
          throw new BadRequestException(
            `La región ${i} no pertenece al mismo cliente que el usuario`,
          );
        }
      }

      // Crear y guardar permisos para usuarios en instalaciones
    if (createUsuariosInstalacionesDto.idsInstalaciones.length > 0) {
      const usuariosinstalacionesPermisos =
        createUsuariosInstalacionesDto.idsInstalaciones.map((idInstalacion) =>
          this.usuariosinstalacionesRepository.create({
            idUsuario: createUsuariosInstalacionesDto.idUsuario,
            idInstalacion: idInstalacion,
          }),
        );

      await this.usuariosinstalacionesRepository.save(
        usuariosinstalacionesPermisos,
      );
    }

    // --- Registro en la bitácora ---
    await this.bitacoraLogger.logToBitacora(
      'UsuariosInstalaciones',
      `Se crearon permisos para usuario: ${createUsuariosInstalacionesDto.idUsuario} con instalaciones: ${createUsuariosInstalacionesDto.idsInstalaciones.join(', ')}`,
      'CREATE',
      `INSERT INTO UsuariosInstalaciones (IdUsuario, IdInstalacion)`,
      Number(idUser),
      8,
    );

    // Api response
    const result: ApiCrudResponse = {
      status: 'success',
      message: 'Permisos de instalaciones creados correctamente',
      data: {
        id: Number(createUsuariosInstalacionesDto.idUsuario),
        nombre:
        `Id Usuario: ${createUsuariosInstalacionesDto.idUsuario} Id Region: ${createUsuariosInstalacionesDto.idsInstalaciones} ` ||
            '',
      },
    };
    return result;

    } catch (error) {
      if (error instanceof HttpException) {
      throw error;
    }
    throw new InternalServerErrorException(
      `Error al crear permisos de instalaciones para el usuario ${createUsuariosInstalacionesDto.idUsuario}`,
    );
    }
  }

  findAll() {
    return `This action returns all usuariosinstalaciones`;
  }

  findOne(id: number) {
    return `This action returns a #${id} usuariosinstalacione`;
  }

  update(
    id: number,
    updateUsuariosinstalacioneDto: UpdateUsuariosinstalacioneDto,
  ) {
    return `This action updates a #${id} usuariosinstalacione`;
  }

  remove(id: number) {
    return `This action removes a #${id} usuariosinstalacione`;
  }
}
