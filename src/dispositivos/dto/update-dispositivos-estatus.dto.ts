import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty } from 'class-validator';

export class UpdateDispositivoEstatusDto {
  @ApiProperty({
    description: 'Estatus del dispositivo (0=Inactivo, 1=Activo)',
    example: 1,
    enum: [0, 1],
  })
  @IsNotEmpty({ message: 'Confirmar estatus en valor de 0 ó 1' })
  @IsInt({ message: 'estatus debe ser un número entero' })
  @IsIn([0, 1], { message: 'Solo puede ser 0 ó 1' })
  estatus: number = 1;
}
