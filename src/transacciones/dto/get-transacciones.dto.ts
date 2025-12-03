import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsInt, IsNotEmpty, IsOptional } from "class-validator";


export class GetTransaccioneDto {
    @IsInt()
    @IsNotEmpty({ message: 'El IdCliente es obligatorio' })
    @ApiProperty({
        description: 'ID del cliente al que pertenece la región',
        example: 5,
        required: true,
    })
    page: number;

    @IsInt()
    @IsNotEmpty({ message: 'El IdCliente es obligatorio' })
    @ApiProperty({
        description: 'ID del cliente al que pertenece la región',
        example: 5,
        required: true,
    })
    limit: number;

    @ApiProperty({
        description: 'Fecha y hora de inicio (UTC)',
        example: '2025-09-12',
        required: false,
    })
    @IsDateString({}, { message: 'El fin debe estar en formato ISO8601' })
    @IsOptional()
    fechaInicio?: string;

    @ApiProperty({
        description: 'Fecha y hora de fin(UTC)',
        example: '2025-09-12',
        required: false,
    })
    @IsDateString({}, { message: 'El fin debe estar en formato ISO8601' })
    @IsOptional()
    fechaFin?: string;

}