import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clientes } from 'src/entities/Clientes';
import { ClientesJerarquiaService } from './clientes-jerarquia.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Clientes])],
  providers: [ClientesJerarquiaService],
  exports: [ClientesJerarquiaService],
})
export class ClientesJerarquiaModule {}
