import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsOptional } from "class-validator";


export class UpdateTurnoDto {
    @ApiProperty({
        description: 'Fecha y hora de inicio del turno (UTC)',
        example: '2025-09-12T08:00:00Z',
    })
    @IsOptional({ message: 'El inicio es obligatorio' })
    @IsDateString({}, { message: 'El inicio debe estar en formato ISO8601' })
    inicio?: Date;

    @ApiProperty({
        description: 'Fecha y hora de fin del turno (UTC)',
        example: '2025-09-12T16:00:00Z',
        required: false,
    })
    @IsDateString({}, { message: 'El fin debe estar en formato ISO8601' })
    @IsOptional()
    fin?: Date;
}
