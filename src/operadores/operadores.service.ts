import { Injectable } from '@nestjs/common';
import { CreateOperadoreDto } from './dto/create-operadore.dto';
import { UpdateOperadoreDto } from './dto/update-operadore.dto';

@Injectable()
export class OperadoresService {
  create(createOperadoreDto: CreateOperadoreDto) {
    return 'This action adds a new operadore';
  }

  findAll() {
    return `This action returns all operadores`;
  }

  findOne(id: number) {
    return `This action returns a #${id} operadore`;
  }

  update(id: number, updateOperadoreDto: UpdateOperadoreDto) {
    return `This action updates a #${id} operadore`;
  }

  remove(id: number) {
    return `This action removes a #${id} operadore`;
  }
}
