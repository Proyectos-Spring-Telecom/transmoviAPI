
import {  IsOptional, IsNumber } from 'class-validator';

export class UpdateHistoricoDto {

  @IsOptional()
  @IsNumber()
  idInstalacion?: number;

  @IsOptional()
  @IsNumber()
  idDispositivo?: number;


  @IsOptional()
  @IsNumber()
  idBlueVox?: number;

  @IsOptional()
  @IsNumber()
  idVehiculo?: number;


  @IsOptional()
  @IsNumber()
  idCliente?: number;

}
