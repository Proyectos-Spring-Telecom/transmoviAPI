import { PartialType } from '@nestjs/swagger';
import { CreateCatTipoCombustibleDto } from './create-catcombustible.dto';

export class UpdateCatcombustibleDto extends PartialType(CreateCatTipoCombustibleDto) {}
