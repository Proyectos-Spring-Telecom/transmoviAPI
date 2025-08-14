import { Test, TestingModule } from '@nestjs/testing';
import { BitacoraService } from './bitacora.service';

describe('BitacoraService', () => {
  let service: BitacoraService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BitacoraService],
    }).compile();

    service = module.get<BitacoraService>(BitacoraService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
