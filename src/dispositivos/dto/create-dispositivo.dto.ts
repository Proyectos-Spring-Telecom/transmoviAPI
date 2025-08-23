import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDispositivoDto {
  @IsString()
  @IsNotEmpty({ message: 'Es necesario el numero de serie' })
  @ApiProperty({
    description: 'Numero de serie del dispositivo',
    example: 'XYZ789000',
  })
  NumeroSerie: string;

  @IsString()
  @IsNotEmpty({ message: 'Es necesario la marca' })
  @ApiProperty({
            description: 'Marca del dispositivo',
            example: 'ABCDE',
        })
  Marca: string;

  @IsString()
  @IsNotEmpty({ message: 'Es necesario el modelo' })
  @ApiProperty({
            description: 'El modelo del dispositivos',
            example: 'C2025',
        })
  Modelo: string;

  @IsInt({ message: 'Estatus debe ser un numero entero' })
  @IsIn([0, 1], { message: 'Estatus solo puede ser 0 ó 1' })
  @IsOptional()
  @ApiProperty({
            description: 'Estatus del dispositivo solo es 1 ó 0',
            example: '1',
        })
  Estatus?: number = 1;
}
