import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateModuloDto } from './dto/create-modulo.dto';
import { UpdateModuloDto } from './dto/update-modulo.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Modulos } from 'src/entities/Modulos';
import { Repository } from 'typeorm';
import { Permisos } from 'src/entities/Permisos';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { UpdateModulosEstatusDto } from './dto/update-modulo-estatus.dto';
import { ApiResponseCommon } from 'src/common/ApiResponse';

@Injectable()
export class ModulosService {
  constructor(
    @InjectRepository(Permisos)
    private readonly permisosRepository: Repository<Permisos>,
    @InjectRepository(Modulos)
    private readonly moduloRepository: Repository<Modulos>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  async create(createModuloDto: CreateModuloDto, idUser: string) {
    try {
      const create = await this.moduloRepository.create(createModuloDto);
      const saved = await this.moduloRepository.save(create);
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Modulos',
        `Se creó un modulos con nombre: ${createModuloDto.nombre}`,
        'CREATE',
        `INSERT INTO Modulos (...) VALUES (...) -> nombre: ${createModuloDto.nombre} descipcion: ${createModuloDto.descripcion}`,
        Number(idUser),
      );
      return saved;
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  async findAllList(): Promise<ApiResponseCommon> {
    try {
      const modulos = await this.moduloRepository.find({
        relations: ['permisos'],
      });
      const result: ApiResponseCommon = {
        data: modulos,

        message: 'Módulos obtenidos correctamente',
      };
      return result;
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  async findAll(page: number, limit: number): Promise<ApiResponseCommon> {
    try {
      const [data, total] = await this.moduloRepository.findAndCount({
        relations: ['permisos'],
        skip: (page - 1) * limit,
        take: limit,
      });

      const result: ApiResponseCommon = {
        data,
        paginated: {
          total: Math.ceil(total / limit),
          page,
          limit,
        },
        message: 'Módulos obtenidos correctamente',
      };
      return result;
    } catch (error) {
      throw new BadRequestException(error.message || 'Error fetching data');
    }
  }

  async findOne(id: number) {
    try {
      const exist = await this.moduloRepository.findOne({ where: { id: id } });
      if (!exist) throw new NotFoundException('Módulo no encontrado');
      
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  async update(updateModuloDto: UpdateModuloDto, idUser: string) {
    try {
      const exist = await this.moduloRepository.findOne({
        where: { id: updateModuloDto.id },
      });
      if (!exist) throw new NotFoundException('Módulo no encontrado');
      const update = await this.moduloRepository.update(
        updateModuloDto.id,
        updateModuloDto,
      );
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Modulos',
        `Se creó un modulos con modulo: ${updateModuloDto.nombre}`,
        'UPDATE',
        `UPDATE INTO Modulos (...) VALUES (...) -> nombre: ${updateModuloDto.nombre} descipcion: ${updateModuloDto.descripcion}`,
        Number(idUser),
      );
      return await this.moduloRepository.findOne({where:{id:updateModuloDto.id}});
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  async updateModulosStatus(
    id: number,
    idUser: string,
    updateModulosEstatusDto: UpdateModulosEstatusDto,
  ) {
    try {
      const modulo = await this.moduloRepository.findOne({ where: { id: id } });
      if (!modulo) {
        throw new NotFoundException('Modulo no encontrado');
      }
      const Estatus = updateModulosEstatusDto.Estatus;
      await this.moduloRepository.update(id, { estatus: Estatus });
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Modulos',
        `Se cambio del modulo ${modulo.nombre} con id: ${id} a estatus: ${Estatus}`,
        'UPDATE',
        `UPDATE Modulos SET Estatus = ${Estatus} WHERE id = ${id}`,
        Number(idUser),
      );
      return {
        message: `Modulo con id: ${id} su estatus fue actualizado a ${Estatus}`,
        Estatus: Number(Estatus),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al cambiar estatus del modulos con id: ${id}`,
      );
    }
  }

  async deleteModulo(id: number, req): Promise<any> {
    const modulo = await this.moduloRepository.findOne({ where: { id: id } });

    if (!modulo) throw new NotFoundException('Modulo no encontrado');
    if (modulo.estatus === 1) {
      modulo.estatus = 0;
      await this.moduloRepository.update(id, modulo);

      const permisos = await this.permisosRepository.find({
        where: { id: id },
      });
      if (permisos.length > 0) {
        for (const permiso of permisos) {
          permiso.estatus = 0;
          await this.permisosRepository.update(permiso.id, permiso);
        }
      }
    } else {
      modulo.estatus = 1;
      await this.moduloRepository.update(id, modulo);
      const permisos = await this.permisosRepository.find({
        where: { idModulo: id },
      });
      if (permisos.length > 0) {
        for (const permiso of permisos) {
          permiso.estatus = 1;
          await this.permisosRepository.update(permiso.id, permiso);
        }
      }
    }
    //-----Registro en la bitacora-----
    await this.bitacoraLogger.logToBitacora(
      'Modulos',
      `Se eliminó el modulos con ID: ${id}`,
      'UPDATE',
      `UPDATE FROM Modulos WHERE Id=${id}`,
      req.user.userId,
    );
    return `Modulo fue eliminado exitosamente`;
  }
}
