import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { CreateCatTipoCombustibleDto } from './dto/create-catcombustible.dto';
import { UpdateCatcombustibleDto } from './dto/update-catcombustible.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { CatTipoCombustible } from 'src/entities/CatTipoCombustible';
import { Repository } from 'typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { ApiResponseCommon } from 'src/common/ApiResponse';

@Injectable()
export class CatcombustibleService {
  constructor(
    @InjectRepository(CatTipoCombustible)
    private readonly catPasajeroRepository: Repository<CatTipoCombustible>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  create(createCatTipoCombustibleDto: CreateCatTipoCombustibleDto) {
    try {
      return 'en proceso';
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException(
        'Se produjo un error al crear tipo de combustible.',
      );
    }
  }

  // ========================================
  // 🔹 OBTENER UN LISTADO DE TIPOS COMBUSTIBLES
  // ========================================
  async findAllList() {
    try {
      const catTipoCombustible = await this.catPasajeroRepository.query(
        `
SELECT 
	ctc.Id AS id,
    ctc.Nombre AS nombre
FROM CatTipoCombustible ctc;       
            `,
      );

      //Forzamos los BigInt a number
      const data = catTipoCombustible.map((item) => ({
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
        'Se produjo un error al obtener el listado de tipos de combustible.',
      );
    }
  }

  findAll() {
    return `This action returns all catcombustible`;
  }

  findOne(id: number) {
    return `This action returns a #${id} catcombustible`;
  }

  update(id: number, updateCatcombustibleDto: UpdateCatcombustibleDto) {
    return `This action updates a #${id} catcombustible`;
  }

  remove(id: number) {
    return `This action removes a #${id} catcombustible`;
  }
}
