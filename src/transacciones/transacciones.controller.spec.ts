import { Test, TestingModule } from '@nestjs/testing';
import { TransaccionesController } from './transacciones.controller';
import { TransaccionesService } from './transacciones.service';

describe('TransaccionesController', () => {
  let controller: TransaccionesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransaccionesController],
      providers: [TransaccionesService],
    }).compile();

    controller = module.get<TransaccionesController>(TransaccionesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
