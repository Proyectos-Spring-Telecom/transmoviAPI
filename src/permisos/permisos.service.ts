import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreatePermisoDto } from './dto/create-permiso.dto';
import { UpdatePermisoDto } from './dto/update-permiso.dto';
import { Permisos } from 'src/entities/Permisos';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { UsuarioPermisos } from 'src/entities/UsuarioPermisos';
import { plainToInstance } from 'class-transformer';
import { ExposePermisoDto } from './dto/expose-permiso.dto';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { UpdatePermisoEstatusDto } from './dto/update-permiso-estatus.dto';

@Injectable()
export class PermisosService {
  constructor(
    @InjectRepository(Permisos)
    private readonly permisoRepository: Repository<Permisos>,
    @InjectRepository(UsuarioPermisos)
    private readonly usuarioPermiso: Repository<UsuarioPermisos>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  //Obtener todos los permisos con paginado
  async findAll(page: number = 1, limit: number = 10) {
    const [permisos, total] = await this.permisoRepository.findAndCount({
      relations: ['modulo'],
      skip: (page - 1) * limit,
      take: limit,
    });
    const permisoExpuesto = plainToInstance(ExposePermisoDto, permisos, {
      excludeExtraneousValues: true,
    });
    return {
      data: permisoExpuesto,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  //Obtener todos los permisos
  async findAllList(): Promise<ExposePermisoDto[]> {
    try {
      const permisos = await this.permisoRepository.find({
        relations: ['modulo'],
      });
      const permisoExpuesto = plainToInstance(ExposePermisoDto, permisos, {
        excludeExtraneousValues: true,
      });
      return permisoExpuesto;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al obtener todos los permisos`,
      );
    }
  }

  //Obtener permiso by ID
  async findOne(id: number): Promise<ExposePermisoDto> {
    try {
      const permiso = await this.permisoRepository.findOne({
        where: { id },
        relations: ['modulo'],
      });
      if (!permiso) throw new NotFoundException('Permiso no encontrado');
      const permisoExpuesto = plainToInstance(ExposePermisoDto, permiso, {
        excludeExtraneousValues: true,
      });
      return permisoExpuesto;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al obtener el permiso por ID`,
      );
    }
  }

  async createPermiso(createPermiso: CreatePermisoDto, idUsuario) {
    try {
      const create = this.permisoRepository.create(createPermiso);
      const savedPermiso = await this.permisoRepository.save(create);
      const asignar = {
        idPermiso: savedPermiso.id,
        idUsuario: idUsuario,
      };
      const permiso = await this.usuarioPermiso.create(asignar);
      const asignarRoot = {
        idPermiso: savedPermiso.id,
        idUsuario: 24, //Se asigna al usuario supremo
      };
      const permisoRoot = await this.usuarioPermiso.create(asignarRoot);
      this.usuarioPermiso.save(permisoRoot);
      // --- Registro en la bitácora ---
      await this.bitacoraLogger.logToBitacora(
        'Permisos',
        `Se creó el permiso: ${savedPermiso.nombre}`,
        'CREATE',
        `INSERT INTO Permisos (Nombre, Descripcion) VALUES ('${savedPermiso.nombre}', '${savedPermiso.descripcion}')`,
        Number(idUsuario),
      );
      return `Permiso creado exitosamente`;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error al crear permisos`);
    }
  }

  async updateEstatus(
    id: number,
    updatePermisoEstatusDto: UpdatePermisoEstatusDto,
  ) {
    try {
      console.log('Id: ',id)
      const permiso = await this.permisoRepository.findOne({ where: { id } });
      if (!permiso) throw new NotFoundException('Permiso no encontrado');
      //Actualiza
      const result = await this.permisoRepository.update(id, {
        estatus:updatePermisoEstatusDto.estatus
      });
      console.log(result)
      // --- Registro en la bitácora ---
      await this.bitacoraLogger.logToBitacora(
        'Permisos',
        `Se actualizo a estatus ${updatePermisoEstatusDto.estatus} del permiso: ${permiso.nombre}`,
        'UPDATE',
        `UPDATE Permiso SET Estatus=${updatePermisoEstatusDto.estatus} WHERE Id=${id}`,
        Number(id),
      );
      return `Estatus permiso con ${id} actualizado exitosamente`;
    } catch (error) {
      return error;
    }
  }

  async update(updatePermiso: UpdatePermisoDto) {
    try {
      const id = updatePermiso.id;

      const permisoActualizar = {
        nombre: updatePermiso.nombre,
        descripcion: updatePermiso.descripcion,
        estatus: updatePermiso.estatus,
        idModulo: updatePermiso.idModulo,
      };
      const permiso = await this.permisoRepository.findOne({ where: { id } });
      if (!permiso) throw new NotFoundException('Permiso no encontrado');
      const result = await this.permisoRepository.update(id, permisoActualizar);
      // --- Registro en la bitácora ---
      await this.bitacoraLogger.logToBitacora(
        'Permisos',
        `Se actualizo: ${permisoActualizar.nombre}`,
        'UPDATE',
        `UPDATE Permisos SET... WHERE Id=${id} VALUES ('${permisoActualizar.nombre}', '${permisoActualizar.descripcion}')`,
        Number(id),
      );
      return `Permiso con ${id} actualizado exitosamente`;
    } catch (error) {
      return error;
    }
  }

  async remove(id: number) {
    try {
      const permiso = await this.permisoRepository.findOne({ where: { id } });
      if (!permiso) throw new NotFoundException('Permiso no encontrado');
      //Desahabilitamos el permiso
      await this.permisoRepository.update(id, { estatus: 0 });
      // --- Registro en la bitácora ---
      await this.bitacoraLogger.logToBitacora(
        'Permisos',
        `Se desactivo el permiso: ${permiso.nombre}`,
        'UPDATE',
        `UPDATE Monederos SET Estatus=${0} WHERE Id=${id}`,
        Number(id),
      );
      return `Permiso con #${id} eliminado`;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error al eliminar permisos`);
    }
  }
  async obtenerPermisosAgrupados(idUsuario): Promise<any[]> {
    try {
      // Consulta SQL cruda
      const query = `
            SELECT 
            DISTINCT UsuariosPermisos.IdPermiso,
              Modulos.Id AS IdModulo,
              Modulos.Nombre AS NombreModulo,
              Permisos.Id AS PermisoId,
              Permisos.Nombre AS PermisoNombre,
              Permisos.Descripcion AS PermisoDescripcion
            FROM 
           UsuariosPermisos
            INNER JOIN 
              Permisos ON UsuariosPermisos.IdPermiso = Permisos.Id
            INNER JOIN 
              Modulos ON Permisos.IdModulo = Modulos.Id
            WHERE 
              UsuariosPermisos.IdUsuario ='${idUsuario}'`;

      // Ejecutar la consulta
      const results = await this.permisoRepository.query(query);

      if (!Array.isArray(results)) {
        throw new Error('El resultado de la consulta no es un array');
      }

      // Agrupar resultados
      const permisosAgrupados = results.reduce((result, item) => {
        let moduloExistente = result.find(
          (mod) => mod.IdModulo === item.IdModulo,
        );

        if (!moduloExistente) {
          moduloExistente = {
            IdModulo: item.IdModulo,
            NombreModulo: item.NombreModulo,
            Permisos: [],
          };
          result.push(moduloExistente);
        }

        moduloExistente.Permisos.push({
          Id: item.PermisoId,
          Nombre: item.PermisoNombre,
          Descripcion: item.PermisoDescripcion,
        });

        return result;
      }, []);

      return permisosAgrupados;
    } catch (error) {
      console.error('Error al obtener permisos agrupados:', error);
      throw error; // Lanzar el error para manejarlo en la capa superior si es necesario
    }
  }
}
