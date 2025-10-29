import { Module } from '@nestjs/common';
import { AdministracionService } from './administracion.service';
import { AdministracionController } from './administracion.controller';

@Module({
  controllers: [AdministracionController],
  providers: [AdministracionService],
})
export class AdministracionModule {}
