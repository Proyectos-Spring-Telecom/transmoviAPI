import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateRolDto } from './dto/create-rol.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Roles } from 'src/entities/Roles';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { UpdateRolEstatusDto } from './dto/update-rol.dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Roles)
    private readonly rolesRepository: Repository<Roles>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  async create(
    idUser: string,
    createRoleDto: CreateRolDto,
  ): Promise<ApiCrudResponse> {
    try {
      const rol = await this.rolesRepository.find({
        where: { nombre: createRoleDto.nombre },
      });
      console.log(rol.length)
      if (rol.length !== 0) {
        throw new BadRequestException('El rol ya existe');
      }
      const newRol = await this.rolesRepository.create(createRoleDto);
      const rolSave = await this.rolesRepository.save(newRol);
      //-----Registro en la bitacora-----
      await this.bitacoraLogger.logToBitacora(
        'Roles',
        `Se creó un rol con nombre: ${rolSave.nombre}`,
        'CREATE',
        `INSERT INTO Roles (...) VALUES (...) -> nombre:  ${rolSave.nombre} descripcion: ${rolSave.descripcion}`,
        Number(idUser),
        3,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Rol creado correctamente',
        data: {
          id: rolSave.id,
          nombre: `${rolSave.nombre} ${rolSave.descripcion} ` || '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al crear rol',
        error,
      });
    }
  }

  async findAll(page: number, limit: number): Promise<ApiResponseCommon> {
    const [data, total] = await this.rolesRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
    });

    const result: ApiResponseCommon = {
      data,
      paginated: {
        total: Math.ceil(total / limit),
        page,
        limit: total,
      },
      message: 'Roles obtenidos correctamente',
    };

    return result;
  }

  async findAllList(): Promise<ApiResponseCommon> {
    const permisos = await this.rolesRepository.find();
    const result: ApiResponseCommon = {
      data: permisos,
      message: 'Roles obtenidos correctamente',
    };
    return result;
  }

  async findOne(id: number) {
    try {
      const permiso = await this.rolesRepository.findOne({
        where: { id: id },
      });
      if (!permiso) throw new NotFoundException('Rol no encontrado');

      return permiso;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error al obtener el rol`);
    }
  }

  async update(
    id: number,
    idUser: string,
    updateRoleDto: UpdateRoleDto,
  ): Promise<ApiCrudResponse> {
    try {
      const rol = await this.rolesRepository.findOne({ where: { id: id } });
      if (!rol) throw new NotFoundException('Rol no encontrado');

      //actualizamos el rol
      await this.rolesRepository.update(id, updateRoleDto);

      // --- Registro en la bitácora ---
      await this.bitacoraLogger.logToBitacora(
        'Roles',
        `Se actualizo el rol: ${updateRoleDto?.nombre}`,
        'UPDATE',
        `UPDATE Roles SET... WHERE Id=${id} VALUES ('${updateRoleDto?.nombre}', '${updateRoleDto?.descripcion}')`,
        Number(idUser),
        3,
      );
      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Rol actualizado correctamente',
        data: {
          id: id,
          nombre:
            `${updateRoleDto?.nombre} ${updateRoleDto?.descripcion} ` || '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al actualizar rol',
        error,
      });
    }
  }

  async updateEstatus(
    id: number,
    idUser: string,
    updateRolEstatusDto: UpdateRolEstatusDto,
  ): Promise<ApiCrudResponse> {
    try {
      const rol = await this.rolesRepository.findOne({
        where: { id: id },
      });
      if (!rol) throw new NotFoundException('Rol no encontrado');
      //Actualiza
      const rolResult = await this.rolesRepository.update(id, {
        estatus: updateRolEstatusDto.estatus,
      });
      // --- Registro en la bitácora ---
      await this.bitacoraLogger.logToBitacora(
        'Roles',
        `Se actualizo a estatus ${updateRolEstatusDto.estatus} del rol: ${rol.nombre}`,
        'UPDATE',
        `UPDATE Roles SET Estatus=${updateRolEstatusDto.estatus} WHERE Id=${id}`,
        Number(idUser),
        3,
      );
      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Estatus rol creado correctamente',
        estatus: { estatus: updateRolEstatusDto.estatus },
        data: {
          id: id,
          nombre: `${rol.nombre} ${rol.descripcion} ` || '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al cambiar estatus rol',
        error,
      });
    }
  }

  async remove(id: number, idUser: string) {
    try {
      const rol = await this.rolesRepository.findOne({ where: { id: id } });
      if (!rol) throw new NotFoundException('Rol no encontrado');

      //Desahabilitamos el rol
      await this.rolesRepository.update(id, { estatus: 0 });

      // --- Registro en la bitácora ---
      await this.bitacoraLogger.logToBitacora(
        'Roles',
        `Se desactivo el rol: ${rol.nombre}`,
        'UPDATE',
        `UPDATE Rols SET Estatus=${0} WHERE Id=${id}`,
        Number(idUser),
        3,
      );
      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Rol eliminado correctamente',
        data: {
          id: id,
          nombre: `${rol.nombre} ${rol.descripcion} ` || '',
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al eliminar rol',
        error,
      });
    }
  }
}
