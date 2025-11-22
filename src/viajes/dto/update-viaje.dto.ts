import { ApiProperty } from '@nestjs/swagger';
import {
    IsDateString,
    IsIn,
    IsInt,
    IsOptional,
} from 'class-validator';

export class UpdateViajeDto {
    @ApiProperty({
        description: 'Fecha y hora de inicio del viaje',
        example: '2025-09-12T12:00:00.000Z',
    })
    @IsOptional()
    @IsDateString({}, { message: 'El inicio debe ser una fecha en formato ISO' })
    inicio?: Date;

    @ApiProperty({
        description: 'Fecha y hora de fin del viaje (puede ser nula)',
        example: '2025-09-12T14:00:00.000Z',
        required: false,
    })
    @IsOptional()
    @IsDateString({}, { message: 'El fin debe ser una fecha en formato ISO' })
    fin?: Date | null;

    @ApiProperty({
        description: 'Confirmar estatus en valor de 0 ó 1',
        example: 1,
    })
    @IsOptional()
    @IsInt({ message: 'estatus debe ser un número entero' })
    @IsIn([0, 1], { message: 'Solo puede ser 0 ó 1' })
    estatus?: number;

/*     @ApiProperty({
        description: 'Id del cliente asociado al viaje',
        example: 5,
    })
    @IsOptional()
    @IsInt({ message: 'IdCliente debe ser un número entero' })
    idCliente?: number;

    @ApiProperty({
        description: 'Id del turno asociado al viaje',
        example: 3,
    })
    @IsOptional()
    @IsInt({ message: 'IdTurno debe ser un número entero' })
    idTurno?: number;

    @ApiProperty({
        description: 'Id del operador asociado al viaje',
        example: 12,
    })
    @IsOptional()
    @IsInt({ message: 'IdOperador debe ser un número entero' })
    idOperador?: number;

    @ApiProperty({
        description: 'Id del derrotero asociado al viaje',
        example: 20,
    })
    @IsOptional()
    @IsInt({ message: 'IdDerrotero debe ser un número entero' })
    idDerrotero?: number; */
}
