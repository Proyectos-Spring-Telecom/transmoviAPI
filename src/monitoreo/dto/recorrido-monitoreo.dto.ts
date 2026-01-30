import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { EnumFiltros } from "src/common/estatus.enum";


export class RecorridoMonitoreoDto {
    @IsInt()
    @IsNotEmpty({ message: 'El IdCliente es obligatorio' })
    @ApiProperty({
        description: 'ID del cliente al que pertenece la región',
        example: 5,
        required: true,
    })
    idCliente: number;

    @ApiProperty({
        description: 'Es el numero de serie del dispositivo',
        example: 'DIS-001A',
        required: true,
    })
    @IsString({message: 'Debe ser formato string'})
    @IsNotEmpty({ message: 'El numero de serie del dispositivo es obligatorio' })
    NumeroSerieDispositivo: string;

    @ApiProperty({
        description: 'Fecha inicio del rango (opcional). Si no se envía con fechaFin, se usa la fecha actual',
        example: '2025-01-15',
        required: false,
    })
    @IsDateString({}, { message: 'Debe estar en formato ISO8601' })
    @IsOptional()
    fechaInicio?: string;

    @ApiProperty({
        description: 'Fecha fin del rango (opcional). Si no se envía con fechaInicio, se usa la fecha actual',
        example: '2025-01-20',
        required: false,
    })
    @IsDateString({}, { message: 'Debe estar en formato ISO8601' })
    @IsOptional()
    fechaFin?: string;

}