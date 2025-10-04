import { Injectable } from '@nestjs/common';
import { CreateViajestransaccioneDto } from './dto/create-viajestransaccione.dto';

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

}
