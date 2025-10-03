import { PartialType } from '@nestjs/swagger';
import { CreateViajestransaccioneDto } from './create-viajestransaccione.dto';

export class UpdateViajestransaccioneDto extends PartialType(CreateViajestransaccioneDto) {}
