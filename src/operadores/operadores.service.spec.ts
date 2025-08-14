import { Test, TestingModule } from '@nestjs/testing';
import { OperadoresService } from './operadores.service';

describe('OperadoresService', () => {
  let service: OperadoresService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OperadoresService],
    }).compile();

    service = module.get<OperadoresService>(OperadoresService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
