import { Injectable } from '@nestjs/common';
import { CreateMonederoDto } from './dto/create-monedero.dto';
import { UpdateMonederoDto } from './dto/update-monedero.dto';

@Injectable()
export class MonederosService {
  create(createMonederoDto: CreateMonederoDto) {
    return 'This action adds a new monedero';
  }

  findAll() {
    return `This action returns all monederos`;
  }

  findOne(id: number) {
    return `This action returns a #${id} monedero`;
  }

  update(id: number, updateMonederoDto: UpdateMonederoDto) {
    return `This action updates a #${id} monedero`;
  }

  remove(id: number) {
    return `This action removes a #${id} monedero`;
  }
}
