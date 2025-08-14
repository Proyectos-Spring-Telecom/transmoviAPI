import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePermisoDto } from './dto/create-permiso.dto';
import { UpdatePermisoDto } from './dto/update-permiso.dto';
import { Permisos } from 'src/entities/Permisos';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class PermisosService {
  constructor(@InjectRepository(Permisos) private readonly permisoRepository: Repository<Permisos>,) { }
  async create(createPermisoDto: CreatePermisoDto) {
    return 'This action adds a new permiso';
  }

  async findAll(page: number = 1, limit: number = 10) {
    const [permisos, total] = await this.permisoRepository.findAndCount({
      relations: ['modulo'],
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: permisos,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  async findAllList(page: number = 1, limit: number = 10) {
    const permisos = await this.permisoRepository.find({
      relations: ['modulo'],

    });

    return permisos;
  }


  async findOne(id: number) {
    const permiso = await this.permisoRepository.findOne({ where: { id:id } });
    if (!permiso) throw new NotFoundException('Permiso no encontrado');
    return permiso;
  }

  async update(id: number, updatePermisoDto: UpdatePermisoDto) {
    return `This action updates a #${id} permiso`;
  }

  async remove(id: number) {
    return `This action removes a #${id} permiso`;
  }
}
