import { PartialType } from '@nestjs/swagger';
import { CreateUsuariosRegionesDto } from './create-usuariosregione.dto';

export class UpdateUsuariosregioneDto extends PartialType(CreateUsuariosRegionesDto) {}
