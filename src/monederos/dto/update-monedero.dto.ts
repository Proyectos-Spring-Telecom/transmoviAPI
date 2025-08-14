import { PartialType } from '@nestjs/mapped-types';
import { CreateMonederoDto } from './create-monedero.dto';

export class UpdateMonederoDto extends PartialType(CreateMonederoDto) {}
