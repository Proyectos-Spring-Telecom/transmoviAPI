import { Injectable } from '@nestjs/common';
import { CreateModuloDto } from './dto/create-modulo.dto';
import { UpdateModuloDto } from './dto/update-modulo.dto';

@Injectable()
export class ModulosService {
  create(createModuloDto: CreateModuloDto) {
    return 'This action adds a new modulo';
  }

  findAll() {
    return `This action returns all modulos`;
  }

  findOne(id: number) {
    return `This action returns a #${id} modulo`;
  }

  update(id: number, updateModuloDto: UpdateModuloDto) {
    return `This action updates a #${id} modulo`;
  }

  remove(id: number) {
    return `This action removes a #${id} modulo`;
  }
}
