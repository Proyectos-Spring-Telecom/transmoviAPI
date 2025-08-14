import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsString } from "class-validator";

export class CreatePermisoDto {
    @IsString()
    @IsNotEmpty()
      @ApiProperty({
            description: 'Nombre del permiso',
            example: 'Permiso',
        })
    nombre:string;
    @IsString()
    @IsNotEmpty()
       @ApiProperty({
            description: 'Descripcion del permiso',
            example: 'Permiso',
        })
    descripcion:string;
    @IsNumber()
    @IsNotEmpty()
       @ApiProperty({
            description: 'Asignarlo a un módulo',
            example: 'Permiso',
        })
    idModulo:number
}
