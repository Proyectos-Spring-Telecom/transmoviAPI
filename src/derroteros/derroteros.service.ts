import { HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateDerroteroDto } from './dto/create-derrotero.dto';
import { UpdateDerroteroDto } from './dto/update-derrotero.dto';

@Injectable()
export class DerroterosService {
  create(createDerroteroDto: CreateDerroteroDto) {
    try {
      //const {recorridoDetallado: ...puntos } = createDerroteroDto.recorridoDetallado
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al crear derrotero',
        error,
      });
    }
  }

  findAll() {
    return `This action returns all derroteros`;
  }

  findOne(id: number) {
    return `This action returns a #${id} derrotero`;
  }

  update(id: number, updateDerroteroDto: UpdateDerroteroDto) {
    return `This action updates a #${id} derrotero`;
  }

  remove(id: number) {
    return `This action removes a #${id} derrotero`;
  }
}
