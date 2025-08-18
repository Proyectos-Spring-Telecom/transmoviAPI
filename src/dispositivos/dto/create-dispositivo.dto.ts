import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateDispositivoDto {
  @IsString()
  @IsNotEmpty({message: 'Es necesario el numero de serie'})
  numeroSerie: string;

  @IsString()
  @IsNotEmpty({message: 'Es necesario la marca'})
  marca: string;

  @IsString()
  @IsNotEmpty({message: 'Es necesario el modelo'})
  modelo: string;

  @IsInt({message: 'Estatus debe ser un numero entero'})
  @IsIn([0,1],{message: 'Estatus solo puede ser 0 ó 1'})
  @IsOptional()
  estatus?: number=1;
}
