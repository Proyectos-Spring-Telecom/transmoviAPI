import { Test, TestingModule } from '@nestjs/testing';
import { DispositivosService } from './dispositivos.service';

describe('DispositivosService', () => {
  let service: DispositivosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DispositivosService],
    }).compile();

    service = module.get<DispositivosService>(DispositivosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
