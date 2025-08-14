import { PartialType } from '@nestjs/mapped-types';
import { CreateOperadoreDto } from './create-operadore.dto';

export class UpdateOperadoreDto extends PartialType(CreateOperadoreDto) {}
