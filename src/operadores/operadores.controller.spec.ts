import { Test, TestingModule } from '@nestjs/testing';
import { OperadoresController } from './operadores.controller';
import { OperadoresService } from './operadores.service';

describe('OperadoresController', () => {
  let controller: OperadoresController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OperadoresController],
      providers: [OperadoresService],
    }).compile();

    controller = module.get<OperadoresController>(OperadoresController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
