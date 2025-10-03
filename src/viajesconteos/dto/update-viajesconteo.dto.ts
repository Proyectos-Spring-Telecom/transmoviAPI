import { PartialType } from '@nestjs/swagger';
import { CreateViajesconteoDto } from './create-viajesconteo.dto';

export class UpdateViajesconteoDto extends PartialType(CreateViajesconteoDto) {}
