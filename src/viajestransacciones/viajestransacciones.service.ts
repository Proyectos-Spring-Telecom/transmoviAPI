import { Injectable } from '@nestjs/common';
import { CreateViajestransaccioneDto } from './dto/create-viajestransaccione.dto';
import { UpdateViajestransaccioneDto } from './dto/update-viajestransaccione.dto';

@Injectable()
export class ViajestransaccionesService {
  create(createViajestransaccioneDto: CreateViajestransaccioneDto) {
    return 'This action adds a new viajestransaccione';
  }

  findAll() {
    return `This action returns all viajestransacciones`;
  }

  findOne(id: number) {
    return `This action returns a #${id} viajestransaccione`;
  }

  update(id: number, updateViajestransaccioneDto: UpdateViajestransaccioneDto) {
    return `This action updates a #${id} viajestransaccione`;
  }

  remove(id: number) {
    return `This action removes a #${id} viajestransaccione`;
  }
}
