import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString } from "class-validator";

export class CreateBitacoraDto {
  @IsOptional()
  @IsString()
  @ApiProperty({
              description: 'Nombre del modulo',
              example: 'Permiso',
          })
  Modulo?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
            description: 'Descripcion del modulo',
            example: 'Gestión de la bitácora del sistema',
        })
  Descripcion?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
            description: 'Accion que esta haciendo en el sistema',
            example: 'UPDATE',
        })
  Accion?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
            description: 'Query en SQL',
            example: 'USE Base de Datos UPDATE Tablas WHERE id = 10;',
        })
  Query?: string;

  @IsInt()
  @ApiProperty({
            description: 'El id del usuario que ejecuto la accion',
            example: '24',
        })
  IdUsuario: number;
}
