import { Test, TestingModule } from '@nestjs/testing';
import { TransaccionesService } from './transacciones.service';

describe('TransaccionesService', () => {
  let service: TransaccionesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransaccionesService],
    }).compile();

    service = module.get<TransaccionesService>(TransaccionesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
