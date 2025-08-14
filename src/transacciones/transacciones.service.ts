import { Injectable } from '@nestjs/common';
import { CreateTransaccioneDto } from './dto/create-transaccione.dto';
import { UpdateTransaccioneDto } from './dto/update-transaccione.dto';

@Injectable()
export class TransaccionesService {
  create(createTransaccioneDto: CreateTransaccioneDto) {
    return 'This action adds a new transaccione';
  }

  findAll() {
    return `This action returns all transacciones`;
  }

  findOne(id: number) {
    return `This action returns a #${id} transaccione`;
  }

  update(id: number, updateTransaccioneDto: UpdateTransaccioneDto) {
    return `This action updates a #${id} transaccione`;
  }

  remove(id: number) {
    return `This action removes a #${id} transaccione`;
  }
}
