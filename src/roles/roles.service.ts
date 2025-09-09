import { HttpException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Roles } from 'src/entities/Roles';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { ApiResponseCommon } from 'src/common/ApiResponse';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Roles)
    private readonly rolesRepository: Repository<Roles>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  create(createRoleDto: CreateRoleDto) {
    return 'This action adds a new role';
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
          if (!permiso) throw new NotFoundException('Permiso no encontrado');
    
          return permiso;
        } catch (error) {
          if (error instanceof HttpException) {
            throw error;
          }
          throw new InternalServerErrorException(
            `Error al obtener el rol`,
          );
        }
  }

  update(id: number, updateRoleDto: UpdateRoleDto) {
    return `This action updates a #${id} role`;
  }

  remove(id: number) {
    return `This action removes a #${id} role`;
  }
}
