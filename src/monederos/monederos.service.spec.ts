import { Test, TestingModule } from '@nestjs/testing';
import { MonederosService } from './monederos.service';

describe('MonederosService', () => {
  let service: MonederosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MonederosService],
    }).compile();

    service = module.get<MonederosService>(MonederosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
