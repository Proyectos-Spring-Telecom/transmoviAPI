import { Injectable } from '@nestjs/common';
import { CreateViajesconteoDto } from './dto/create-viajesconteo.dto';

@Injectable()
export class ViajesconteosService {
  create(createViajesconteoDto: CreateViajesconteoDto) {
    return 'This action adds a new viajesconteo';
  }

  findAllList() {
    return `This action returns all viajesconteos`;
  }

  findAll() {
    return `This action returns all viajesconteos`;
  }

  findOne(id: number) {
    return `This action returns a #${id} viajesconteo`;
  }

}
