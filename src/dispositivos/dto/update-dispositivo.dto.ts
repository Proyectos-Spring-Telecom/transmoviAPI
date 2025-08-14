import { PartialType } from '@nestjs/mapped-types';
import { CreateDispositivoDto } from './create-dispositivo.dto';

export class UpdateDispositivoDto extends PartialType(CreateDispositivoDto) {}
