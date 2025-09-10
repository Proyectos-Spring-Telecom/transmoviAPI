import { PartialType } from '@nestjs/swagger';
import { CreateBlueVoxsDto } from './create-bluevox.dto';

export class UpdateBluevoxDto extends PartialType(CreateBlueVoxsDto) {}
