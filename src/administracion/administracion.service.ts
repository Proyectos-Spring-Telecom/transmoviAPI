import { Injectable } from '@nestjs/common';

@Injectable()
export class AdministracionService {

  findAll() {
    return `This action returns all administracion`;
  }

  findOne(id: number) {
    return `This action returns a #${id} administracion`;
  }

  remove(id: number) {
    return `This action removes a #${id} administracion`;
  }
}
