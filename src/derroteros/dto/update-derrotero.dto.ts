import { PartialType } from '@nestjs/swagger';
import { CreateDerroteroDto } from './create-derrotero.dto';

export class UpdateDerroteroDto extends PartialType(CreateDerroteroDto) {}
