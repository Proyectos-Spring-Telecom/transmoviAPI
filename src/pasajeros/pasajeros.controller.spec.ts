import { Test, TestingModule } from '@nestjs/testing';
import { PasajerosController } from './pasajeros.controller';
import { PasajerosService } from './pasajeros.service';

describe('PasajerosController', () => {
  let controller: PasajerosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PasajerosController],
      providers: [PasajerosService],
    }).compile();

    controller = module.get<PasajerosController>(PasajerosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
