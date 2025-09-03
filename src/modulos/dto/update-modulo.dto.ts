import { PartialType } from '@nestjs/mapped-types';
import { CreateModuloDto } from './create-modulo.dto';
import { IsNumber } from 'class-validator';

export class UpdateModuloDto extends PartialType(CreateModuloDto) {
    @IsNumber()
    id:number;
}
