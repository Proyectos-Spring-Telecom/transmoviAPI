import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateModuloDto } from './dto/create-modulo.dto';
import { UpdateModuloDto } from './dto/update-modulo.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Modulos } from 'src/entities/Modulos';
import { Repository } from 'typeorm';
import { Permisos } from 'src/entities/Permisos';

@Injectable()
export class ModulosService {

  constructor(@InjectRepository(Permisos) private readonly permisosRepository: Repository<Permisos>,@InjectRepository(Modulos) private readonly moduloRepository: Repository<Modulos>) { }

  async create(createModuloDto: CreateModuloDto) {
    try {
      const create = await this.moduloRepository.create(createModuloDto);
      const saved = await this.moduloRepository.save(create);
      return saved;
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  async findAll() {
    try {
      return await this.moduloRepository.find({
        relations:['permisos']
      });
    } catch (error) {
      throw new BadRequestException(error);

    }
  }

  async findOne(id: number) {
    try {
      const exist = await this.moduloRepository.findOne({ where: { id: id } })
      if (!exist) throw new NotFoundException('Módulo no encontrado')
      return exist;
    } catch (error) {
      throw new BadRequestException(error);

    }
  }

  async update(updateModuloDto: UpdateModuloDto) {
    try {
      const exist = await this.moduloRepository.findOne({ where: { id: updateModuloDto.id } })
      if (!exist) throw new NotFoundException('Módulo no encontrado')
      const update = await this.moduloRepository.update(updateModuloDto.id, updateModuloDto);
      return update;
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  async deleteModulo(id: number, req): Promise<any> {
        const modulo = await this.moduloRepository.findOne({ where: { id: id } });

        if (!modulo) throw new NotFoundException('Modulo no encontrado');
        if (modulo.estatus === 1) {
            modulo.estatus = 0;
            await this.moduloRepository.update(id, modulo);

            const permisos = await this.permisosRepository.find({ where: { idModulo: id } })
            if (permisos.length > 0) {
                for (const permiso of permisos) {
                    permiso.estatus = 0;
                    await this.permisosRepository.update(permiso.id, permiso)
                }
            }
        } else {
            modulo.estatus = 1;
            await this.moduloRepository.update(id, modulo);
            const permisos = await this.permisosRepository.find({ where: { idModulo: id } })
            if (permisos.length > 0) {
                for (const permiso of permisos) {
                    permiso.estatus = 1;
                    await this.permisosRepository.update(permiso.id, permiso)
                }
            }
        }

        return modulo;
    }
}
