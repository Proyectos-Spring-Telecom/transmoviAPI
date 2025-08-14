import { Test, TestingModule } from '@nestjs/testing';
import { DispositivosController } from './dispositivos.controller';
import { DispositivosService } from './dispositivos.service';

describe('DispositivosController', () => {
  let controller: DispositivosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DispositivosController],
      providers: [DispositivosService],
    }).compile();

    controller = module.get<DispositivosController>(DispositivosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
