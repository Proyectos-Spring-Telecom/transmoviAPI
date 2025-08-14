import { Injectable } from '@nestjs/common';
import { CreatePasajeroDto } from './dto/create-pasajero.dto';
import { UpdatePasajeroDto } from './dto/update-pasajero.dto';

@Injectable()
export class PasajerosService {
  create(createPasajeroDto: CreatePasajeroDto) {
    return 'This action adds a new pasajero';
  }

  findAll() {
    return `This action returns all pasajeros`;
  }

  findOne(id: number) {
    return `This action returns a #${id} pasajero`;
  }

  update(id: number, updatePasajeroDto: UpdatePasajeroDto) {
    return `This action updates a #${id} pasajero`;
  }

  remove(id: number) {
    return `This action removes a #${id} pasajero`;
  }
}
