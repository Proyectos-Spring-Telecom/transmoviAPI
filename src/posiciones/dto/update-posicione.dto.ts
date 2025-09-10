import { PartialType } from '@nestjs/swagger';
import { CreatePosicioneDto } from './create-posicione.dto';

export class UpdatePosicioneDto extends PartialType(CreatePosicioneDto) {}
