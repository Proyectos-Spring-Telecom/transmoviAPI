import { Test, TestingModule } from '@nestjs/testing';
import { MonederosController } from './monederos.controller';
import { MonederosService } from './monederos.service';

describe('MonederosController', () => {
  let controller: MonederosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MonederosController],
      providers: [MonederosService],
    }).compile();

    controller = module.get<MonederosController>(MonederosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
