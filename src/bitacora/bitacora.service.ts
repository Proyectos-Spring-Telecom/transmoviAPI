import { Injectable } from '@nestjs/common';
import { CreateBitacoraDto } from './dto/create-bitacora.dto';
import { UpdateBitacoraDto } from './dto/update-bitacora.dto';

@Injectable()
export class BitacoraService {
  create(createBitacoraDto: CreateBitacoraDto) {
    return 'This action adds a new bitacora';
  }

  findAll() {
    return `This action returns all bitacora`;
  }

  findOne(id: number) {
    return `This action returns a #${id} bitacora`;
  }

  update(id: number, updateBitacoraDto: UpdateBitacoraDto) {
    return `This action updates a #${id} bitacora`;
  }

  remove(id: number) {
    return `This action removes a #${id} bitacora`;
  }
}
