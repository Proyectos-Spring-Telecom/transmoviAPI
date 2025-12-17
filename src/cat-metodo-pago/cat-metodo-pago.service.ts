import { BadRequestException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiResponseCommon } from 'src/common/ApiResponse';
import { CatMetodoPago } from 'src/entities/CatMetodoPago';
import { Repository } from 'typeorm';

@Injectable()
export class CatMetodoPagoService {

  constructor(
    @InjectRepository(CatMetodoPago)
    private readonly catMetodoPagoRepository: Repository<CatMetodoPago>,
  ) { }

  async findAll(): Promise<ApiResponseCommon> {
    try {

      const catMetodoPago = await this.catMetodoPagoRepository.find()

      if (catMetodoPago.length === 0) {
        throw new NotFoundException(`No fue posible encontrar el listado de metodos de pago.`)
      }
      //Forzamos los BigInt a number
      const data = catMetodoPago.map((item) => ({
        ...item,
        id: Number(item.id),
      }));

      const result: ApiResponseCommon = {
        data: data,
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException(
        'Se produjo un error al obtener el listado de metodos de pagos.',
      );
    }
  }

}
