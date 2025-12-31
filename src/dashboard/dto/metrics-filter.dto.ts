import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum EnumFiltroMetricas {
  HOY = 'hoy',
  ULTIMOS_7_DIAS = 'ultimos7dias',
  MES_ACTUAL = 'mesActual',
  AÑO_ACTUAL = 'añoActual',
}

export class MetricsFilterDto {
  @ApiProperty({
    enum: EnumFiltroMetricas,
    description: 'Filtro de período para las métricas',
    example: EnumFiltroMetricas.HOY,
    required: false,
    default: EnumFiltroMetricas.HOY,
  })
  @IsEnum(EnumFiltroMetricas, {
    message:
      'El filtro debe ser un valor válido: hoy, ultimos7dias, mesActual, añoActual',
  })
  @IsOptional()
  filtro?: EnumFiltroMetricas = EnumFiltroMetricas.HOY;
}

