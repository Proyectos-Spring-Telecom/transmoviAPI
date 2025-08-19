import { Injectable } from '@nestjs/common';
import { CreateTransaccioneDto } from './dto/create-transaccione.dto';
import { UpdateTransaccioneDto } from './dto/update-transaccione.dto';
import { UpdateTransaccionEstatusDto } from './dto/update-transaccione-status.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transacciones } from 'src/entities/Transacciones';

@Injectable()
export class TransaccionesService {
  constructor(
    @InjectRepository(Transacciones)
    private readonly transaccioneRepository: Repository<Transacciones>,
  ) {}
  async createTransaccion(createTransaccioneDto: CreateTransaccioneDto) {
    return 'This action adds a new transaccione';
  }

  async findAllTransacciones() {
    return `This action returns all transacciones`;
  }

  async findOneTransaccion(id: number) {
    return `This action returns a #${id} transaccione`;
  }

  async updateTransaccionEstatus(
    id: number,
    updateTransaccionEstatusDto: UpdateTransaccionEstatusDto,
  ) {
    return `This action updates a #${id} transaccione`;
  }

  async updateTransaccions(
    id: number,
    updateTransaccioneDto: UpdateTransaccioneDto,
  ) {
    return `This action updates a #${id} transaccione`;
  }
  //Eliminar 
  async removeTransaccion(id: number) {
    return `This action removes a #${id} transaccione`;
  }
}
