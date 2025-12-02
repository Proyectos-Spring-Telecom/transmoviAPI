import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsDateString,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
} from 'class-validator';
import { EnumControlTransacciones, EnumTipoTransaccion } from 'src/common/estatus.enum';

export class UpdateTransaccioneDebitoDto {
    @ApiProperty({
        example: 1,
        description: 'ID de la transaccion que se quiere modificar',
    })
    @IsNumber()
    @IsNotEmpty()
    idTransaccionDebito: number;

    @IsEnum(EnumTipoTransaccion, {
        message: 'El tipo de transaccion a realizar: 1 (Recarga), 2 (Debito)',
    })
    @IsOptional()
    idTipoTransaccion?: EnumTipoTransaccion;

    @ApiProperty({
        example: 150.75,
        description: 'Monto de la transacción (2 decimales)',
    })
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsNotEmpty()
    monto: number;

    @ApiProperty({
        description: 'Control de la transacción',
        example: `${0} (pagado), ${1} (abierto)`,
        required: false,
    })
    @IsInt()
    @IsOptional()
    controlTransaccion?: EnumControlTransacciones = EnumControlTransacciones.PAGADO;

    @ApiProperty({
        example: 19.432608,
        description: 'Latitud de la ubicación (opcional)',
        required: false,
    })
    @IsNumber({ maxDecimalPlaces: 7 })
    @IsOptional()
    latitudFinal?: number;

    @ApiProperty({
        example: -99.133209,
        description: 'Longitud de la ubicación (opcional)',
        required: false,
    })
    @IsNumber({ maxDecimalPlaces: 7 })
    @IsOptional()
    longitudFinal?: number;

    @ApiProperty({
        example: '2025-09-10T12:30:00Z',
        description: 'Fecha y hora de la transacción en formato ISO8601',
    })
    @IsDateString()
    fechaHoraFinal: string;

    @ApiProperty({
        example: 'MON-0001',
        description: 'Número de serie del monedero',
    })
    @IsString()
    @IsNotEmpty()
    numeroSerieMonedero: string;

    @ApiProperty({
        example: 'DISP-0001',
        description: 'Número de serie del dispositivo',
    })
    @IsString()
    @IsNotEmpty()
    numeroSerieValidador: string;
}
