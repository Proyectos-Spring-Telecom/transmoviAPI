import { PartialType } from '@nestjs/swagger';
import { CreateInstalacionesDto } from './create-instalacione.dto';

export class UpdateInstalacioneDto extends PartialType(CreateInstalacionesDto) {}
