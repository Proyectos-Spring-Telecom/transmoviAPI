import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { EstatusEnum } from 'src/common/estatus.enum';

/**
 * DTO para crear un registro de conteo de pasajeros
 *
 * Representa los datos necesarios para registrar el conteo de entradas y salidas
 * de pasajeros capturado por un dispositivo BlueVox, opcionalmente asociado a un viaje.
 */
export class CreateConteoPasajerosDto {
  @ApiProperty({
    description: 'Número de entradas registradas',
    example: 12,
    required: false,
    default: 0,
  })
  @IsInt()
  @IsOptional()
  entradas?: number;

  @ApiProperty({
    description: 'Número de salidas registradas',
    example: 8,
    required: false,
    default: 0,
  })
  @IsInt()
  @IsOptional()
  salidas?: number;

  @ApiProperty({
    description: 'Diferencia entre entradas y salidas (entradas - salidas)',
    example: 4,
  })
  @IsInt()
  @IsNotEmpty()
  diferencia: number;

  @ApiProperty({
    description: 'Fecha y hora en la que ocurrió el conteo',
    example: '2025-09-12T14:30:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  fechaHora: Date;

  @ApiProperty({
    description: 'Número de serie del dispositivo BlueVox asociado',
    example: 'BVX-2025-XYZ123',
  })
  @IsString()
  @IsNotEmpty()
  numeroSerieBlueVox: string;

  @IsInt()
  @IsOptional()
  estatus?: EstatusEnum.ACTIVO;

  @IsInt()
  @IsOptional()
  idViaje?: number;
}
