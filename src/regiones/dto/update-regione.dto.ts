import { PartialType } from '@nestjs/swagger';
import { CreateRegionesDto } from './create-regione.dto';

export class UpdateRegioneDto extends PartialType(CreateRegionesDto) {}
