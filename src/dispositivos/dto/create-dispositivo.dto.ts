import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateDispositivoDto {
  @IsString()
  @IsNotEmpty({message: 'Es necesario el numero de serie'})
  NumeroSerie: string;

  @IsString()
  @IsNotEmpty({message: 'Es necesario la marca'})
  Marca: string;

  @IsString()
  @IsNotEmpty({message: 'Es necesario el modelo'})
  Modelo: string;

  @IsInt({message: 'Estatus debe ser un numero entero'})
  @IsIn([0,1],{message: 'Estatus solo puede ser 0 ó 1'})
  @IsOptional()
  Estatus?: number=1;
}
