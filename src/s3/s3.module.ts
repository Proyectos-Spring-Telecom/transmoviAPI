import { Module } from '@nestjs/common';
import { S3Service } from './s3.service';
import { S3Controller } from './s3.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuarios } from 'src/entities/Usuarios'; 
import { Clientes } from 'src/entities/Clientes';
import { Operadores } from 'src/entities/Operadores';

@Module({
  imports: [TypeOrmModule.forFeature([Usuarios,Clientes,Operadores])],
  controllers: [S3Controller],
  providers: [S3Service],
  exports: [S3Service],
})
export class S3Module {}
