import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator';
import { EstatusEnum } from 'src/common/estatus.enum';

export class UpdateConteoPasajerosDto {
  @ApiProperty({
    description: 'Número de entradas registradas',
    example: 12,
    required: false,
  })
  @IsInt()
  @IsOptional()
  entradas?: number;

  @ApiProperty({
    description: 'Número de salidas registradas',
    example: 8,
    required: false,
  })
  @IsInt()
  @IsOptional()
  salidas?: number;

  @ApiProperty({
    description: 'Diferencia entre entradas y salidas',
    example: 4,
  })
  @IsInt()
  @IsOptional()
  diferencia?: number;

  @ApiProperty({
    description: 'Fecha y hora en la que ocurrió el conteo',
    example: '2025-09-12T14:30:00Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  fechaHora?: Date;

  @ApiProperty({
    description: 'Estatus del registro de conteo',
    example: 1,
    required: false,
  })
  @IsInt()
  @IsOptional()
  estatus?: EstatusEnum.ACTIVO;

  @ApiProperty({
    description: 'ID del viaje asociado al conteo',
    example: 123,
    required: false,
  })
  @IsInt()
  @IsOptional()
  idViaje?: number;
}
