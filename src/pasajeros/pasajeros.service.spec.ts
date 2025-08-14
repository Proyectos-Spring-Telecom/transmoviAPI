import { Test, TestingModule } from '@nestjs/testing';
import { PasajerosService } from './pasajeros.service';

describe('PasajerosService', () => {
  let service: PasajerosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PasajerosService],
    }).compile();

    service = module.get<PasajerosService>(PasajerosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
