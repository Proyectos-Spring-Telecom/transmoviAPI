import { Injectable } from '@nestjs/common';

@Injectable()
export class DashboardService {

  dashboardkpi(filtro: number, cliente: number) {
    try {
      
    } catch (error) {

    }
  }

  findOne(id: number) {
    return `This action returns a #${id} dashboard`;
  }



  remove(id: number) {
    return `This action removes a #${id} dashboard`;
  }
}
